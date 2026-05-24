'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Trophy, Plus, Pencil, Trash2, Calendar, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ClubMember } from '@/lib/types';
import { format } from 'date-fns';

interface MatchRecord {
  id: string;
  clubId: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  result: 'W' | 'D' | 'L';
  goalsFor: number;
  goalsAgainst: number;
  notes?: string;
  createdAt: string;
}

const emptyForm = {
  opponent: '',
  date: new Date().toISOString().slice(0, 10),
  venue: '',
  competition: '',
  result: 'W' as 'W' | 'D' | 'L',
  goalsFor: 0,
  goalsAgainst: 0,
  notes: '',
};

export default function AnalystMatchesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MatchRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches, isLoading } = useCollection<MatchRecord>(matchesQuery);

  const sorted = [...(matches ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (m: MatchRecord) => {
    setEditing(m);
    setForm({ opponent: m.opponent, date: m.date.slice(0, 10), venue: m.venue ?? '', competition: m.competition ?? '', result: m.result, goalsFor: m.goalsFor ?? 0, goalsAgainst: m.goalsAgainst ?? 0, notes: m.notes ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !clubId || !user || !form.opponent.trim()) return;
    setSaving(true);
    try {
      const payload = {
        clubId,
        opponent: form.opponent.trim(),
        date: form.date,
        venue: form.venue.trim(),
        competition: form.competition.trim(),
        result: form.result,
        goalsFor: Number(form.goalsFor),
        goalsAgainst: Number(form.goalsAgainst),
        notes: form.notes.trim(),
        enteredBy: user.uid,
        updatedAt: new Date().toISOString(),
      };
      if (editing) {
        await updateDoc(doc(firestore, 'matches', editing.id), payload);
        toast({ title: 'Match updated ✓' });
      } else {
        await addDoc(collection(firestore, 'matches'), { ...payload, createdAt: new Date().toISOString() });
        toast({ title: 'Match added ✓' });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm('Delete this match record?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(firestore, 'matches', id));
      toast({ title: 'Match deleted' });
    } finally {
      setDeletingId(null);
    }
  };

  const resultColor = (r: string) => ({ W: 'bg-green-500/15 text-green-500 border-green-500/30', D: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30', L: 'bg-red-500/15 text-red-500 border-red-500/30' }[r] ?? '');

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Match Entry</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Log and track match results</p>
        </div>
        <Button onClick={openAdd} className="self-start sm:self-auto font-black uppercase tracking-widest h-11 gap-2">
          <Plus className="w-4 h-4" /> Add Match
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="border-none shadow-xl bg-background">
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-black text-sm uppercase">No Matches Recorded</p>
            <p className="text-xs text-muted-foreground">Add your first match result to start tracking performance.</p>
            <Button onClick={openAdd} variant="outline" className="mt-2 font-bold gap-2"><Plus className="w-3.5 h-3.5" />Add Match</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map(m => (
            <Card key={m.id} className="border-none shadow-md bg-background overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Badge className={`text-[10px] font-black w-8 h-8 flex items-center justify-center shrink-0 border ${resultColor(m.result)}`}>
                    {m.result}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">vs {m.opponent}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />{m.date}
                      </span>
                      {m.venue && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="w-3 h-3" />{m.venue}</span>}
                      {m.competition && <Badge variant="secondary" className="text-[8px] h-4 font-bold px-1.5">{m.competition}</Badge>}
                    </div>
                    {m.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{m.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-lg">{m.goalsFor}–{m.goalsAgainst}</p>
                    <div className="flex gap-1 mt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}>
                        {deletingId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest">{editing ? 'Edit Match' : 'Add Match'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Opponent *</Label>
              <Input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="Opponent team name" className="h-11 font-medium" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-11 font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Result</Label>
                <Select value={form.result} onValueChange={(v: any) => setForm(f => ({ ...f, result: v }))}>
                  <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W">Win</SelectItem>
                    <SelectItem value="D">Draw</SelectItem>
                    <SelectItem value="L">Loss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Goals For</Label>
                <Input type="number" min="0" value={form.goalsFor} onChange={e => setForm(f => ({ ...f, goalsFor: Number(e.target.value) }))} className="h-11 font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Goals Against</Label>
                <Input type="number" min="0" value={form.goalsAgainst} onChange={e => setForm(f => ({ ...f, goalsAgainst: Number(e.target.value) }))} className="h-11 font-medium" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Venue</Label>
              <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="e.g. Home / Away / Venue name" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Competition</Label>
              <Input value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))} placeholder="e.g. Premier League" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Analyst Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key observations..." className="h-11 font-medium" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.opponent.trim()} className="font-black uppercase tracking-widest gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Add Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
