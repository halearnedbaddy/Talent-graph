'use client';

import { useState, useMemo, useEffect } from 'react';
import type { AthleteProfile, ScoutProfile, SearchFilters, SavedSearch } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ScoutAthleteCard } from './scout-athlete-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Search, Bookmark, Bell, BellOff, Trash2, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa',"Murang'a",'Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta',
  'Tana River','Tharaka-Nithi','Trans-Nzoia','Turkana','Uasin Gishu','Vihiga',
  'Wajir','West Pokot',
];

const RISK_BANDS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const CONSISTENCY_OPTS = [
  { value: 'poor', label: 'Poor' },
  { value: 'average', label: 'Average' },
  { value: 'good', label: 'Good' },
  { value: 'excellent', label: 'Excellent' },
] as const;

const PAGE_SIZE = 24;

function filterAndSort(athletes: AthleteProfile[], q: string, filters: SearchFilters): AthleteProfile[] {
  let r = athletes.filter(a => {
    if (q) {
      const name = `${a.firstName} ${a.lastName}`.toLowerCase();
      const club = (a.clubName || '').toLowerCase();
      if (!name.includes(q) && !club.includes(q)) return false;
    }
    if (filters.positions?.length) {
      const pos = [a.position, ...(a.altPositions || [])].filter(Boolean) as string[];
      if (!pos.some(p => filters.positions!.includes(p))) return false;
    }
    if (filters.county && a.country !== filters.county) return false;
    if (filters.ageMin !== undefined && a.age < filters.ageMin) return false;
    if (filters.ageMax !== undefined && a.age > filters.ageMax) return false;
    if (filters.scoreMin !== undefined && (a.compositeScoutingIndex ?? 0) < filters.scoreMin) return false;
    if (filters.scoreMax !== undefined && (a.compositeScoutingIndex ?? 0) > filters.scoreMax) return false;
    if (filters.verified && !a.isVerified) return false;
    if (filters.activelyLooking && !a.activelyLooking) return false;
    if (filters.clubStatus === 'has_club' && !a.affiliatedClubId) return false;
    if (filters.clubStatus === 'no_club' && a.affiliatedClubId) return false;
    return true;
  });
  return r.sort((a, b) => {
    switch (filters.sort) {
      case 'recent': return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      case 'alpha': return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'age': return a.age - b.age;
      default: return (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0);
    }
  });
}

interface Props {
  scoutProfile: ScoutProfile;
  compareList: AthleteProfile[];
  onCompare: (a: AthleteProfile) => void;
  savedIds: Set<string>;
  onSave: (a: AthleteProfile) => void;
  onSendMessage?: (a: AthleteProfile) => void;
  initialFilters?: SearchFilters;
}

export function SearchTab({ scoutProfile, compareList, onCompare, savedIds, onSave, onSendMessage, initialFilters }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters ?? { sort: 'score' });
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [view, setView] = useState<'results' | 'saved'>('results');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNotify, setSaveNotify] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(searchQuery.toLowerCase()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => { setPage(0); }, [filters]);

  const athletesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'athletes') : null), [firestore]);
  const { data: athletes, isLoading } = useCollection<AthleteProfile>(athletesQuery);

  const savedSearchesQuery = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedSearches') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedSearches, isLoading: savedLoading } = useCollection<SavedSearch>(savedSearchesQuery);

  const filtered = useMemo(() => filterAndSort(athletes || [], debouncedQ, filters), [athletes, debouncedQ, filters]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const compareIds = new Set(compareList.map(a => a.uid));

  function togglePosition(pos: string) {
    setFilters(f => {
      const cur = f.positions || [];
      return { ...f, positions: cur.includes(pos) ? cur.filter(p => p !== pos) : [...cur, pos] };
    });
  }

  async function handleSaveSearch() {
    if (!firestore || !saveName.trim()) return;
    setIsSaving(true);
    try {
      const id = Date.now().toString();
      await setDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedSearches', id), {
        id, name: saveName.trim(), filters: { ...filters, q: debouncedQ || undefined },
        notificationsEnabled: saveNotify, createdAt: new Date().toISOString(),
      });
      toast({ title: 'Search saved', description: `"${saveName}" saved to your searches.` });
      setSaveDialogOpen(false); setSaveName(''); setSaveNotify(true);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save search.' });
    } finally { setIsSaving(false); }
  }

  async function handleDeleteSavedSearch(id: string) {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedSearches', id));
    toast({ title: 'Deleted', description: 'Saved search removed.' });
  }

  function runSavedSearch(s: SavedSearch) {
    const { filters: f } = s;
    setFilters(f);
    setSearchQuery('');
    setView('results');
    toast({ title: `Running: ${s.name}` });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by athlete name or club..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} title="Save this search">
          <Bookmark className="w-4 h-4" />
        </Button>
        <div className="flex bg-muted rounded-md p-0.5">
          <button
            onClick={() => setView('results')}
            className={cn('text-xs px-3 py-1 rounded transition-colors', view === 'results' ? 'bg-background shadow text-foreground' : 'text-muted-foreground')}
          >Results</button>
          <button
            onClick={() => setView('saved')}
            className={cn('text-xs px-3 py-1 rounded transition-colors', view === 'saved' ? 'bg-background shadow text-foreground' : 'text-muted-foreground')}
          >Saved {savedSearches?.length ? `(${savedSearches.length})` : ''}</button>
        </div>
      </div>

      {view === 'saved' ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Saved Searches</h3>
          {savedLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !savedSearches?.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No saved searches yet. Build a search and click <Bookmark className="w-3 h-3 inline" /> to save it.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {savedSearches.map(s => (
                <Card key={s.id} className="overflow-hidden">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(s.filters).filter(([, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)).map(([k, v]) =>
                          `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join(' · ') || 'No filters'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Saved {new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.notificationsEnabled ? <Bell className="w-3.5 h-3.5 text-primary" /> : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />}
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => runSavedSearch(s)}><Play className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleDeleteSavedSearch(s.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="py-2 px-3">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setFiltersOpen(o => !o)}
              >
                <span className="text-sm font-semibold">Filters</span>
                {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {filtersOpen && (
              <CardContent className="pt-0 pb-3 px-3 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Position</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {POSITIONS.map(p => (
                      <button
                        key={p}
                        onClick={() => togglePosition(p)}
                        className={cn(
                          'text-xs px-2 py-1 rounded border transition-colors font-medium',
                          filters.positions?.includes(p)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary'
                        )}
                      >{p}</button>
                    ))}
                    {(filters.positions?.length ?? 0) > 0 && (
                      <button onClick={() => setFilters(f => ({ ...f, positions: [] }))} className="text-xs px-2 py-1 text-muted-foreground hover:text-destructive">Clear</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">County</Label>
                    <Select value={filters.county || 'all'} onValueChange={v => setFilters(f => ({ ...f, county: v === 'all' ? undefined : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All counties" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All counties</SelectItem>
                        {KENYA_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Sort by</Label>
                    <Select value={filters.sort || 'score'} onValueChange={v => setFilters(f => ({ ...f, sort: v as SearchFilters['sort'] }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score">Top Score</SelectItem>
                        <SelectItem value="recent">Most Recent</SelectItem>
                        <SelectItem value="alpha">A–Z</SelectItem>
                        <SelectItem value="age">Youngest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3 block">
                      Age: {filters.ageMin ?? 15}–{filters.ageMax ?? 35}
                    </Label>
                    <Slider
                      min={15} max={35} step={1}
                      value={[filters.ageMin ?? 15, filters.ageMax ?? 35]}
                      onValueChange={([min, max]) => setFilters(f => ({ ...f, ageMin: min, ageMax: max }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3 block">
                      Score: {filters.scoreMin ?? 0}–{filters.scoreMax ?? 100}
                    </Label>
                    <Slider
                      min={0} max={100} step={1}
                      value={[filters.scoreMin ?? 0, filters.scoreMax ?? 100]}
                      onValueChange={([min, max]) => setFilters(f => ({ ...f, scoreMin: min, scoreMax: max }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Risk Band</Label>
                    <Select value={filters.riskBand || 'all'} onValueChange={v => setFilters(f => ({ ...f, riskBand: v === 'all' ? undefined : v as SearchFilters['riskBand'] }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        {RISK_BANDS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Consistency</Label>
                    <Select value={filters.consistency || 'all'} onValueChange={v => setFilters(f => ({ ...f, consistency: v === 'all' ? undefined : v as SearchFilters['consistency'] }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        {CONSISTENCY_OPTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="verified" checked={!!filters.verified} onCheckedChange={v => setFilters(f => ({ ...f, verified: v || undefined }))} />
                    <Label htmlFor="verified" className="text-xs">Verified only</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="looking" checked={!!filters.activelyLooking} onCheckedChange={v => setFilters(f => ({ ...f, activelyLooking: v || undefined }))} />
                    <Label htmlFor="looking" className="text-xs">Actively Looking</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={filters.clubStatus || 'all'} onValueChange={v => setFilters(f => ({ ...f, clubStatus: v === 'all' ? undefined : v as SearchFilters['clubStatus'] }))}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Club status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any club</SelectItem>
                        <SelectItem value="has_club">Has club</SelectItem>
                        <SelectItem value="no_club">Unattached</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <button
                  onClick={() => setFilters({ sort: 'score' })}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                >
                  Reset all filters
                </button>
              </CardContent>
            )}
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : `${filtered.length} athlete${filtered.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No athletes match your search. Try adjusting your filters.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pageItems.map(a => (
                <ScoutAthleteCard
                  key={a.uid}
                  athlete={a}
                  isInCompare={compareIds.has(a.uid)}
                  compareDisabled={compareList.length >= 5}
                  isSaved={savedIds.has(a.uid)}
                  onCompare={() => onCompare(a)}
                  onSave={() => onSave(a)}
                  onSendMessage={onSendMessage ? () => onSendMessage(a) : undefined}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Save This Search</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="search-name" className="text-sm mb-1.5 block">Search name</Label>
              <Input id="search-name" placeholder="e.g. Left backs Kisumu U21" value={saveName} onChange={e => setSaveName(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="notify" checked={saveNotify} onCheckedChange={setSaveNotify} />
              <Label htmlFor="notify" className="text-sm">Notify me when new athletes match</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSearch} disabled={isSaving || !saveName.trim()}>Save Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
