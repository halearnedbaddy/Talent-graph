'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Users, Search, ShieldCheck, ChevronRight,
  Loader2, AlertTriangle, Star, MessageSquare,
  UserPlus, UserMinus, Send, X
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];
const SORT_OPTIONS = [
  { value: 'csi', label: 'CSI Score' },
  { value: 'name', label: 'Name' },
  { value: 'age', label: 'Age' },
  { value: 'risk', label: 'Risk Index' },
];
const RISK_BANDS = [
  { value: 'all', label: 'All Risk' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'very-high', label: 'Very High' },
];

function getRiskBand(risk: number): string {
  if (risk < 25) return 'low';
  if (risk < 50) return 'moderate';
  if (risk < 75) return 'high';
  return 'very-high';
}

export default function CoachSquadPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState('csi');
  const [verifyFilter, setVerifyFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const [addOpen, setAddOpen] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AthleteProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;
  const clubName = memberships?.[0]?.clubName ?? 'Your Club';

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const filtered = useMemo(() => {
    let list = athletes ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        (a.position ?? '').toLowerCase().includes(q)
      );
    }
    if (positionFilter !== 'All') {
      list = list.filter(a => a.position === positionFilter || a.altPositions?.includes(positionFilter));
    }
    if (verifyFilter === 'verified') list = list.filter(a => a.isVerified);
    if (verifyFilter === 'unverified') list = list.filter(a => !a.isVerified);
    if (riskFilter !== 'all') {
      list = list.filter(a => getRiskBand(a.riskIndex ?? 0) === riskFilter);
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'csi') return (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0);
      if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === 'age') return (a.age ?? 0) - (b.age ?? 0);
      if (sortBy === 'risk') return (b.riskIndex ?? 0) - (a.riskIndex ?? 0);
      return 0;
    });
    return list;
  }, [athletes, search, positionFilter, sortBy, verifyFilter, riskFilter]);

  const squadStats = useMemo(() => {
    const list = athletes ?? [];
    const positions: Record<string, number> = {};
    list.forEach(a => {
      const pos = a.position ?? 'Unknown';
      positions[pos] = (positions[pos] ?? 0) + 1;
    });
    return {
      total: list.length,
      verified: list.filter(a => a.isVerified).length,
      selfReported: list.filter(a => !a.isVerified).length,
      avgCSI: list.length ? Math.round(list.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / list.length) : 0,
      avgAge: list.length ? (list.reduce((s, a) => s + (a.age ?? 0), 0) / list.length).toFixed(1) : '—',
      positions,
    };
  }, [athletes]);

  const handleSearchAthletes = async () => {
    if (!firestore || !athleteSearch.trim()) return;
    setSearching(true);
    try {
      const raw = athleteSearch.trim();
      const words = raw.split(/\s+/).filter(Boolean);

      // Capitalise first letter (most athlete names are stored Title Case)
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

      const seen = new Set<string>();
      const results: AthleteProfile[] = [];

      const addSnap = (snap: { docs: any[] }) => {
        snap.docs.forEach((d: any) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ uid: d.id, ...d.data() } as AthleteProfile);
          }
        });
      };

      if (words.length >= 2) {
        // Two+ word search: search first word as firstName, second as lastName (and vice versa)
        const [w1, w2] = words;
        const queries = [
          // firstName starts with word1
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', cap(w1)), where('firstName', '<=', cap(w1) + '\uf8ff'), limit(20))),
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', w1.toLowerCase()), where('firstName', '<=', w1.toLowerCase() + '\uf8ff'), limit(20))),
          // lastName starts with word2
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', cap(w2)), where('lastName', '<=', cap(w2) + '\uf8ff'), limit(20))),
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', w2.toLowerCase()), where('lastName', '<=', w2.toLowerCase() + '\uf8ff'), limit(20))),
          // also try swapped (in case user typed lastName firstName)
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', cap(w2)), where('firstName', '<=', cap(w2) + '\uf8ff'), limit(20))),
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', cap(w1)), where('lastName', '<=', cap(w1) + '\uf8ff'), limit(20))),
        ];
        const snaps = await Promise.all(queries);
        snaps.forEach(addSnap);

        // Keep only athletes that match BOTH words (firstName matches one, lastName matches other)
        const lw1 = w1.toLowerCase();
        const lw2 = w2.toLowerCase();
        const matched = results.filter(a => {
          const fn = (a.firstName ?? '').toLowerCase();
          const ln = (a.lastName ?? '').toLowerCase();
          return (fn.startsWith(lw1) && ln.startsWith(lw2)) ||
                 (fn.startsWith(lw2) && ln.startsWith(lw1));
        });
        // Fallback to all results if the strict filter leaves nothing
        const finalList = matched.length > 0 ? matched : results;
        setSearchResults(finalList.filter(a => a.affiliatedClubId !== clubId).slice(0, 10));
      } else {
        // Single word: search firstName and lastName separately (case variants)
        const term = words[0];
        const queries = [
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', cap(term)), where('firstName', '<=', cap(term) + '\uf8ff'), limit(15))),
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', term.toLowerCase()), where('firstName', '<=', term.toLowerCase() + '\uf8ff'), limit(15))),
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', cap(term)), where('lastName', '<=', cap(term) + '\uf8ff'), limit(15))),
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', term.toLowerCase()), where('lastName', '<=', term.toLowerCase() + '\uf8ff'), limit(15))),
        ];
        const snaps = await Promise.all(queries);
        snaps.forEach(addSnap);
        setSearchResults(results.filter(a => a.affiliatedClubId !== clubId).slice(0, 10));
      }
    } catch (err: any) {
      toast({ title: 'Search failed', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvite = async (athlete: AthleteProfile) => {
    if (!firestore || !clubId || !user) return;
    setInviting(athlete.uid);
    try {
      await addDoc(collection(firestore, 'squad_invites'), {
        athleteId: athlete.uid,
        athleteName: `${athlete.firstName} ${athlete.lastName}`,
        clubId,
        clubName,
        coachId: user.uid,
        coachName: user.displayName || user.email || 'Coach',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      await addDoc(collection(firestore, 'notifications', athlete.uid, 'items'), {
        type: 'squad_invite',
        title: 'Squad Invite',
        message: `Coach ${user.displayName || 'at'} ${clubName} has invited you to join their squad on Talent Graph.`,
        url: '/dashboard/invites',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Invite Sent ✓', description: `${athlete.firstName} ${athlete.lastName} has been invited to join your squad.` });
      setSearchResults(prev => prev.filter(a => a.uid !== athlete.uid));
    } catch {
      toast({ title: 'Error sending invite', variant: 'destructive' });
    } finally {
      setInviting(null);
    }
  };

  const handleRemove = async (athlete: AthleteProfile) => {
    if (!firestore) return;
    if (!confirm(`Remove ${athlete.firstName} ${athlete.lastName} from your squad?`)) return;
    setRemovingId(athlete.uid);
    try {
      await updateDoc(doc(firestore, 'athletes', athlete.uid), {
        affiliatedClubId: null,
        clubName: null,
        clubStatus: 'removed',
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Athlete Removed', description: `${athlete.firstName} ${athlete.lastName} has been removed from the squad.` });
    } catch {
      toast({ title: 'Error removing athlete', variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  const isLoading = memberLoading || athletesLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">My Squad</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Full roster management
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
        >
          <UserPlus className="h-4 w-4" /> Add Athlete
        </Button>
      </div>

      {/* Squad KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: squadStats.total, color: 'text-white' },
          { label: 'Verified', value: squadStats.verified, color: 'text-[#00C853]' },
          { label: 'Avg CSI', value: squadStats.avgCSI || '--', color: 'text-white' },
          { label: 'Avg Age', value: squadStats.avgAge ? `${squadStats.avgAge}y` : '--', color: 'text-white' },
        ].map(s => (
          <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <Input
              placeholder="Search by name or position..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[110px] bg-[#1C2333] border-[#1E293B] text-white text-xs font-bold h-8">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                {POSITIONS.map(p => (
                  <SelectItem key={p} value={p} className="text-white text-xs font-bold">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px] bg-[#1C2333] border-[#1E293B] text-white text-xs font-bold h-8">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-white text-xs font-bold">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              {(['all', 'verified', 'unverified'] as const).map(v => (
                <Button
                  key={v} size="sm"
                  variant={verifyFilter === v ? 'default' : 'outline'}
                  onClick={() => setVerifyFilter(v)}
                  className={cn(
                    'h-8 font-black text-[10px] uppercase tracking-wide',
                    verifyFilter === v
                      ? 'bg-[#00C853] text-black hover:bg-[#00C853]/90'
                      : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333]'
                  )}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Risk band filter */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[9px] font-black text-[#94A3B8] uppercase self-center mr-1">Risk:</span>
            {RISK_BANDS.map(rb => (
              <button
                key={rb.value}
                onClick={() => setRiskFilter(rb.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-black uppercase border transition-all',
                  riskFilter === rb.value
                    ? 'bg-[#00C853] text-black border-[#00C853]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]'
                )}
              >
                {rb.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">
            {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-white font-bold">No athletes found</p>
              <p className="text-[#94A3B8] text-sm mt-1">
                {athletes?.length === 0 ? 'Your squad is empty. Click "Add Athlete" to invite players.' : 'Try adjusting your filters'}
              </p>
              {athletes?.length === 0 && (
                <Button onClick={() => setAddOpen(true)} className="mt-3 bg-[#00C853] text-black font-black text-xs uppercase gap-2">
                  <UserPlus className="h-4 w-4" /> Add Athlete
                </Button>
              )}
            </div>
          ) : (
            filtered.map(a => (
              <AthleteRow
                key={a.uid}
                athlete={a}
                removing={removingId === a.uid}
                onRemove={() => handleRemove(a)}
              />
            ))
          )}
        </div>
      )}

      {/* Squad Statistics Summary */}
      {(athletes?.length ?? 0) > 0 && (
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Squad Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total Players', value: squadStats.total },
                { label: 'Verified', value: `${squadStats.verified} (${squadStats.total ? Math.round(squadStats.verified / squadStats.total * 100) : 0}%)` },
                { label: 'Self-Reported', value: `${squadStats.selfReported} (${squadStats.total ? Math.round(squadStats.selfReported / squadStats.total * 100) : 0}%)` },
                { label: 'Avg Age', value: squadStats.avgAge ? `${squadStats.avgAge}y` : '—' },
                { label: 'Avg CSI', value: squadStats.avgCSI || '—' },
                { label: 'High Risk', value: (athletes ?? []).filter(a => (a.riskIndex ?? 0) >= 60).length },
              ].map(s => (
                <div key={s.label} className="p-3 bg-[#1C2333] rounded-xl">
                  <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">{s.label}</p>
                  <p className="text-sm font-black text-white mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-2">Positions Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(squadStats.positions).sort((a, b) => b[1] - a[1]).map(([pos, count]) => (
                  <Badge key={pos} className="bg-[#1C2333] text-white border-[#1E293B] font-bold text-[10px]">
                    {pos} ×{count}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Athlete Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#00C853]" /> Add Athlete to Squad
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[11px] text-[#94A3B8]">
              Search for athletes by name. They will receive an in-app invite and can accept or decline.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <Input
                  placeholder="Search athlete name..."
                  value={athleteSearch}
                  onChange={e => setAthleteSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchAthletes(); }}
                  className="pl-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                />
              </div>
              <Button
                onClick={handleSearchAthletes}
                disabled={searching || !athleteSearch.trim()}
                className="bg-[#00C853] text-black font-black text-[10px] uppercase shrink-0"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchResults.length === 0 && !searching && athleteSearch && (
                <div className="text-center py-6">
                  <p className="text-[#94A3B8] text-sm">No athletes found. Try a different name.</p>
                </div>
              )}
              {searchResults.map(a => (
                <div key={a.uid} className="flex items-center gap-3 p-3 rounded-xl bg-[#1C2333] border border-[#1E293B]">
                  <Avatar className="h-9 w-9 rounded-xl shrink-0">
                    <AvatarImage src={a.photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                      {a.firstName[0]}{a.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position ?? 'Unknown'} · {a.age}y</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendInvite(a)}
                    disabled={inviting === a.uid}
                    className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase h-7 px-3 gap-1 shrink-0"
                  >
                    {inviting === a.uid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Invite
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSearchResults([]); setAthleteSearch(''); }}
              className="border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-[10px] uppercase">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AthleteRow({ athlete: a, removing, onRemove }: {
  athlete: AthleteProfile;
  removing: boolean;
  onRemove: () => void;
}) {
  const csi = a.compositeScoutingIndex ?? 0;
  const risk = a.riskIndex ?? 0;
  const riskBand = getRiskBand(risk);

  const riskColor = {
    low: 'text-[#00C853]',
    moderate: 'text-[#FF6D00]',
    high: 'text-red-400',
    'very-high': 'text-red-600',
  }[riskBand];

  const verifyBadge = a.isVerified
    ? { label: 'Coach Verified', cls: 'bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30' }
    : { label: 'Self Reported', cls: 'bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30' };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-[#00C853]/30 transition-colors">
      <Avatar className="h-10 w-10 rounded-xl shrink-0">
        <AvatarImage src={a.photoUrl} className="object-cover" />
        <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-sm font-black">
          {a.firstName[0]}{a.lastName[0]}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
          {a.jerseyNumber && (
            <span className="text-[9px] font-black text-[#94A3B8] bg-[#1C2333] px-1.5 py-0.5 rounded">#{a.jerseyNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position ?? 'N/A'}</span>
          <span className="text-[#1E293B]">·</span>
          <span className="text-[9px] font-bold text-[#94A3B8]">{a.age}y</span>
        </div>
        <Badge className={`mt-1 font-black text-[8px] border ${verifyBadge.cls}`}>
          {verifyBadge.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* CSI */}
        <div className="text-center hidden sm:block">
          <p className={cn('text-lg font-black', csi >= 70 ? 'text-[#00C853]' : csi >= 50 ? 'text-white' : 'text-[#94A3B8]')}>
            {csi || '--'}
          </p>
          <p className="text-[8px] font-bold text-[#94A3B8]">CSI</p>
        </div>

        {/* Risk band */}
        <div className="text-center hidden md:block">
          <p className={cn('text-sm font-black capitalize', riskColor)}>
            {riskBand.replace('-', ' ')}
          </p>
          <p className="text-[8px] font-bold text-[#94A3B8]">Risk</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Link href={`/coach-dashboard/verify`} title="Verify Stats">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#94A3B8] hover:text-[#FF6D00] hover:bg-[#FF6D00]/10">
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href={`/coach-dashboard/communications?compose=${a.uid}`} title="Message Athlete">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#94A3B8] hover:text-[#00C853] hover:bg-[#00C853]/10">
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href={`/coach-dashboard/analytics?athlete=${a.uid}`} title="View Analytics">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#94A3B8] hover:text-white hover:bg-[#1C2333]">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost" size="icon"
            onClick={onRemove}
            disabled={removing}
            title="Remove from Squad"
            className="h-7 w-7 text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
