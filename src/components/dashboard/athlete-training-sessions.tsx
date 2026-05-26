'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Clock, Users, CheckCircle2, XCircle, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfToday } from 'date-fns';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

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
  attendance?: Record<string, 'present' | 'absent' | 'late'>;
  createdAt: string;
}

const FOCUS_COLORS: Record<string, string> = {
  Technical: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Tactical: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Physical: 'bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30',
  Attacking: 'bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30',
  Defensive: 'bg-red-500/10 text-red-400 border-red-500/30',
  'Set Pieces': 'bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/30',
  Mixed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

interface Props {
  athleteId: string;
  affiliatedClubId?: string;
}

function AttendanceStatus({ status }: { status: 'present' | 'absent' | 'late' | 'pending' }) {
  if (status === 'present') return (
    <div className="flex items-center gap-1 text-[#00C853]">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase">Present</span>
    </div>
  );
  if (status === 'late') return (
    <div className="flex items-center gap-1 text-yellow-400">
      <AlertCircle className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase">Late</span>
    </div>
  );
  if (status === 'absent') return (
    <div className="flex items-center gap-1 text-red-400">
      <XCircle className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase">Absent</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1 text-[#94A3B8]">
      <Clock className="h-3.5 w-3.5" />
      <span className="text-[10px] font-black uppercase">Upcoming</span>
    </div>
  );
}

export function AthleteTrainingSessions({ athleteId, affiliatedClubId }: Props) {
  const firestore = useFirestore();

  const sessionsQuery = useMemoFirebase(() => (
    firestore && affiliatedClubId
      ? query(collection(firestore, 'training_sessions'), where('clubId', '==', affiliatedClubId))
      : null
  ), [firestore, affiliatedClubId]);

  const { data: sessions, isLoading } = useCollection<TrainingSession>(sessionsQuery);

  const today = startOfToday();

  const { upcoming, past, stats } = useMemo(() => {
    if (!sessions) return { upcoming: [], past: [], stats: null };

    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const pastSessions = sorted.filter(s => isBefore(parseISO(s.date), today));
    const upcomingSessions = sorted.filter(s => !isBefore(parseISO(s.date), today)).reverse();

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    pastSessions.forEach(s => {
      const status = s.attendance?.[athleteId];
      if (status === 'present' || s.attendees.includes(athleteId)) presentCount++;
      else if (status === 'late') lateCount++;
      else if (pastSessions.length > 0) absentCount++;
    });

    const totalPast = pastSessions.length;
    const attendanceRate = totalPast > 0 ? Math.round(((presentCount + lateCount) / totalPast) * 100) : null;

    return {
      upcoming: upcomingSessions.slice(0, 3),
      past: pastSessions.slice(0, 8),
      stats: totalPast > 0 ? { presentCount, lateCount, absentCount, totalPast, attendanceRate } : null,
    };
  }, [sessions, athleteId, today]);

  if (!affiliatedClubId) {
    return (
      <Card className="border-[#1E293B] bg-[#111827]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-[#94A3B8]" />
            <CardTitle className="text-base font-black uppercase tracking-tight text-white">Training Sessions</CardTitle>
          </div>
          <CardDescription className="text-[#94A3B8]">Join a club to see your training schedule.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-[#1E293B] bg-[#111827]">
        <CardContent className="flex justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-[#00C853] border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="border-[#1E293B] bg-[#111827]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-[#00C853]" />
            <CardTitle className="text-base font-black uppercase tracking-tight text-white">Training Sessions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Dumbbell className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
          <p className="text-[#94A3B8] text-sm">No sessions scheduled yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#1E293B] bg-[#111827]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-[#00C853]" />
          <CardTitle className="text-base font-black uppercase tracking-tight text-white">Training Sessions</CardTitle>
        </div>
        <CardDescription className="text-[#94A3B8]">Your schedule and attendance record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Attendance Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#0A0E1A] rounded-xl p-2.5 text-center border border-[#1E293B]">
              <p className="text-lg font-black text-white">{stats.attendanceRate}%</p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Rate</p>
            </div>
            <div className="bg-[#0A0E1A] rounded-xl p-2.5 text-center border border-[#00C853]/20">
              <p className="text-lg font-black text-[#00C853]">{stats.presentCount}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Present</p>
            </div>
            <div className="bg-[#0A0E1A] rounded-xl p-2.5 text-center border border-yellow-500/20">
              <p className="text-lg font-black text-yellow-400">{stats.lateCount}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Late</p>
            </div>
            <div className="bg-[#0A0E1A] rounded-xl p-2.5 text-center border border-red-500/20">
              <p className="text-lg font-black text-red-400">{stats.absentCount}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Absent</p>
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Upcoming
            </p>
            {upcoming.map(s => {
              const dateStr = (() => { try { return format(parseISO(s.date), 'dd MMM yyyy'); } catch { return s.date; } })();
              return (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-[#00C853]/20 bg-[#00C853]/5 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-bold text-[#94A3B8]">{dateStr}</span>
                      <span className="text-[9px] font-bold text-[#94A3B8]">{s.duration} min</span>
                      <Badge className={cn('font-black text-[8px] border', FOCUS_COLORS[s.focus] ?? 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B]')}>
                        {s.focus}
                      </Badge>
                    </div>
                  </div>
                  <AttendanceStatus status="pending" />
                </div>
              );
            })}
          </div>
        )}

        {/* Past Sessions */}
        {past.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" /> Recent History
            </p>
            {past.map(s => {
              const rawStatus = s.attendance?.[athleteId];
              const wasInAttendees = s.attendees.includes(athleteId);
              const status: 'present' | 'absent' | 'late' = rawStatus ?? (wasInAttendees ? 'present' : 'absent');
              const dateStr = (() => { try { return format(parseISO(s.date), 'dd MMM yyyy'); } catch { return s.date; } })();
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl border gap-3',
                    status === 'present' ? 'border-[#00C853]/20 bg-[#00C853]/5' :
                    status === 'late' ? 'border-yellow-500/20 bg-yellow-500/5' :
                    'border-[#1E293B] bg-[#0A0E1A]'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-bold text-[#94A3B8]">{dateStr}</span>
                      <span className="text-[9px] font-bold text-[#94A3B8]">{s.duration} min</span>
                      <Badge className={cn('font-black text-[8px] border', FOCUS_COLORS[s.focus] ?? 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B]')}>
                        {s.focus}
                      </Badge>
                    </div>
                  </div>
                  <AttendanceStatus status={status} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
