'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Search, Bell, BellOff, Trash2, Plus, Loader2, Clock,
  Filter, CheckCircle2, AlertTriangle
} from 'lucide-react';
import type { ScoutProfile, SavedSearch, SearchFilters } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];
const COUNTIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Machakos', 'Nyeri', 'Meru', 'Garissa'];

export function SavedSearchesTab({ scoutProfile, onRunSearch }: {
  scoutProfile: ScoutProfile;
  onRunSearch: (filters: SearchFilters) => void;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    positions: [] as string[],
    county: '',
    ageMin: '',
    ageMax: '',
    scoreMin: '',
    verified: false,
    activelyLooking: false,
    notificationsEnabled: true,
  });

  const savedSearchesRef = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedSearches') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedSearches, isLoading } = useCollection<SavedSearch>(savedSearchesRef);

  const togglePosition = (pos: string) => {
    setForm(f => ({
      ...f,
      positions: f.positions.includes(pos) ? f.positions.filter(p => p !== pos) : [...f.positions, pos]
    }));
  };

  const handleSave = async () => {
    if (!firestore || !form.name.trim()) return;
    setSaving(true);
    try {
      const id = `search-${Date.now()}`;
      const filters: SearchFilters = {
        positions: form.positions.length > 0 ? form.positions : undefined,
        county: form.county || undefined,
        ageMin: form.ageMin ? Number(form.ageMin) : undefined,
        ageMax: form.ageMax ? Number(form.ageMax) : undefined,
        scoreMin: form.scoreMin ? Number(form.scoreMin) : undefined,
        verified: form.verified || undefined,
        activelyLooking: form.activelyLooking || undefined,
      };
      await setDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedSearches', id), {
        id, name: form.name, filters,
        notificationsEnabled: form.notificationsEnabled,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Search Saved ✓', description: `"${form.name}" will alert you when new athletes match.` });
      setShowCreate(false);
      setForm({ name: '', positions: [], county: '', ageMin: '', ageMax: '', scoreMin: '', verified: false, activelyLooking: false, notificationsEnabled: true });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedSearches', id));
    toast({ title: 'Search deleted' });
  };

  const handleToggleAlert = async (search: SavedSearch) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedSearches', search.id), {
      notificationsEnabled: !search.notificationsEnabled
    });
  };

  const getFilterSummary = (f: SearchFilters) => {
    const parts: string[] = [];
    if (f.positions?.length) parts.push(f.positions.join(', '));
    if (f.county) parts.push(f.county);
    if (f.ageMin || f.ageMax) parts.push(`Age ${f.ageMin ?? '?'}–${f.ageMax ?? '?'}`);
    if (f.scoreMin) parts.push(`CSI ≥ ${f.scoreMin}`);
    if (f.verified) parts.push('Verified only');
    if (f.activelyLooking) parts.push('Seeking transfer');
    return parts.length > 0 ? parts.join(' · ') : 'No filters set';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Saved Searches</h2>
          <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest">Alert alerts when new athletes match</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2 h-8"
        >
          <Plus className="h-3.5 w-3.5" /> New Alert
        </Button>
      </div>

      {/* Info strip */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FF6D00]/5 border border-[#FF6D00]/20">
        <Bell className="h-4 w-4 text-[#FF6D00] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#94A3B8]">
          Saved searches check for new athlete matches daily. Toggle the bell to pause alerts for any search.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#00C853]" /></div>
      ) : savedSearches?.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
          <p className="text-white font-black">No saved searches yet</p>
          <p className="text-[#94A3B8] text-sm mt-1">Save a search to get alerts when new athletes match.</p>
          <Button onClick={() => setShowCreate(true)} variant="ghost" className="mt-3 text-[#00C853] font-black text-[10px] uppercase">
            + Create first alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {savedSearches?.map(s => (
            <Card key={s.id} className="border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-black text-white">{s.name}</p>
                      {s.notificationsEnabled ? (
                        <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px] gap-1">
                          <Bell className="h-2.5 w-2.5" /> Alerts ON
                        </Badge>
                      ) : (
                        <Badge className="bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/30 font-black text-[8px] gap-1">
                          <BellOff className="h-2.5 w-2.5" /> Paused
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                      <Filter className="h-3 w-3" />{getFilterSummary(s.filters)}
                    </p>
                    <p className="text-[9px] text-[#94A3B8] font-bold mt-1 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Created {formatDistanceToNow(parseISO(s.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => onRunSearch(s.filters)}
                      className="border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[9px] uppercase h-7 gap-1"
                    >
                      <Search className="h-3 w-3" /> Run
                    </Button>
                    <button
                      onClick={() => handleToggleAlert(s)}
                      className="p-1.5 rounded-lg hover:bg-[#1C2333] transition-colors"
                      title={s.notificationsEnabled ? 'Pause alerts' : 'Enable alerts'}
                    >
                      {s.notificationsEnabled
                        ? <Bell className="h-4 w-4 text-[#00C853]" />
                        : <BellOff className="h-4 w-4 text-[#94A3B8]" />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide">New Search Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Alert Name *</Label>
              <Input
                placeholder="e.g. Fast Strikers Nairobi U21"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Positions</Label>
              <div className="flex flex-wrap gap-1.5">
                {POSITIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePosition(p)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition-all',
                      form.positions.includes(p)
                        ? 'bg-[#00C853] text-black border-[#00C853]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Min Age</Label>
                <Input type="number" min="14" max="50" value={form.ageMin}
                  onChange={e => setForm(f => ({ ...f, ageMin: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Max Age</Label>
                <Input type="number" min="14" max="50" value={form.ageMax}
                  onChange={e => setForm(f => ({ ...f, ageMax: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Min CSI Score</Label>
              <Input type="number" min="0" max="100" value={form.scoreMin}
                onChange={e => setForm(f => ({ ...f, scoreMin: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C2333]">
              <Label className="text-sm font-bold text-white">Verified athletes only</Label>
              <Switch checked={form.verified} onCheckedChange={v => setForm(f => ({ ...f, verified: v }))} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C2333]">
              <Label className="text-sm font-bold text-white">Actively seeking transfer</Label>
              <Switch checked={form.activelyLooking} onCheckedChange={v => setForm(f => ({ ...f, activelyLooking: v }))} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#00C853]/5 border border-[#00C853]/20">
              <div>
                <Label className="text-sm font-black text-white">Enable Alerts</Label>
                <p className="text-[9px] text-[#94A3B8]">Get notified when new athletes match</p>
              </div>
              <Switch
                checked={form.notificationsEnabled}
                onCheckedChange={v => setForm(f => ({ ...f, notificationsEnabled: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
