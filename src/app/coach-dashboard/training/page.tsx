'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dumbbell, Plus, Loader2, CheckCircle2, Clock,
  Users, BookOpen, ChevronRight, X, Check, AlertTriangle, PenLine
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

interface TrainingSession {
  id: string;
  clubId: string;
  title: string;
  date: string;
  duration: number;
  focus: string;
  drills: string[];
  notes?: string;
  attendees: string[];
  createdAt: string;
}

interface DrillTemplate {
  id: string;
  name: string;
  category: string;
  duration: number;
  players: string;
  description: string;
  equipment: string[];
}

const DRILL_LIBRARY: DrillTemplate[] = [
  { id: 'd1', name: 'Rondo 4v1', category: 'Technical', duration: 15, players: '5+', description: 'Ball retention in a tight square. Develop quick passing and pressing.', equipment: ['Cones', 'Ball'] },
  { id: 'd2', name: 'Possession 6v4', category: 'Tactical', duration: 20, players: '10', description: 'Positional play with numerical superiority. Develop triangles and combinations.', equipment: ['Cones', 'Balls', 'Bibs'] },
  { id: 'd3', name: 'Box-to-Box Sprint', category: 'Physical', duration: 10, players: 'Any', description: 'High-intensity sprint intervals. Build explosive speed and recovery.', equipment: ['Cones'] },
  { id: 'd4', name: 'Finishing Drill', category: 'Attacking', duration: 20, players: 'FWD/MID', description: 'Cut-in finishes, volleys, and one-on-one with keeper.', equipment: ['Balls', 'Goal'] },
  { id: 'd5', name: '1v1 Defending', category: 'Defensive', duration: 15, players: 'DEF/GK', description: 'Isolate defending principles: jockeying, delay, and tackle timing.', equipment: ['Cones', 'Balls'] },
  { id: 'd6', name: 'Set Piece Rehearsal', category: 'Set Pieces', duration: 20, players: 'All', description: 'Rehearse corners, free kicks (offensive and defensive).', equipment: ['Balls', 'Goals', 'Cones'] },
  { id: 'd7', name: 'GK Distribution', category: 'Technical', duration: 15, players: 'GK', description: 'Build play from the back. Short + long distribution patterns.', equipment: ['Balls', 'Cones'] },
  { id: 'd8', name: 'High Press Trigger', category: 'Tactical', duration: 20, players: 'All', description: 'Organised press from the front with trigger cues.', equipment: ['Bibs', 'Cones', 'Balls'] },
];

const FOCUS_AREAS = ['Technical', 'Tactical', 'Physical', 'Mental', 'Set Pieces', 'Attacking', 'Defensive', 'Mixed'];
const CATEGORY_COLORS: Record<string, string> = {
  Technical: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Tactical: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Physical: 'bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30',
  Attacking: 'bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30',
  Defensive: 'bg-red-500/10 text-red-400 border-red-500/30',
  'Set Pieces': 'bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/30',
};

export default function CoachTrainingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedDrills, setSelectedDrills] = useState<string[]>([]);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [customDrills, setCustomDrills] = useState<DrillTemplate[]>([]);
  const [addDrillOpen, setAddDrillOpen] = useState(false);
  const [savingDrill, setSavingDrill] = useState(false);
  const [newDrill, setNewDrill] = useState({
    name: '', category: 'Technical', duration: '15',
    players: 'Any', description: '', equipment: '',
  });

  const [form, setForm] = useState({
    title: '', date: new Date().toISOString().slice(0, 10),
    duration: '90', focus: 'Mixed', notes: '',
  });

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const sessionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'training_sessions'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: sessions, isLoading: sessionsLoading } = useCollection<TrainingSession>(sessionsQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  // Load custom drills from Firestore when clubId is ready
  useEffect(() => {
    if (!firestore || !clubId) return;
    (async () => {
      try {
        const snap = await getDocs(collection(firestore, 'clubs', clubId, 'drill_library'));
        const drills: DrillTemplate[] = snap.docs.map(d => ({
          id: d.id,
          name: (d.data() as any).name || '',
          category: (d.data() as any).category || 'Custom',
          duration: (d.data() as any).duration || 15,
          players: (d.data() as any).players || 'Any',
          description: (d.data() as any).description || '',
          equipment: (d.data() as any).equipment || [],
          custom: true,
        } as DrillTemplate & { custom: boolean }));
        setCustomDrills(drills);
      } catch { }
    })();
  }, [firestore, clubId]);

  const allDrills = [...DRILL_LIBRARY, ...customDrills];
  const filteredDrills = categoryFilter === 'All' ? allDrills : allDrills.filter(d => d.category === categoryFilter);

  const toggleDrill = (id: string) => {
    setSelectedDrills(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleSaveCustomDrill = async () => {
    if (!firestore || !clubId || !newDrill.name.trim()) return;
    setSavingDrill(true);
    try {
      const ref = await addDoc(collection(firestore, 'clubs', clubId, 'drill_library'), {
        name: newDrill.name.trim(),
        category: newDrill.category,
        duration: Number(newDrill.duration) || 15,
        players: newDrill.players || 'Any',
        description: newDrill.description,
        equipment: newDrill.equipment.split(',').map(s => s.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
      });
      setCustomDrills(prev => [...prev, {
        id: ref.id,
        name: newDrill.name.trim(),
        category: newDrill.category,
        duration: Number(newDrill.duration) || 15,
        players: newDrill.players || 'Any',
        description: newDrill.description,
        equipment: newDrill.equipment.split(',').map(s => s.trim()).filter(Boolean),
      }]);
      toast({ title: 'Drill saved ✓', description: `${newDrill.name} added to your club library.` });
      setNewDrill({ name: '', category: 'Technical', duration: '15', players: 'Any', description: '', equipment: '' });
      setAddDrillOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Could not save drill.', variant: 'destructive' });
    } finally {
      setSavingDrill(false);
    }
  };

  const handleCreateSession = async () => {
    if (!firestore || !clubId || !form.title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'training_sessions'), {
        clubId,
        title: form.title,
        date: form.date,
        duration: Number(form.duration),
        focus: form.focus,
        drills: selectedDrills,
        notes: form.notes,
        attendees: [],
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Session Created ✓', description: `${form.title} has been scheduled.` });
      setShowCreate(false);
      setForm({ title: '', date: new Date().toISOString().slice(0, 10), duration: '90', focus: 'Mixed', notes: '' });
      setSelectedDrills([]);
    } catch {
      toast({ title: 'Error', description: 'Could not create session.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!firestore || !attendanceSession) return;
    const attendees = Object.entries(attendance).filter(([, v]) => v).map(([k]) => k);
    await updateDoc(doc(firestore, 'training_sessions', attendanceSession.id), { attendees });
    toast({ title: 'Attendance Saved ✓' });
    setAttendanceSession(null);
    setAttendance({});
  };

  const openAttendance = (s: TrainingSession) => {
    setAttendanceSession(s);
    const init: Record<string, boolean> = {};
    athletes?.forEach(a => { init[a.uid] = s.attendees.includes(a.uid); });
    setAttendance(init);
  };

  const sortedSessions = sessions ? [...sessions].sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Training & Drills</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Session library · Attendance · Planning
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
        >
          <Plus className="h-4 w-4" /> New Session
        </Button>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="bg-[#1C2333] border border-[#1E293B] p-1">
          <TabsTrigger value="sessions" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Clock className="h-3 w-3" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <BookOpen className="h-3 w-3" /> Drill Library
          </TabsTrigger>
        </TabsList>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-3">
          {sessionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
          ) : sortedSessions.length === 0 ? (
            <div className="text-center py-16">
              <Dumbbell className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-white font-black">No training sessions yet</p>
              <p className="text-[#94A3B8] text-sm mt-1">Create your first session to get started.</p>
            </div>
          ) : (
            sortedSessions.map(s => (
              <Card key={s.id} className="border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-black text-white">{s.title}</p>
                        <Badge className={cn('font-black text-[8px] border', CATEGORY_COLORS[s.focus] ?? 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B]')}>
                          {s.focus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] font-bold text-[#94A3B8] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(() => { try { return format(parseISO(s.date), 'dd MMM yyyy'); } catch { return s.date; } })()}
                        </span>
                        <span className="text-[9px] font-bold text-[#94A3B8]">{s.duration} min</span>
                        <span className="text-[9px] font-bold text-[#94A3B8] flex items-center gap-1">
                          <Users className="h-3 w-3" /> {s.attendees.length} / {athletes?.length ?? 0} present
                        </span>
                      </div>
                      {s.drills.length > 0 && (
                        <p className="text-[9px] text-[#94A3B8] mt-1">
                          {s.drills.length} drill{s.drills.length !== 1 ? 's' : ''} planned
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => openAttendance(s)}
                      className="border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase h-7 gap-1 shrink-0"
                    >
                      <Users className="h-3 w-3" /> Attendance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Drill Library */}
        <TabsContent value="library" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 flex-wrap flex-1">
              {['All', ...Object.keys(CATEGORY_COLORS)].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all',
                  categoryFilter === cat
                    ? 'bg-[#00C853] text-black border-[#00C853]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'
                )}
              >
                {cat}
              </button>
            ))}
            </div>
            <Button
              size="sm"
              onClick={() => setAddDrillOpen(true)}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-1.5 h-8 shrink-0"
            >
              <PenLine className="h-3.5 w-3.5" /> Add Drill
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDrills.map(drill => (
              <Card key={drill.id} className={cn('border transition-colors', selectedDrills.includes(drill.id) ? 'border-[#00C853]/50 bg-[#00C853]/5' : 'border-[#1E293B] bg-[#111827]')}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white">{drill.name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge className={cn('font-black text-[8px] border', CATEGORY_COLORS[drill.category] ?? '')}>
                          {drill.category}
                        </Badge>
                        <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">
                          <Clock className="h-2.5 w-2.5 mr-1" />{drill.duration}min
                        </Badge>
                        <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">
                          <Users className="h-2.5 w-2.5 mr-1" />{drill.players}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">{drill.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {drill.equipment.map(eq => (
                        <span key={eq} className="text-[8px] font-bold text-[#94A3B8] bg-[#1C2333] px-1.5 py-0.5 rounded">{eq}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Session Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide">New Training Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Session Title *</Label>
              <Input
                placeholder="e.g. Tuesday Tactical Session"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Date</Label>
                <Input
                  type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Duration (min)</Label>
                <Input
                  type="number" value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Focus Area</Label>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map(f => (
                  <button
                    key={f}
                    onClick={() => setForm(form => ({ ...form, focus: f }))}
                    className={cn(
                      'px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all',
                      form.focus === f
                        ? 'bg-[#00C853] text-black border-[#00C853]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Add Drills from Library ({selectedDrills.length} selected)</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {DRILL_LIBRARY.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggleDrill(d.id)}
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all',
                      selectedDrills.includes(d.id)
                        ? 'border-[#00C853]/50 bg-[#00C853]/5'
                        : 'border-[#1E293B] bg-[#1C2333] hover:border-[#94A3B8]/30'
                    )}
                  >
                    <div className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0',
                      selectedDrills.includes(d.id) ? 'bg-[#00C853] border-[#00C853]' : 'border-[#94A3B8]'
                    )}>
                      {selectedDrills.includes(d.id) && <Check className="h-3 w-3 text-black" />}
                    </div>
                    <span className="text-xs font-bold text-white">{d.name}</span>
                    <Badge className={cn('ml-auto font-black text-[8px] border shrink-0', CATEGORY_COLORS[d.category] ?? '')}>
                      {d.category}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Notes</Label>
              <Textarea
                placeholder="Optional session notes..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase">
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={saving || !form.title.trim()}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      {/* Add Custom Drill Dialog */}
      <Dialog open={addDrillOpen} onOpenChange={setAddDrillOpen}>
        <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide">Add Custom Drill</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Drill Name *</Label>
              <Input
                placeholder="e.g. Pressing Drill v2"
                value={newDrill.name}
                onChange={e => setNewDrill(d => ({ ...d, name: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Category</Label>
                <Select value={newDrill.category} onValueChange={v => setNewDrill(d => ({ ...d, category: v }))}>
                  <SelectTrigger className="bg-[#1C2333] border-[#1E293B] text-white h-9 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                    {['Technical','Tactical','Physical','Attacking','Defensive','Set Pieces','Custom'].map(c => (
                      <SelectItem key={c} value={c} className="text-white font-bold text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Duration (min)</Label>
                <Input
                  type="number" value={newDrill.duration}
                  onChange={e => setNewDrill(d => ({ ...d, duration: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Players</Label>
              <Input
                placeholder="e.g. All, DEF/MID, GK"
                value={newDrill.players}
                onChange={e => setNewDrill(d => ({ ...d, players: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Description</Label>
              <Textarea
                placeholder="What does this drill train and how?"
                value={newDrill.description}
                onChange={e => setNewDrill(d => ({ ...d, description: e.target.value }))}
                rows={3}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Equipment (comma-separated)</Label>
              <Input
                placeholder="e.g. Cones, Balls, Bibs"
                value={newDrill.equipment}
                onChange={e => setNewDrill(d => ({ ...d, equipment: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAddDrillOpen(false)} className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase">
              Cancel
            </Button>
            <Button
              onClick={handleSaveCustomDrill}
              disabled={savingDrill || !newDrill.name.trim()}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
            >
              {savingDrill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Drill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {attendanceSession && (
        <Dialog open onOpenChange={() => setAttendanceSession(null)}>
          <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-wide">
                Attendance — {attendanceSession.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {athletes && athletes.length > 0 ? (
                athletes.map(a => (
                  <button
                    key={a.uid}
                    onClick={() => setAttendance(prev => ({ ...prev, [a.uid]: !prev[a.uid] }))}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
                      attendance[a.uid] ? 'border-[#00C853]/50 bg-[#00C853]/5' : 'border-[#1E293B] bg-[#1C2333]'
                    )}
                  >
                    <div className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      attendance[a.uid] ? 'bg-[#00C853] border-[#00C853]' : 'border-[#94A3B8]'
                    )}>
                      {attendance[a.uid] && <Check className="h-3 w-3 text-black" />}
                    </div>
                    <Avatar className="h-8 w-8 rounded-lg shrink-0">
                      <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                        {a.firstName[0]}{a.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-white">{a.firstName} {a.lastName}</p>
                      <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position}</p>
                    </div>
                    {attendance[a.uid]
                      ? <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px]">Present</Badge>
                      : <Badge className="bg-red-500/10 text-red-400 border-red-500/30 font-black text-[8px]">Absent</Badge>
                    }
                  </button>
                ))
              ) : (
                <p className="text-center text-[#94A3B8] py-4 text-sm">No athletes in squad.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendanceSession(null)} className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase">
                Cancel
              </Button>
              <Button onClick={handleSaveAttendance} className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2">
                <CheckCircle2 className="h-4 w-4" /> Save Attendance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
