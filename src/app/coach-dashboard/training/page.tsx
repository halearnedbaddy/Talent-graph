'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Dumbbell, Plus, Loader2, CheckCircle2, Clock,
  Users, BookOpen, X, Check, PenLine,
  TrendingUp, AlertCircle, XCircle, BarChart3, Calendar
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
import { sendClubNotification } from '@/hooks/usePushNotifications';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

type AttendanceStatus = 'present' | 'late' | 'absent';

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
  attendance?: Record<string, AttendanceStatus>;
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
  custom?: boolean;
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
  Mixed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

function StatusButton({
  status,
  current,
  onClick,
}: {
  status: AttendanceStatus;
  current: AttendanceStatus;
  onClick: () => void;
}) {
  const config = {
    present: { label: 'Present', icon: CheckCircle2, active: 'bg-[#00C853] border-[#00C853] text-black', inactive: 'border-[#1E293B] text-[#94A3B8] hover:border-[#00C853]/50 hover:text-[#00C853]' },
    late: { label: 'Late', icon: AlertCircle, active: 'bg-yellow-500 border-yellow-500 text-black', inactive: 'border-[#1E293B] text-[#94A3B8] hover:border-yellow-500/50 hover:text-yellow-400' },
    absent: { label: 'Absent', icon: XCircle, active: 'bg-red-500 border-red-500 text-white', inactive: 'border-[#1E293B] text-[#94A3B8] hover:border-red-500/50 hover:text-red-400' },
  };
  const c = config[status];
  const Icon = c.icon;
  const isActive = current === status;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase transition-all',
        isActive ? c.active : c.inactive
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </button>
  );
}

export default function CoachTrainingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedDrills, setSelectedDrills] = useState<string[]>([]);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
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
        }));
        setCustomDrills(drills);
      } catch { }
    })();
  }, [firestore, clubId]);

  const allDrills = [...DRILL_LIBRARY, ...customDrills];
  const filteredDrills = categoryFilter === 'All' ? allDrills : allDrills.filter(d => d.category === categoryFilter);

  const today = startOfToday();

  const { upcomingSessions, pastSessions } = useMemo(() => {
    if (!sessions) return { upcomingSessions: [], pastSessions: [] };
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    return {
      pastSessions: sorted.filter(s => { try { return isBefore(parseISO(s.date), today); } catch { return false; } }),
      upcomingSessions: sorted.filter(s => { try { return !isBefore(parseISO(s.date), today); } catch { return true; } }).reverse(),
    };
  }, [sessions, today]);

  // Per-athlete attendance stats across all past sessions
  const athleteStats = useMemo(() => {
    if (!athletes || !pastSessions.length) return {};
    const stats: Record<string, { present: number; late: number; absent: number; total: number }> = {};
    athletes.forEach(a => {
      stats[a.uid] = { present: 0, late: 0, absent: 0, total: pastSessions.length };
    });
    pastSessions.forEach(s => {
      athletes.forEach(a => {
        const status = s.attendance?.[a.uid];
        const legacy = s.attendees.includes(a.uid);
        if (status === 'present' || (!status && legacy)) stats[a.uid].present++;
        else if (status === 'late') stats[a.uid].late++;
        else stats[a.uid].absent++;
      });
    });
    return stats;
  }, [athletes, pastSessions]);

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
        id: ref.id, name: newDrill.name.trim(), category: newDrill.category,
        duration: Number(newDrill.duration) || 15, players: newDrill.players || 'Any',
        description: newDrill.description,
        equipment: newDrill.equipment.split(',').map(s => s.trim()).filter(Boolean),
        custom: true,
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
        clubId, title: form.title, date: form.date,
        duration: Number(form.duration), focus: form.focus,
        drills: selectedDrills, notes: form.notes,
        attendees: [], attendance: {}, createdAt: new Date().toISOString(),
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
    setSavingAttendance(true);
    try {
      const attendees = Object.entries(attendance)
        .filter(([, v]) => v === 'present' || v === 'late')
        .map(([k]) => k);

      await updateDoc(doc(firestore, 'training_sessions', attendanceSession.id), {
        attendees,
        attendance,
        updatedAt: new Date().toISOString(),
      });

      if (clubId) {
        const presentCount = Object.values(attendance).filter(v => v === 'present').length;
        const lateCount = Object.values(attendance).filter(v => v === 'late').length;
        sendClubNotification({
          firestore,
          clubId,
          title: `📋 Attendance Marked — ${attendanceSession.title}`,
          body: `${presentCount} present · ${lateCount} late · ${Object.values(attendance).filter(v => v === 'absent').length} absent`,
          url: '/club-dashboard/training',
          tag: `attendance-${attendanceSession.id}`,
          sentBy: user?.uid,
        }).catch(() => {});
      }

      toast({ title: 'Attendance Saved ✓', description: `${attendees.length} athletes marked.` });
      setAttendanceSession(null);
      setAttendance({});
    } catch {
      toast({ title: 'Error', description: 'Could not save attendance.', variant: 'destructive' });
    } finally {
      setSavingAttendance(false);
    }
  };

  const openAttendance = (s: TrainingSession) => {
    setAttendanceSession(s);
    const init: Record<string, AttendanceStatus> = {};
    athletes?.forEach(a => {
      init[a.uid] = s.attendance?.[a.uid] ?? (s.attendees.includes(a.uid) ? 'present' : 'absent');
    });
    setAttendance(init);
  };

  const setAthleteStatus = (uid: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [uid]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    athletes?.forEach(a => { next[a.uid] = status; });
    setAttendance(next);
  };

  const attendanceSummary = useMemo(() => {
    const present = Object.values(attendance).filter(v => v === 'present').length;
    const late = Object.values(attendance).filter(v => v === 'late').length;
    const absent = Object.values(attendance).filter(v => v === 'absent').length;
    return { present, late, absent };
  }, [attendance]);

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
          <TabsTrigger value="squad" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <BarChart3 className="h-3 w-3" /> Squad Stats
          </TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <BookOpen className="h-3 w-3" /> Drill Library
          </TabsTrigger>
        </TabsList>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-4">
          {sessionsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
          ) : (
            <>
              {/* Upcoming */}
              {upcomingSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Upcoming
                  </p>
                  {upcomingSessions.map(s => (
                    <SessionCard key={s.id} s={s} athletes={athletes} onAttendance={openAttendance} upcoming />
                  ))}
                </div>
              )}

              {/* Past */}
              {pastSessions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-1.5 mt-2">
                    <TrendingUp className="h-3 w-3" /> Past Sessions
                  </p>
                  {pastSessions.map(s => (
                    <SessionCard key={s.id} s={s} athletes={athletes} onAttendance={openAttendance} />
                  ))}
                </div>
              )}

              {upcomingSessions.length === 0 && pastSessions.length === 0 && (
                <div className="text-center py-16">
                  <Dumbbell className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
                  <p className="text-white font-black">No training sessions yet</p>
                  <p className="text-[#94A3B8] text-sm mt-1">Create your first session to get started.</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Squad Attendance Stats */}
        <TabsContent value="squad" className="space-y-3">
          {!athletes || athletes.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-white font-black">No athletes in squad</p>
              <p className="text-[#94A3B8] text-sm mt-1">Add athletes to your club squad first.</p>
            </div>
          ) : pastSessions.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-white font-black">No session data yet</p>
              <p className="text-[#94A3B8] text-sm mt-1">Run sessions and take attendance to see stats.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card className="border-[#1E293B] bg-[#111827] text-center p-3">
                  <p className="text-2xl font-black text-white">{pastSessions.length}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Sessions</p>
                </Card>
                <Card className="border-[#00C853]/20 bg-[#00C853]/5 text-center p-3">
                  <p className="text-2xl font-black text-[#00C853]">
                    {athletes.length > 0 && pastSessions.length > 0
                      ? Math.round(Object.values(athleteStats).reduce((sum, s) => sum + (s.present + s.late) / s.total, 0) / athletes.length * 100)
                      : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Avg Rate</p>
                </Card>
                <Card className="border-[#1E293B] bg-[#111827] text-center p-3">
                  <p className="text-2xl font-black text-white">{athletes.length}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">Athletes</p>
                </Card>
              </div>

              {athletes
                .slice()
                .sort((a, b) => {
                  const rA = athleteStats[a.uid];
                  const rB = athleteStats[b.uid];
                  const pA = rA ? (rA.present + rA.late) / rA.total : 0;
                  const pB = rB ? (rB.present + rB.late) / rB.total : 0;
                  return pB - pA;
                })
                .map(a => {
                  const s = athleteStats[a.uid] ?? { present: 0, late: 0, absent: 0, total: pastSessions.length };
                  const rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
                  const color = rate >= 80 ? '#00C853' : rate >= 60 ? '#FACC15' : '#EF4444';
                  return (
                    <Card key={a.uid} className="border-[#1E293B] bg-[#111827]">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-lg shrink-0">
                            <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                              {a.firstName?.[0]}{a.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                              <span className="text-sm font-black shrink-0" style={{ color }}>{rate}%</span>
                            </div>
                            <Progress value={rate} className="h-1.5 bg-[#1E293B]" style={{ ['--progress-color' as any]: color }} />
                            <div className="flex gap-3 mt-1.5">
                              <span className="text-[9px] font-bold text-[#00C853]">{s.present} present</span>
                              <span className="text-[9px] font-bold text-yellow-400">{s.late} late</span>
                              <span className="text-[9px] font-bold text-red-400">{s.absent} absent</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              }
            </>
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
                        {drill.custom && (
                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 font-black text-[8px]">Custom</Badge>
                        )}
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
                    {['Technical', 'Tactical', 'Physical', 'Attacking', 'Defensive', 'Set Pieces', 'Custom'].map(c => (
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

      {/* Attendance Dialog — 3-state */}
      {attendanceSession && (
        <Dialog open onOpenChange={() => { setAttendanceSession(null); setAttendance({}); }}>
          <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-wide">
                Attendance — {attendanceSession.title}
              </DialogTitle>
              <p className="text-[11px] text-[#94A3B8]">
                {(() => { try { return format(parseISO(attendanceSession.date), 'EEEE, dd MMMM yyyy'); } catch { return attendanceSession.date; } })()}
                {' · '}{attendanceSession.duration} min
              </p>
            </DialogHeader>

            {/* Summary bar */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C853]/10 border border-[#00C853]/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00C853]" />
                <span className="text-[11px] font-black text-[#00C853]">{attendanceSummary.present} Present</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[11px] font-black text-yellow-400">{attendanceSummary.late} Late</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[11px] font-black text-red-400">{attendanceSummary.absent} Absent</span>
              </div>
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={() => markAll('present')}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border border-[#00C853]/30 text-[#00C853] hover:bg-[#00C853]/10 transition-colors"
                >
                  All Present
                </button>
                <button
                  onClick={() => markAll('absent')}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  All Absent
                </button>
              </div>
            </div>

            <div className="space-y-2 mt-1">
              {athletes && athletes.length > 0 ? (
                athletes.map(a => {
                  const status = attendance[a.uid] ?? 'absent';
                  return (
                    <div
                      key={a.uid}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all',
                        status === 'present' ? 'border-[#00C853]/40 bg-[#00C853]/5' :
                        status === 'late' ? 'border-yellow-500/40 bg-yellow-500/5' :
                        'border-[#1E293B] bg-[#0A0E1A]'
                      )}
                    >
                      <Avatar className="h-9 w-9 rounded-lg shrink-0">
                        <AvatarFallback className="rounded-lg bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                          {a.firstName?.[0]}{a.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                        <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <StatusButton status="present" current={status} onClick={() => setAthleteStatus(a.uid, 'present')} />
                        <StatusButton status="late" current={status} onClick={() => setAthleteStatus(a.uid, 'late')} />
                        <StatusButton status="absent" current={status} onClick={() => setAthleteStatus(a.uid, 'absent')} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-[#94A3B8] mx-auto mb-2 opacity-30" />
                  <p className="text-[#94A3B8] text-sm">No athletes in squad yet.</p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => { setAttendanceSession(null); setAttendance({}); }}
                className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
              >
                {savingAttendance ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Attendance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SessionCard({
  s,
  athletes,
  onAttendance,
  upcoming,
}: {
  s: TrainingSession;
  athletes: AthleteProfile[] | null | undefined;
  onAttendance: (s: TrainingSession) => void;
  upcoming?: boolean;
}) {
  const presentCount = Object.values(s.attendance || {}).filter(v => v === 'present').length
    + (s.attendees?.length ?? 0) - Object.keys(s.attendance || {}).filter(k => s.attendees?.includes(k)).length;
  const realPresent = s.attendance
    ? Object.values(s.attendance).filter(v => v === 'present').length
    : s.attendees?.length ?? 0;
  const lateCount = s.attendance ? Object.values(s.attendance).filter(v => v === 'late').length : 0;
  const dateStr = (() => { try { return format(parseISO(s.date), 'dd MMM yyyy'); } catch { return s.date; } })();

  return (
    <Card className={cn(
      'border transition-colors',
      upcoming ? 'border-[#00C853]/20 bg-[#00C853]/5' : 'border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-black text-white">{s.title}</p>
              <Badge className={cn('font-black text-[8px] border', CATEGORY_COLORS[s.focus] ?? 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B]')}>
                {s.focus}
              </Badge>
              {upcoming && <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px]">Upcoming</Badge>}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[9px] font-bold text-[#94A3B8] flex items-center gap-1">
                <Clock className="h-3 w-3" />{dateStr}
              </span>
              <span className="text-[9px] font-bold text-[#94A3B8]">{s.duration} min</span>
              {!upcoming && (
                <>
                  <span className="text-[9px] font-bold text-[#00C853] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />{realPresent}
                  </span>
                  {lateCount > 0 && (
                    <span className="text-[9px] font-bold text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{lateCount} late
                    </span>
                  )}
                  <span className="text-[9px] font-bold text-[#94A3B8]">/ {athletes?.length ?? 0}</span>
                </>
              )}
            </div>
            {s.drills.length > 0 && (
              <p className="text-[9px] text-[#94A3B8] mt-1">{s.drills.length} drill{s.drills.length !== 1 ? 's' : ''} planned</p>
            )}
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => onAttendance(s)}
            className="border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase h-7 gap-1 shrink-0"
          >
            <Users className="h-3 w-3" /> {upcoming ? 'Pre-mark' : 'Attendance'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
