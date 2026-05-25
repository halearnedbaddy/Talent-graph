'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, addDoc, updateDoc,
  serverTimestamp, orderBy, getDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Radio, Trophy, Timer, Users, Plus, Square,
  CircleDot, AlertTriangle, ArrowLeftRight,
  Loader2, ChevronLeft, Play, Clock, Zap,
  Flag, CheckCircle2, XCircle, Shield
} from 'lucide-react';
import type { ClubMember, ClubMatch, LiveMatch, LiveMatchEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type EventType = LiveMatchEvent['type'];

interface EventConfig {
  type: EventType;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  needsPlayer: boolean;
  needsTeam: boolean;
}

const EVENT_CONFIGS: EventConfig[] = [
  { type: 'goal',        label: 'Goal',         icon: CircleDot,      color: 'text-[#00C853]', bg: 'bg-[#00C853]/15 hover:bg-[#00C853]/25 border-[#00C853]/30', needsPlayer: true,  needsTeam: true  },
  { type: 'yellow_card', label: 'Yellow Card',  icon: AlertTriangle,  color: 'text-yellow-400', bg: 'bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/30', needsPlayer: true,  needsTeam: true  },
  { type: 'red_card',    label: 'Red Card',     icon: AlertTriangle,  color: 'text-red-500',   bg: 'bg-red-500/10   hover:bg-red-500/20   border-red-500/30',   needsPlayer: true,  needsTeam: true  },
  { type: 'substitution',label: 'Substitution', icon: ArrowLeftRight, color: 'text-blue-400',  bg: 'bg-blue-400/10  hover:bg-blue-400/20  border-blue-400/30',  needsPlayer: true,  needsTeam: true  },
  { type: 'halftime',    label: 'Half Time',    icon: Clock,          color: 'text-amber-400', bg: 'bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30', needsPlayer: false, needsTeam: false },
  { type: 'fulltime',    label: 'Full Time',    icon: Flag,           color: 'text-[#94A3B8]', bg: 'bg-[#1C2333]    hover:bg-[#1E293B]    border-[#2D3748]',    needsPlayer: false, needsTeam: false },
];

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  goal: CircleDot, yellow_card: AlertTriangle, red_card: AlertTriangle,
  substitution: ArrowLeftRight, halftime: Clock, fulltime: Flag, kickoff: Play,
};
const EVENT_COLORS: Record<EventType, string> = {
  goal: 'text-[#00C853]', yellow_card: 'text-yellow-400', red_card: 'text-red-500',
  substitution: 'text-blue-400', halftime: 'text-amber-400', fulltime: 'text-[#94A3B8]', kickoff: 'text-[#00C853]',
};

function useElapsedMinutes(startedAt: string | undefined, paused: boolean) {
  const [minutes, setMinutes] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!startedAt || paused) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    const tick = () => setMinutes(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    tick();
    intervalRef.current = setInterval(tick, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startedAt, paused]);

  return minutes;
}

export default function LiveMatchPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [view, setView] = useState<'lobby' | 'setup' | 'live'>('lobby');
  const [activeLiveMatch, setActiveLiveMatch] = useState<LiveMatch | null>(null);
  const [pendingEvent, setPendingEvent] = useState<EventConfig | null>(null);
  const [eventForm, setEventForm] = useState({ playerName: '', assistName: '', team: 'home' as 'home' | 'away', offPlayer: '', onPlayer: '' });
  const [submitting, setSubmitting] = useState(false);
  const [setupForm, setSetupForm] = useState({ homeTeam: '', awayTeam: '', linkedMatchId: '' });

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId ?? null;

  const scheduledMatchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: scheduledMatches } = useCollection<ClubMatch>(scheduledMatchesQuery);

  const liveMatchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'live_matches'), where('clubId', '==', clubId), where('status', 'in', ['live', 'halftime', 'scheduled'])) : null
  ), [firestore, clubId]);
  const { data: liveMatches } = useCollection<LiveMatch>(liveMatchesQuery);

  const eventsQuery = useMemoFirebase(() => (
    firestore && activeLiveMatch ? query(collection(firestore, 'live_match_events'), where('matchId', '==', activeLiveMatch.id), orderBy('minute', 'asc')) : null
  ), [firestore, activeLiveMatch?.id]);
  const { data: events } = useCollection<LiveMatchEvent>(eventsQuery);

  const isPaused = activeLiveMatch?.status === 'halftime';
  const elapsedMinutes = useElapsedMinutes(activeLiveMatch?.startedAt, isPaused || !activeLiveMatch);
  const displayMinute = activeLiveMatch ? Math.max(elapsedMinutes, activeLiveMatch.currentMinute) : 0;

  const upcomingMatches = useMemo(() => {
    if (!scheduledMatches) return [];
    const now = new Date();
    return scheduledMatches
      .filter(m => new Date(m.date) >= new Date(now.getTime() - 3 * 60 * 60 * 1000))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [scheduledMatches]);

  async function startMatch() {
    if (!firestore || !clubId || !setupForm.homeTeam || !setupForm.awayTeam) {
      toast({ variant: 'destructive', title: 'Fill in both team names.' }); return;
    }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const ref = await addDoc(collection(firestore, 'live_matches'), {
        clubId, homeTeam: setupForm.homeTeam, awayTeam: setupForm.awayTeam,
        homeScore: 0, awayScore: 0, status: 'live', currentMinute: 0,
        clubMatchId: setupForm.linkedMatchId || null,
        startedAt: now, createdAt: now,
      });
      const snap = await getDoc(ref);
      setActiveLiveMatch({ id: ref.id, ...snap.data() } as LiveMatch);
      await addDoc(collection(firestore, 'live_match_events'), {
        matchId: ref.id, type: 'kickoff', minute: 0, team: 'home',
        createdAt: now,
      });
      setView('live');
      toast({ title: 'Match started!', description: `${setupForm.homeTeam} vs ${setupForm.awayTeam}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not start match.' });
    }
    setSubmitting(false);
  }

  async function resumeMatch(match: LiveMatch) {
    setActiveLiveMatch(match);
    setView('live');
  }

  async function logEvent() {
    if (!firestore || !activeLiveMatch || !pendingEvent) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const eventData: Record<string, unknown> = {
        matchId: activeLiveMatch.id, type: pendingEvent.type,
        minute: displayMinute, team: eventForm.team, createdAt: now,
      };
      if (pendingEvent.needsPlayer && pendingEvent.type !== 'substitution') {
        eventData.playerName = eventForm.playerName;
        if (pendingEvent.type === 'goal') eventData.assistPlayerName = eventForm.assistName;
      }
      if (pendingEvent.type === 'substitution') {
        eventData.offPlayerName = eventForm.offPlayer;
        eventData.onPlayerName = eventForm.onPlayer;
      }

      await addDoc(collection(firestore, 'live_match_events'), eventData);

      const matchRef = doc(firestore, 'live_matches', activeLiveMatch.id);
      const updates: Record<string, unknown> = { currentMinute: displayMinute };

      if (pendingEvent.type === 'goal') {
        if (eventForm.team === 'home') updates.homeScore = (activeLiveMatch.homeScore ?? 0) + 1;
        else updates.awayScore = (activeLiveMatch.awayScore ?? 0) + 1;
        setActiveLiveMatch(prev => prev ? {
          ...prev,
          homeScore: eventForm.team === 'home' ? prev.homeScore + 1 : prev.homeScore,
          awayScore: eventForm.team === 'away' ? prev.awayScore + 1 : prev.awayScore,
        } : prev);
      }
      if (pendingEvent.type === 'halftime') {
        updates.status = 'halftime';
        setActiveLiveMatch(prev => prev ? { ...prev, status: 'halftime' } : prev);
      }
      if (pendingEvent.type === 'fulltime') {
        updates.status = 'fulltime';
        updates.endedAt = now;
        setActiveLiveMatch(prev => prev ? { ...prev, status: 'fulltime' } : prev);
      }

      await updateDoc(matchRef, updates);
      setPendingEvent(null);
      setEventForm({ playerName: '', assistName: '', team: 'home', offPlayer: '', onPlayer: '' });
      toast({ title: `${pendingEvent.label} logged`, description: `${displayMinute}'` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not log event.' });
    }
    setSubmitting(false);
  }

  async function resumeFromHalfTime() {
    if (!firestore || !activeLiveMatch) return;
    await updateDoc(doc(firestore, 'live_matches', activeLiveMatch.id), { status: 'live', startedAt: new Date().toISOString() });
    setActiveLiveMatch(prev => prev ? { ...prev, status: 'live', startedAt: new Date().toISOString() } : prev);
  }

  const isMatchOver = activeLiveMatch?.status === 'fulltime' || activeLiveMatch?.status === 'abandoned';

  if (view === 'lobby') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15">
            <Radio className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Live Match</h1>
            <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest">Real-time event tracker</p>
          </div>
        </div>

        {liveMatches && liveMatches.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">In Progress</p>
            {liveMatches.map(m => (
              <button key={m.id} onClick={() => resumeMatch(m)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1C2333] border border-[#1E293B] hover:border-[#00C853]/40 transition-all text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 shrink-0">
                  <Radio className="h-4 w-4 text-red-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white">{m.homeTeam} vs {m.awayTeam}</p>
                  <p className="text-[11px] text-[#94A3B8]">{m.status === 'halftime' ? 'Half Time' : `${m.currentMinute}'`}</p>
                </div>
                <div className="text-2xl font-black text-white shrink-0">{m.homeScore} – {m.awayScore}</div>
                <ChevronLeft className="h-4 w-4 text-[#94A3B8] rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setView('setup')}
          className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-[#00C853]/40 hover:border-[#00C853] hover:bg-[#00C853]/5 transition-all group">
          <Plus className="h-5 w-5 text-[#00C853]" />
          <span className="text-[14px] font-black text-[#00C853] uppercase tracking-wider">Start New Live Match</span>
        </button>

        {upcomingMatches.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Today's Fixtures</p>
            {upcomingMatches.map(m => (
              <button key={m.id}
                onClick={() => { setSetupForm({ homeTeam: memberships?.[0]?.clubName ?? '', awayTeam: m.opponent, linkedMatchId: m.id }); setView('setup'); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1C2333] border border-[#1E293B] hover:border-[#00C853]/30 transition-all text-left">
                <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-white truncate">vs {m.opponent}</p>
                  <p className="text-[10px] text-[#94A3B8]">{m.competition} · {new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                <span className="text-[10px] font-bold text-[#00C853]">Quick start →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={() => setView('lobby')} className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors text-[13px] font-semibold">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Set Up Match</h2>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Enter the two teams to begin live tracking</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Home Team</label>
              <Input value={setupForm.homeTeam} onChange={e => setSetupForm(p => ({ ...p, homeTeam: e.target.value }))}
                placeholder="Home team name" className="bg-[#1C2333] border-[#1E293B] text-white font-bold h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Away Team</label>
              <Input value={setupForm.awayTeam} onChange={e => setSetupForm(p => ({ ...p, awayTeam: e.target.value }))}
                placeholder="Away team name" className="bg-[#1C2333] border-[#1E293B] text-white font-bold h-11" />
            </div>
          </div>
          {setupForm.linkedMatchId && (
            <p className="text-[11px] text-[#00C853] font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Linked to scheduled fixture
            </p>
          )}
          <Button onClick={startMatch} disabled={submitting || !setupForm.homeTeam || !setupForm.awayTeam}
            className="w-full bg-[#00C853] hover:bg-[#00E676] text-black font-black text-[13px] h-12 rounded-xl uppercase tracking-wider">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-2" /> Kick Off</>}
          </Button>
        </div>
      </div>
    );
  }

  if (!activeLiveMatch) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Scoreboard */}
      <div className="rounded-2xl bg-[#111827] border border-[#1E293B] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            {activeLiveMatch.status === 'live' && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Live
              </span>
            )}
            {activeLiveMatch.status === 'halftime' && (
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Half Time</span>
            )}
            {activeLiveMatch.status === 'fulltime' && (
              <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Full Time</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <Timer className="h-3.5 w-3.5" />
            <span className="text-[12px] font-black">{displayMinute}'</span>
          </div>
        </div>

        <div className="grid grid-cols-3 items-center px-6 py-5">
          <div className="text-center">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Home</p>
            <p className="text-[15px] font-black text-white leading-tight">{activeLiveMatch.homeTeam}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <span className={cn('text-5xl font-black tabular-nums', activeLiveMatch.homeScore > activeLiveMatch.awayScore ? 'text-[#00C853]' : 'text-white')}>{activeLiveMatch.homeScore}</span>
              <span className="text-2xl font-black text-[#475569]">–</span>
              <span className={cn('text-5xl font-black tabular-nums', activeLiveMatch.awayScore > activeLiveMatch.homeScore ? 'text-[#00C853]' : 'text-white')}>{activeLiveMatch.awayScore}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Away</p>
            <p className="text-[15px] font-black text-white leading-tight">{activeLiveMatch.awayTeam}</p>
          </div>
        </div>
      </div>

      {/* Half-time resume */}
      {activeLiveMatch.status === 'halftime' && (
        <Button onClick={resumeFromHalfTime} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black h-11 rounded-xl uppercase tracking-wider">
          <Play className="h-4 w-4 mr-2" /> Resume — Second Half
        </Button>
      )}

      {/* Event buttons */}
      {!isMatchOver && activeLiveMatch.status !== 'halftime' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Log Event</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EVENT_CONFIGS.map(cfg => (
              <button key={cfg.type} onClick={() => { setPendingEvent(cfg); setEventForm({ playerName: '', assistName: '', team: 'home', offPlayer: '', onPlayer: '' }); }}
                className={cn('flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left', cfg.bg)}>
                <cfg.icon className={cn('h-4 w-4 shrink-0', cfg.color)} />
                <span className={cn('text-[12px] font-black', cfg.color)}>{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isMatchOver && (
        <MatchCompleteCard
          match={activeLiveMatch}
          events={events ?? []}
          clubId={clubId ?? ''}
          onBack={() => setView('lobby')}
          firestore={firestore}
        />
      )}

      {/* Event entry modal */}
      {pendingEvent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#111827] border border-[#1E293B] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', pendingEvent.bg.split(' ')[0])}>
                <pendingEvent.icon className={cn('h-4 w-4', pendingEvent.color)} />
              </div>
              <div className="flex-1">
                <p className={cn('text-[13px] font-black', pendingEvent.color)}>{pendingEvent.label}</p>
                <p className="text-[11px] text-[#94A3B8]">{displayMinute}' · Fill in details</p>
              </div>
              <button onClick={() => setPendingEvent(null)} className="text-[#94A3B8] hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {pendingEvent.needsTeam && (
              <div className="grid grid-cols-2 gap-2">
                {(['home', 'away'] as const).map(t => (
                  <button key={t} onClick={() => setEventForm(p => ({ ...p, team: t }))}
                    className={cn('py-2 rounded-xl text-[12px] font-black transition-all border', eventForm.team === t
                      ? 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/40'
                      : 'text-[#94A3B8] border-[#1E293B] hover:border-[#2D3748]')}>
                    {t === 'home' ? activeLiveMatch.homeTeam : activeLiveMatch.awayTeam}
                  </button>
                ))}
              </div>
            )}

            {pendingEvent.needsPlayer && pendingEvent.type !== 'substitution' && (
              <div className="space-y-2">
                <Input value={eventForm.playerName} onChange={e => setEventForm(p => ({ ...p, playerName: e.target.value }))}
                  placeholder="Player name" className="bg-[#1C2333] border-[#1E293B] text-white h-10 text-[13px]" />
                {pendingEvent.type === 'goal' && (
                  <Input value={eventForm.assistName} onChange={e => setEventForm(p => ({ ...p, assistName: e.target.value }))}
                    placeholder="Assist by (optional)" className="bg-[#1C2333] border-[#1E293B] text-white h-10 text-[13px]" />
                )}
              </div>
            )}

            {pendingEvent.type === 'substitution' && (
              <div className="space-y-2">
                <Input value={eventForm.offPlayer} onChange={e => setEventForm(p => ({ ...p, offPlayer: e.target.value }))}
                  placeholder="Player OFF" className="bg-[#1C2333] border-[#1E293B] text-white h-10 text-[13px]" />
                <Input value={eventForm.onPlayer} onChange={e => setEventForm(p => ({ ...p, onPlayer: e.target.value }))}
                  placeholder="Player ON" className="bg-[#1C2333] border-[#1E293B] text-white h-10 text-[13px]" />
              </div>
            )}

            <Button onClick={logEvent} disabled={submitting}
              className="w-full bg-[#00C853] hover:bg-[#00E676] text-black font-black h-11 rounded-xl">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Log ${pendingEvent.label}`}
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {events && events.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Match Timeline</p>
          <div className="rounded-2xl bg-[#1C2333] border border-[#1E293B] divide-y divide-[#1E293B] overflow-hidden">
            {[...events].reverse().map(ev => {
              const Icon = EVENT_ICONS[ev.type] ?? Zap;
              const color = EVENT_COLORS[ev.type] ?? 'text-white';
              const isHome = ev.team === 'home';
              return (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[11px] font-black text-[#475569] w-7 text-right shrink-0">{ev.minute}'</span>
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-bold text-white capitalize">
                      {ev.type.replace('_', ' ')}
                      {ev.playerName ? ` — ${ev.playerName}` : ''}
                      {ev.offPlayerName ? ` — ${ev.offPlayerName} ↔ ${ev.onPlayerName}` : ''}
                      {ev.assistPlayerName ? ` (assist: ${ev.assistPlayerName})` : ''}
                    </span>
                  </div>
                  <Badge className={cn('text-[9px] font-black shrink-0', isHome ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400')}>
                    {isHome ? activeLiveMatch.homeTeam.split(' ')[0] : activeLiveMatch.awayTeam.split(' ')[0]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCompleteCard({
  match, events, clubId, onBack, firestore,
}: {
  match: LiveMatch;
  events: LiveMatchEvent[];
  clubId: string;
  onBack: () => void;
  firestore: ReturnType<typeof useFirestore>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSaveToProfiles() {
    if (!firestore || !clubId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const homeScore = match.homeScore ?? 0;
      const awayScore = match.awayScore ?? 0;
      const resultStr = homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';

      // Get goals, cards by player name
      const goalsByPlayer: Record<string, number> = {};
      const yellowsByPlayer: Record<string, number> = {};
      const redsByPlayer: Record<string, number> = {};
      events.forEach(ev => {
        if (ev.team !== 'home') return;
        if (ev.type === 'goal' && ev.playerName) goalsByPlayer[ev.playerName] = (goalsByPlayer[ev.playerName] ?? 0) + 1;
        if (ev.type === 'yellow_card' && ev.playerName) yellowsByPlayer[ev.playerName] = (yellowsByPlayer[ev.playerName] ?? 0) + 1;
        if (ev.type === 'red_card' && ev.playerName) redsByPlayer[ev.playerName] = (redsByPlayer[ev.playerName] ?? 0) + 1;
      });

      const playerNames = new Set([...Object.keys(goalsByPlayer), ...Object.keys(yellowsByPlayer), ...Object.keys(redsByPlayer)]);
      if (playerNames.size === 0) {
        toast({ title: 'No home player events to sync', description: 'Log goals, cards or subs first.' });
        setSaving(false);
        return;
      }

      // Load athletes for this club
      const athletesSnap = await getDocs(
        query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId))
      );
      const athletes = athletesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const normalise = (s: string) => s.trim().toLowerCase();

      const batch = writeBatch(firestore);
      let matched = 0;

      for (const name of playerNames) {
        const athlete = athletes.find((a: any) => {
          const full = `${a.firstName ?? ''} ${a.lastName ?? ''}`;
          return normalise(full) === normalise(name) ||
            normalise(a.lastName ?? '') === normalise(name) ||
            normalise(a.firstName ?? '') === normalise(name);
        });
        if (!athlete) continue;

        const existing: any[] = athlete.matchHistory ?? [];
        const newEntry = {
          id: `live-${match.id}-${Date.now()}`,
          date: match.startedAt?.slice(0, 10) ?? now.slice(0, 10),
          opponent: match.awayTeam,
          result: resultStr,
          minutesPlayed: 90,
          goals: goalsByPlayer[name] ?? 0,
          assists: 0,
          yellowCards: yellowsByPlayer[name] ?? 0,
          redCards: redsByPlayer[name] ?? 0,
          cleanSheet: awayScore === 0,
          competition: 'Live Match',
          source: 'live_match',
          liveMatchId: match.id,
        };
        const updated = [...existing, newEntry];
        batch.update(doc(firestore, 'athletes', athlete.id), { matchHistory: updated, updatedAt: now });
        matched++;
      }

      if (matched === 0) {
        toast({ title: 'No athletes matched', description: 'Player names in events did not match any squad member names.' });
        setSaving(false);
        return;
      }

      await batch.commit();
      setSaved(true);
      toast({ title: `Profiles updated ✓`, description: `${matched} athlete${matched !== 1 ? 's' : ''} synced from this match.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Sync failed', description: e?.message ?? 'Could not update profiles.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#1C2333] border border-[#1E293B] p-6 text-center space-y-3">
      <CheckCircle2 className="h-10 w-10 text-[#00C853] mx-auto" />
      <p className="text-[15px] font-black text-white">Match Completed</p>
      <p className="text-[12px] text-[#94A3B8]">
        Final score: {match.homeTeam} {match.homeScore} – {match.awayScore} {match.awayTeam}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        {!saved ? (
          <Button
            onClick={handleSaveToProfiles}
            disabled={saving}
            className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
            Save to Athlete Profiles
          </Button>
        ) : (
          <div className="flex items-center gap-2 justify-center">
            <CheckCircle2 className="h-4 w-4 text-[#00C853]" />
            <span className="text-[11px] font-black text-[#00C853] uppercase">Profiles Updated</span>
          </div>
        )}
        <Button onClick={onBack} variant="outline" className="border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-xs uppercase">
          Back to Lobby
        </Button>
      </div>
    </div>
  );
}
