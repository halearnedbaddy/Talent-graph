'use client';

import { useState, useMemo, useEffect } from 'react';
import { SendNotificationDialog, type NotificationEvent } from '@/components/coach/send-notification-dialog';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Plus, ChevronLeft, ChevronRight, Loader2, Trophy, Dumbbell, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import type { ClubMatch } from '@/lib/types';
import { useCoachClub } from '@/app/coach-dashboard/coach-context';
import { useToast } from '@/hooks/use-toast';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, getDay
} from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

type EventType = 'match' | 'training' | 'other';

interface ScheduleEvent {
  id: string;
  clubId: string;
  title: string;
  date: string;
  time?: string;
  type: EventType;
  location?: string;
  notes?: string;
  createdAt: string;
}

const EVENT_COLORS: Record<EventType, string> = {
  match: 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/30',
  training: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  other: 'bg-[#94A3B8]/20 text-[#94A3B8] border-[#94A3B8]/30',
};

const EVENT_DOT: Record<EventType, string> = {
  match: 'bg-[#00C853]',
  training: 'bg-blue-400',
  other: 'bg-[#94A3B8]',
};

export default function CoachSchedulePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', date: new Date().toISOString().slice(0, 10),
    time: '', type: 'match' as EventType, location: '', notes: '',
  });
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyEvent, setNotifyEvent] = useState<NotificationEvent | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const { clubId, clubName } = useCoachClub();

  const eventsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'schedule_events'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: events, isLoading } = useCollection<ScheduleEvent>(eventsQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  useEffect(() => {
    user?.getIdToken().then(setIdToken);
  }, [user]);

  // Combine matches + custom events
  const allEvents = useMemo(() => {
    const matchEvents: ScheduleEvent[] = (matches ?? []).map(m => ({
      id: `match-${m.id}`,
      clubId: clubId ?? '',
      title: `vs ${m.opponent}`,
      date: m.date,
      type: 'match' as EventType,
      location: m.location,
      notes: m.competition,
      createdAt: m.createdAt,
    }));
    return [...matchEvents, ...(events ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [matches, events, clubId]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const getEventsForDay = (day: Date) =>
    allEvents.filter(e => {
      try { return isSameDay(parseISO(e.date), day); } catch { return false; }
    });

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return allEvents.filter(e => e.date >= now).slice(0, 5);
  }, [allEvents]);

  const handleCreate = async () => {
    if (!firestore || !clubId || !form.title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'schedule_events'), {
        clubId, title: form.title, date: form.date, time: form.time,
        type: form.type, location: form.location, notes: form.notes,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Event Added ✓' });
      const notifType = form.type === 'training' ? 'training' : form.type === 'match' ? 'match' : 'general';
      setNotifyEvent({ type: notifType as NotificationEvent['type'], title: form.title, date: form.date, time: form.time, venue: form.location, notes: form.notes });
      setShowCreate(false);
      setNotifyOpen(true);
      setForm({ title: '', date: new Date().toISOString().slice(0, 10), time: '', type: 'match', location: '', notes: '' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // First day of week offset (Mon=0)
  const firstDayOffset = (getDay(calendarDays[0]) + 6) % 7;

  return (
    <div className="space-y-5">
      {notifyEvent && (
        <SendNotificationDialog
          open={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          event={notifyEvent}
          clubId={clubId ?? ''}
          clubName={clubName || 'Club'}
          coachName={user?.displayName ?? 'Coach'}
          userToken={idToken}
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Schedule</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Matches · Training · Events
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
        >
          <Plus className="h-4 w-4" /> Add Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setViewDate(d => subMonths(d, 1))}
                  className="h-8 w-8 text-[#94A3B8] hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-black text-white uppercase tracking-wide">
                  {format(viewDate, 'MMMM yyyy')}
                </h2>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setViewDate(d => addMonths(d, 1))}
                  className="h-8 w-8 text-[#94A3B8] hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-[9px] font-black text-[#94A3B8] uppercase py-1">{d}</div>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calendarDays.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const today = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
                      className={cn(
                        'relative flex flex-col items-center p-1 rounded-lg min-h-[44px] transition-all border',
                        isSelected ? 'bg-[#00C853]/20 border-[#00C853]/50' : today ? 'border-[#00C853]/30 bg-[#00C853]/5' : 'border-transparent hover:bg-[#1C2333] hover:border-[#1E293B]'
                      )}
                    >
                      <span className={cn(
                        'text-[11px] font-black',
                        today ? 'text-[#00C853]' : isSelected ? 'text-[#00C853]' : 'text-white'
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {dayEvents.slice(0, 3).map(e => (
                            <span key={e.id} className={cn('h-1.5 w-1.5 rounded-full', EVENT_DOT[e.type])} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day events */}
              {selectedDay && (
                <div className="mt-4 pt-4 border-t border-[#1E293B] space-y-2">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">
                    {format(selectedDay, 'EEEE, d MMMM')}
                  </p>
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-[#94A3B8] text-sm">No events</p>
                  ) : (
                    selectedDayEvents.map(e => (
                      <div key={e.id} className={cn('flex items-center gap-3 p-3 rounded-xl border', EVENT_COLORS[e.type])}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white">{e.title}</p>
                          {e.notes && <p className="text-[9px] text-[#94A3B8] uppercase font-bold">{e.notes}</p>}
                          {e.location && (
                            <p className="text-[9px] text-[#94A3B8] flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" />{e.location}
                            </p>
                          )}
                        </div>
                        <Badge className={cn('font-black text-[8px] border shrink-0', EVENT_COLORS[e.type])}>
                          {e.type}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex gap-4">
            {Object.entries(EVENT_DOT).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
                <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-wide capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming strip */}
        <div className="space-y-3">
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#00C853]" /> Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#00C853] mx-auto" />
              ) : upcomingEvents.length === 0 ? (
                <p className="text-[#94A3B8] text-sm text-center py-4">No upcoming events</p>
              ) : (
                upcomingEvents.map(e => (
                  <div key={e.id} className="flex gap-3 items-start">
                    <div className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', EVENT_DOT[e.type])} />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{e.title}</p>
                      <p className="text-[9px] font-bold text-[#94A3B8]">
                        {(() => { try { return format(parseISO(e.date), 'EEE dd MMM'); } catch { return e.date; } })()}
                        {e.time ? ` · ${e.time}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Monthly summary */}
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {(['match', 'training', 'other'] as EventType[]).map(type => {
                const count = allEvents.filter(e => {
                  if (e.type !== type) return false;
                  try {
                    const d = parseISO(e.date);
                    return isSameMonth(d, viewDate);
                  } catch { return false; }
                }).length;
                const Icon = type === 'match' ? Trophy : type === 'training' ? Dumbbell : Clock;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', type === 'match' ? 'text-[#00C853]' : type === 'training' ? 'text-blue-400' : 'text-[#94A3B8]')} />
                      <span className="text-sm font-bold text-white capitalize">{type}es</span>
                    </div>
                    <span className="text-sm font-black text-white">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide">Add Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Title *</Label>
              <Input
                placeholder="Event title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Time</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Type</Label>
              <div className="flex gap-2">
                {(['match', 'training', 'other'] as EventType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all',
                      form.type === t
                        ? t === 'match' ? 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/50' : t === 'training' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-[#94A3B8]/20 text-[#94A3B8] border-[#94A3B8]/30'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Location</Label>
              <Input placeholder="e.g. Kasarani Stadium" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#1E293B] text-[#94A3B8] font-black text-[10px] uppercase">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
