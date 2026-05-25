'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, setDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Play, Square, Pause, CircleSlash, ArrowLeftRight, Clock,
  Flag, AlertTriangle, BarChart3, Zap, Plus, Radio, Shield, Users, User
} from 'lucide-react';
import type { ClubMember, ClubMatch, LiveMatch, LiveMatchEvent, LiveMatchStatSnapshot, LiveMatchRefereeDetails, AthleteProfile, ScoutConnection } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { sendClubNotification } from '@/hooks/usePushNotifications';
import { smsSend } from '@/hooks/useSMS';

const EVENT_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  goal: { icon: '⚽', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  yellow_card: { icon: '🟨', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  red_card: { icon: '🟥', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  substitution: { icon: '🔄', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  halftime: { icon: '⏸', color: 'text-neutral-600', bg: 'bg-neutral-50 border-neutral-200' },
  fulltime: { icon: '🏁', color: 'text-neutral-900', bg: 'bg-neutral-100 border-neutral-300' },
  kickoff: { icon: '🎯', color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
};

const EMPTY_STATS: LiveMatchStatSnapshot = {
  homeGoals: 0, awayGoals: 0,
  homeShotsOnTarget: 0, awayShotsOnTarget: 0,
  homeShotsOffTarget: 0, awayShotsOffTarget: 0,
  homeCorners: 0, awayCorners: 0,
  homeFreeKicks: 0, awayFreeKicks: 0,
  homeCrosses: 0, awayCrosses: 0,
  homeCutbacks: 0, awayCutbacks: 0,
  homePenetrationPasses: 0, awayPenetrationPasses: 0,
  homeFouls: 0, awayFouls: 0,
  homeAerialDuelsWon: 0, awayAerialDuelsWon: 0,
  homeGroundDuelsWon: 0, awayGroundDuelsWon: 0,
  homeGkSaves: 0, awayGkSaves: 0,
  homeOneVOne: 0, awayOneVOne: 0,
  homeYellows: 0, awayYellows: 0,
  homeTouchesInBox: 0, awayTouchesInBox: 0,
  homePossession: 50,
};

const STAT_ROWS: { label: string; homeKey: keyof LiveMatchStatSnapshot; awayKey: keyof LiveMatchStatSnapshot; color?: string; section?: string }[] = [
  { label: 'Goals', homeKey: 'homeGoals', awayKey: 'awayGoals', color: 'bg-green-500', section: 'Scoring' },
  { label: 'Shots on Target', homeKey: 'homeShotsOnTarget', awayKey: 'awayShotsOnTarget', color: 'bg-emerald-500', section: 'Shooting' },
  { label: 'Shots off Target', homeKey: 'homeShotsOffTarget', awayKey: 'awayShotsOffTarget', color: 'bg-slate-400', section: 'Shooting' },
  { label: 'Corner Kicks', homeKey: 'homeCorners', awayKey: 'awayCorners', color: 'bg-amber-500', section: 'Set Pieces' },
  { label: 'Free Kicks', homeKey: 'homeFreeKicks', awayKey: 'awayFreeKicks', color: 'bg-orange-500', section: 'Set Pieces' },
  { label: 'Crosses', homeKey: 'homeCrosses', awayKey: 'awayCrosses', color: 'bg-sky-500', section: 'Attacking Play' },
  { label: 'Cutbacks', homeKey: 'homeCutbacks', awayKey: 'awayCutbacks', color: 'bg-indigo-500', section: 'Attacking Play' },
  { label: 'Penetration Passes', homeKey: 'homePenetrationPasses', awayKey: 'awayPenetrationPasses', color: 'bg-violet-500', section: 'Attacking Play' },
  { label: 'Touches in Box', homeKey: 'homeTouchesInBox', awayKey: 'awayTouchesInBox', color: 'bg-pink-500', section: 'Attacking Play' },
  { label: 'Fouls Committed', homeKey: 'homeFouls', awayKey: 'awayFouls', color: 'bg-red-500', section: 'Discipline' },
  { label: 'Yellow Cards', homeKey: 'homeYellows', awayKey: 'awayYellows', color: 'bg-yellow-500', section: 'Discipline' },
  { label: 'Aerial Duels Won', homeKey: 'homeAerialDuelsWon', awayKey: 'awayAerialDuelsWon', color: 'bg-cyan-500', section: 'Duels' },
  { label: 'Ground Duels Won', homeKey: 'homeGroundDuelsWon', awayKey: 'awayGroundDuelsWon', color: 'bg-teal-500', section: 'Duels' },
  { label: 'GK Saves', homeKey: 'homeGkSaves', awayKey: 'awayGkSaves', color: 'bg-fuchsia-500', section: 'Goalkeeping' },
  { label: '1 v 1', homeKey: 'homeOneVOne', awayKey: 'awayOneVOne', color: 'bg-rose-500', section: 'Goalkeeping' },
];

function sanitiseEvent(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

export default function LiveMatchPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeLive, setActiveLive] = useState<LiveMatch | null>(null);
  const [eventDialog, setEventDialog] = useState<'goal' | 'card' | 'sub' | 'stats' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const currentMinute = Math.floor(elapsedSeconds / 60);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: clubMatches } = useCollection<ClubMatch>(matchesQuery);

  const liveMatchQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'live_matches'), where('clubId', '==', clubId), where('status', 'in', ['live', 'halftime', 'scheduled'])) : null
  ), [firestore, clubId]);
  const { data: liveMatches } = useCollection<LiveMatch>(liveMatchQuery);

  const eventsQuery = useMemoFirebase(() => (
    firestore && activeLive ? query(collection(firestore, 'live_match_events'), where('matchId', '==', activeLive.id), orderBy('minute', 'asc')) : null
  ), [firestore, activeLive?.id]);
  const { data: events } = useCollection<LiveMatchEvent>(eventsQuery);

  // Fetch all squad athlete phones for SMS broadcasts
  const connectionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
  ), [firestore, clubId]);
  const { data: squadConnections } = useCollection<ScoutConnection>(connectionsQuery);

  const squadAthleteIds = useMemo(() => [...new Set(squadConnections?.map(c => c.athleteId) || [])], [squadConnections]);

  const squadAthletesQuery = useMemoFirebase(() => (
    firestore && squadAthleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', squadAthleteIds)) : null
  ), [firestore, squadAthleteIds.join(',')]);
  const { data: squadAthletes } = useCollection<AthleteProfile>(squadAthletesQuery);

  const squadPhones = useMemo(() =>
    (squadAthletes || []).map(a => (a as any).phone).filter(Boolean),
  [squadAthletes]);

  useEffect(() => {
    if (liveMatches && liveMatches.length > 0) {
      setActiveLive(liveMatches[0]);
    }
  }, [liveMatches]);

  // Restore elapsed time from Firestore startedAt on page load / match load
  useEffect(() => {
    if (!activeLive) return;
    if (activeLive.status === 'halftime') {
      setElapsedSeconds(45 * 60);
      setIsRunning(false);
      return;
    }
    if (activeLive.status === 'fulltime') {
      setElapsedSeconds(90 * 60);
      setIsRunning(false);
      return;
    }
    if (activeLive.status === 'live' && activeLive.startedAt) {
      const started = new Date(activeLive.startedAt).getTime();
      const now = Date.now();
      const secs = Math.floor((now - started) / 1000);
      setElapsedSeconds(Math.max(0, secs));
      setIsRunning(true);
    }
  }, [activeLive?.id]);

  // Live 1-second tick
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // Sync current minute to Firestore every 60 seconds while running
  useEffect(() => {
    if (!isRunning || !firestore || !activeLive) return;
    if (elapsedSeconds > 0 && elapsedSeconds % 60 === 0) {
      updateDoc(doc(firestore, 'live_matches', activeLive.id), {
        currentMinute: Math.floor(elapsedSeconds / 60),
      }).catch(() => {});
    }
  }, [elapsedSeconds, isRunning]);

  const [newMatch, setNewMatch] = useState({ homeTeam: '', awayTeam: '', clubMatchId: '' });
  const [refereeForm, setRefereeForm] = useState<LiveMatchRefereeDetails>({
    centreReferee: '', assistantReferee1: '', assistantReferee2: '', matchCommissioner: '',
  });

  const [goalForm, setGoalForm] = useState({
    playerName: '', assistPlayerName: '', minute: currentMinute,
    team: 'home' as 'home' | 'away', goalType: 'open_play' as LiveMatchEvent['goalType'],
    goalBodyPart: 'right_foot' as LiveMatchEvent['goalBodyPart'],
    goalDistance: 0, offsideFlag: false,
  });

  const [cardForm, setCardForm] = useState({
    playerName: '', minute: currentMinute,
    team: 'home' as 'home' | 'away',
    type: 'yellow_card' as 'yellow_card' | 'red_card', cardReason: '',
  });

  const [subForm, setSubForm] = useState({
    offPlayerName: '', onPlayerName: '', minute: currentMinute,
    team: 'home' as 'home' | 'away', substitutionReason: '',
  });

  const [statsForm, setStatsForm] = useState<LiveMatchStatSnapshot>({ ...EMPTY_STATS });

  const setStatField = (key: keyof LiveMatchStatSnapshot, value: number) => {
    setStatsForm(prev => ({ ...prev, [key]: value }));
  };

  const startMatch = async () => {
    if (!firestore || !clubId || !newMatch.homeTeam || !newMatch.awayTeam) return;
    setIsSaving(true);
    try {
      const refDetails: LiveMatchRefereeDetails = {
        centreReferee: refereeForm.centreReferee || undefined,
        assistantReferee1: refereeForm.assistantReferee1 || undefined,
        assistantReferee2: refereeForm.assistantReferee2 || undefined,
        matchCommissioner: refereeForm.matchCommissioner || undefined,
      };
      const liveMatchRef = doc(collection(firestore, 'live_matches'));
      const liveMatchData: Omit<LiveMatch, 'id'> = {
        clubId, homeTeam: newMatch.homeTeam, awayTeam: newMatch.awayTeam,
        homeScore: 0, awayScore: 0, status: 'live', currentMinute: 0,
        clubMatchId: newMatch.clubMatchId || undefined,
        refereeDetails: refDetails,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await setDoc(liveMatchRef, { id: liveMatchRef.id, ...liveMatchData });
      await addDoc(collection(firestore, 'live_match_events'), {
        id: crypto.randomUUID(), matchId: liveMatchRef.id, type: 'kickoff',
        minute: 0, team: 'home', createdAt: new Date().toISOString(),
      });
      setActiveLive({ id: liveMatchRef.id, ...liveMatchData });
      setIsRunning(true);
      setElapsedSeconds(0);
      toast({ title: 'Match Started', description: 'Live tracking is now active.' });

      // SMS all squad athletes — kickoff alert
      if (squadPhones.length > 0) {
        smsSend('match-broadcast', {
          phones: squadPhones,
          message: `KICK OFF: ${newMatch.homeTeam} vs ${newMatch.awayTeam} — Match is underway! Follow live on Talent Graph.`,
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to start match' });
    } finally {
      setIsSaving(false);
    }
  };

  const logGoal = async () => {
    if (!firestore || !activeLive) return;
    setIsSaving(true);
    try {
      const isHome = goalForm.team === 'home';
      const newHomeScore = isHome ? activeLive.homeScore + 1 : activeLive.homeScore;
      const newAwayScore = isHome ? activeLive.awayScore : activeLive.awayScore + 1;
      await addDoc(collection(firestore, 'live_match_events'), sanitiseEvent({
        matchId: activeLive.id, type: 'goal',
        minute: goalForm.minute, team: goalForm.team,
        playerName: goalForm.playerName || undefined,
        assistPlayerName: goalForm.assistPlayerName || undefined,
        goalType: goalForm.goalType || undefined,
        goalBodyPart: goalForm.goalBodyPart || undefined,
        goalDistance: goalForm.goalDistance || undefined,
        offsideFlag: goalForm.offsideFlag,
        statSnapshot: { homeGoals: newHomeScore, awayGoals: newAwayScore },
        createdAt: new Date().toISOString(),
      }));
      await updateDoc(doc(firestore, 'live_matches', activeLive.id), {
        homeScore: newHomeScore, awayScore: newAwayScore, currentMinute: goalForm.minute,
      });
      setActiveLive({ ...activeLive, homeScore: newHomeScore, awayScore: newAwayScore });
      toast({ title: 'Goal Logged', description: `${goalForm.playerName} — ${goalForm.minute}'` });

      if (clubId) {
        const scorer = goalForm.playerName || 'Unknown';
        const assist = goalForm.assistPlayerName ? ` (assist: ${goalForm.assistPlayerName})` : '';
        sendClubNotification({
          clubId,
          title: `⚽ GOAL — ${goalForm.minute}'`,
          body: `${scorer}${assist} • ${newHomeScore}–${newAwayScore}`,
          url: '/club-dashboard/live-match',
          tag: 'live-match-goal',
          firestore,
        });
      }

      // SMS scouts subscribed to this match
      smsSend('live-goal', {
        scoutPhones: (activeLive as any).subscribedScoutPhones ?? [],
        scorer: goalForm.playerName || 'Unknown',
        minute: goalForm.minute,
        homeTeam: activeLive.homeTeam,
        awayTeam: activeLive.awayTeam,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
      });

      // SMS all squad athletes — goal alert
      if (squadPhones.length > 0) {
        const assist = goalForm.assistPlayerName ? ` (assist: ${goalForm.assistPlayerName})` : '';
        smsSend('match-broadcast', {
          phones: squadPhones,
          message: `GOAL ${goalForm.minute}' — ${goalForm.playerName}${assist} | ${activeLive.homeTeam} ${newHomeScore}–${newAwayScore} ${activeLive.awayTeam} [Talent Graph Live]`,
        });
      }

      setEventDialog(null);
      setGoalForm(f => ({ ...f, playerName: '', assistPlayerName: '', goalDistance: 0, offsideFlag: false }));
    } catch {
      toast({ variant: 'destructive', title: 'Failed to log goal' });
    } finally {
      setIsSaving(false);
    }
  };

  const logCard = async () => {
    if (!firestore || !activeLive) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'live_match_events'), sanitiseEvent({
        matchId: activeLive.id, type: cardForm.type,
        minute: cardForm.minute, team: cardForm.team,
        playerName: cardForm.playerName || undefined,
        cardReason: cardForm.cardReason || undefined,
        createdAt: new Date().toISOString(),
      }));
      toast({ title: `${cardForm.type === 'yellow_card' ? 'Yellow' : 'Red'} Card`, description: `${cardForm.playerName} — ${cardForm.minute}'` });
      setEventDialog(null);
      setCardForm(f => ({ ...f, playerName: '', cardReason: '' }));
    } catch {
      toast({ variant: 'destructive', title: 'Failed to log card' });
    } finally {
      setIsSaving(false);
    }
  };

  const logSub = async () => {
    if (!firestore || !activeLive || !subForm.offPlayerName || !subForm.onPlayerName) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'live_match_events'), sanitiseEvent({
        matchId: activeLive.id, type: 'substitution',
        minute: subForm.minute, team: subForm.team,
        offPlayerName: subForm.offPlayerName || undefined,
        onPlayerName: subForm.onPlayerName || undefined,
        substitutionReason: subForm.substitutionReason || undefined,
        createdAt: new Date().toISOString(),
      }));
      toast({ title: 'Substitution', description: `Off: ${subForm.offPlayerName} / On: ${subForm.onPlayerName}` });
      setEventDialog(null);
      setSubForm(f => ({ ...f, offPlayerName: '', onPlayerName: '', substitutionReason: '' }));
    } catch {
      toast({ variant: 'destructive', title: 'Failed to log substitution' });
    } finally {
      setIsSaving(false);
    }
  };

  const logStats = async (type: 'halftime' | 'fulltime') => {
    if (!firestore || !activeLive) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'live_match_events'), {
        id: crypto.randomUUID(), matchId: activeLive.id, type,
        minute: type === 'halftime' ? 45 : 90, team: 'home',
        statSnapshot: { ...statsForm },
        createdAt: new Date().toISOString(),
      });
      const newStatus = type === 'halftime' ? 'halftime' : 'fulltime';
      await updateDoc(doc(firestore, 'live_matches', activeLive.id), {
        status: newStatus, currentMinute: type === 'halftime' ? 45 : 90,
      });
      setActiveLive({ ...activeLive, status: newStatus });
      if (type === 'fulltime') setIsRunning(false);
      toast({ title: type === 'halftime' ? 'Half Time' : 'Full Time', description: 'Full stats snapshot saved.' });

      // SMS all squad athletes — halftime / fulltime alert
      if (squadPhones.length > 0) {
        const label = type === 'halftime' ? 'HALF TIME' : 'FULL TIME';
        smsSend('match-broadcast', {
          phones: squadPhones,
          message: `${label}: ${activeLive.homeTeam} ${activeLive.homeScore}–${activeLive.awayScore} ${activeLive.awayTeam} [Talent Graph]`,
        });
      }

      setEventDialog(null);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save stats' });
    } finally {
      setIsSaving(false);
    }
  };

  const openGoalForm = () => { setGoalForm(f => ({ ...f, minute: currentMinute })); setEventDialog('goal'); };
  const openCardForm = () => { setCardForm(f => ({ ...f, minute: currentMinute })); setEventDialog('card'); };
  const openSubForm = () => { setSubForm(f => ({ ...f, minute: currentMinute })); setEventDialog('sub'); };
  const openStatsForm = () => setEventDialog('stats');

  const lastStats = [...(events || [])].reverse().find(e => e.statSnapshot);
  const s = lastStats?.statSnapshot;

  const ref = activeLive?.refereeDetails;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radio className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Live Match Tracker</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Real-time event & statistics logging</p>
        </div>
      </div>

      {!activeLive ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <Card className="border-none shadow-2xl bg-background overflow-hidden">
              <CardHeader className="bg-neutral-900 text-white">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" /> Start New Live Match
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Home Team</Label>
                    <Input value={newMatch.homeTeam} onChange={e => setNewMatch({ ...newMatch, homeTeam: e.target.value })} placeholder="Your club name" className="font-bold h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Away Team</Label>
                    <Input value={newMatch.awayTeam} onChange={e => setNewMatch({ ...newMatch, awayTeam: e.target.value })} placeholder="Opponent name" className="font-bold h-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link to Fixture (Optional)</Label>
                  <Select value={newMatch.clubMatchId || ''} onValueChange={v => setNewMatch({ ...newMatch, clubMatchId: v })}>
                    <SelectTrigger className="h-10 font-bold"><SelectValue placeholder="Select existing fixture" /></SelectTrigger>
                    <SelectContent>
                      {clubMatches?.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.opponent} — {m.date} ({m.competition})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={startMatch} disabled={isSaving || !newMatch.homeTeam || !newMatch.awayTeam} className="w-full h-12 font-black uppercase tracking-widest gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Kick Off
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-background overflow-hidden">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Match Officials
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Optional — record referee details for this match</p>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Centre Referee</Label>
                  <Input value={refereeForm.centreReferee || ''} onChange={e => setRefereeForm(f => ({ ...f, centreReferee: e.target.value }))} placeholder="Full name" className="font-bold h-9" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assistant Referee 1</Label>
                    <Input value={refereeForm.assistantReferee1 || ''} onChange={e => setRefereeForm(f => ({ ...f, assistantReferee1: e.target.value }))} placeholder="Full name" className="font-bold h-9" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assistant Referee 2</Label>
                    <Input value={refereeForm.assistantReferee2 || ''} onChange={e => setRefereeForm(f => ({ ...f, assistantReferee2: e.target.value }))} placeholder="Full name" className="font-bold h-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Match Commissioner</Label>
                  <Input value={refereeForm.matchCommissioner || ''} onChange={e => setRefereeForm(f => ({ ...f, matchCommissioner: e.target.value }))} placeholder="Full name" className="font-bold h-9" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">How It Works</h3>
            {[
              { step: '01', title: 'Setup Match', desc: 'Enter team names, link to a fixture, and record match officials.' },
              { step: '02', title: 'Log Events', desc: 'Record goals (scorer, assist, type, body part, distance, offside), cards (with reasons), and substitutions in real time.' },
              { step: '03', title: 'Snapshot Stats', desc: 'Capture halftime and fulltime stats: shots on/off target, corners, free kicks, crosses, cutbacks, penetration passes, fouls, duels (aerial & ground), GK saves, 1v1, and possession.' },
              { step: '04', title: 'Full Timeline', desc: 'A chronological event feed is built automatically as events are logged.' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border">
                <span className="text-2xl font-black text-primary/30">{item.step}</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scoreboard */}
          <div className="bg-neutral-950 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`w-2.5 h-2.5 rounded-full ${activeLive.status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-neutral-500'}`} />
                <Badge className={`font-black uppercase text-[9px] tracking-widest ${activeLive.status === 'live' ? 'bg-red-600' : activeLive.status === 'halftime' ? 'bg-yellow-600' : 'bg-neutral-600'}`}>
                  {activeLive.status === 'live' ? 'LIVE' : activeLive.status === 'halftime' ? 'HALF TIME' : activeLive.status.toUpperCase()}
                </Badge>
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest tabular-nums">
                  {String(currentMinute).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
              </div>
              <Button size="sm" variant={isRunning ? 'destructive' : 'secondary'} onClick={() => setIsRunning(!isRunning)} className="h-8 font-black text-[9px] uppercase gap-1">
                {isRunning ? <><Square className="w-3 h-3" /> Pause Timer</> : <><Play className="w-3 h-3" /> Resume</>}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">HOME</p>
                <p className="text-2xl font-black truncate">{activeLive.homeTeam}</p>
              </div>
              <div className="text-center px-6 lg:px-8">
                <div className="text-6xl lg:text-7xl font-black tracking-tighter leading-none">
                  {activeLive.homeScore} <span className="text-neutral-600">–</span> {activeLive.awayScore}
                </div>
              </div>
              <div className="text-center flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">AWAY</p>
                <p className="text-2xl font-black truncate">{activeLive.awayTeam}</p>
              </div>
            </div>

            {/* Referee strip */}
            {ref && (ref.centreReferee || ref.assistantReferee1 || ref.assistantReferee2 || ref.matchCommissioner) && (
              <div className="mt-5 pt-5 border-t border-neutral-800 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {ref.centreReferee && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Centre Referee</p>
                    <p className="text-[11px] font-bold text-neutral-300 mt-0.5">{ref.centreReferee}</p>
                  </div>
                )}
                {ref.assistantReferee1 && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">AR 1</p>
                    <p className="text-[11px] font-bold text-neutral-300 mt-0.5">{ref.assistantReferee1}</p>
                  </div>
                )}
                {ref.assistantReferee2 && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">AR 2</p>
                    <p className="text-[11px] font-bold text-neutral-300 mt-0.5">{ref.assistantReferee2}</p>
                  </div>
                )}
                {ref.matchCommissioner && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Match Commissioner</p>
                    <p className="text-[11px] font-bold text-neutral-300 mt-0.5">{ref.matchCommissioner}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-neutral-800 flex-wrap">
              <Button onClick={openGoalForm} className="bg-green-600 hover:bg-green-700 font-black uppercase text-[10px] tracking-widest h-10 gap-2">
                <span>⚽</span> Log Goal
              </Button>
              <Button onClick={openCardForm} className="bg-yellow-600 hover:bg-yellow-700 font-black uppercase text-[10px] tracking-widest h-10 gap-2">
                <span>🟨</span> Card
              </Button>
              <Button onClick={openSubForm} className="bg-blue-600 hover:bg-blue-700 font-black uppercase text-[10px] tracking-widest h-10 gap-2">
                <span>🔄</span> Sub
              </Button>
              <Button onClick={openStatsForm} variant="outline" className="border-neutral-700 text-white hover:bg-neutral-800 font-black uppercase text-[10px] tracking-widest h-10 gap-2">
                <BarChart3 className="w-4 h-4" /> Stats Snapshot
              </Button>
            </div>
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              <Button onClick={() => logStats('halftime')} size="sm" variant="ghost" className="text-neutral-400 font-black uppercase text-[9px] tracking-widest h-8 gap-1">
                <Pause className="w-3 h-3" /> Half Time
              </Button>
              <Button onClick={() => logStats('fulltime')} size="sm" variant="ghost" className="text-neutral-400 font-black uppercase text-[9px] tracking-widest h-8 gap-1">
                <Flag className="w-3 h-3" /> Full Time
              </Button>
            </div>
          </div>

          {/* Timeline + Stats */}
          <Tabs defaultValue="stats">
            <TabsList className="w-full">
              <TabsTrigger value="stats" className="flex-1 font-black uppercase text-[10px] tracking-widest">Match Stats</TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1 font-black uppercase text-[10px] tracking-widest">Event Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="stats">
              <Card className="border-none shadow-lg bg-background overflow-hidden">
                <CardHeader className="bg-muted/50 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> Live Team Statistics
                    </CardTitle>
                    {lastStats && (
                      <Badge variant="outline" className="text-[8px] font-black uppercase">
                        {lastStats.type === 'halftime' ? 'HT Snapshot' : lastStats.type === 'fulltime' ? 'FT Snapshot' : 'Last Update'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 lg:p-6">
                  {!s ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No stats snapshot yet</p>
                      <p className="text-xs mt-1 opacity-30">Use "Stats Snapshot" to record team stats</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 pb-3 border-b mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-center truncate">{activeLive.homeTeam}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-center text-muted-foreground w-32">Stat</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-center truncate">{activeLive.awayTeam}</p>
                      </div>
                      {STAT_ROWS.map(row => {
                        const home = (s[row.homeKey] as number) ?? 0;
                        const away = (s[row.awayKey] as number) ?? 0;
                        return (
                          <StatBar key={row.label} label={row.label} home={home} away={away} max={Math.max(home + away, 1)} color={row.color} />
                        );
                      })}
                      {/* Possession */}
                      {s.homePossession !== undefined && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <span className="text-foreground font-black">{s.homePossession}%</span>
                            <span>Possession</span>
                            <span className="text-foreground font-black">{100 - s.homePossession}%</span>
                          </div>
                          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
                            <div className="h-full bg-primary transition-all" style={{ width: `${s.homePossession}%` }} />
                            <div className="h-full bg-neutral-400 transition-all" style={{ width: `${100 - s.homePossession}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card className="border-none shadow-lg bg-background overflow-hidden">
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Event Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    {(!events || events.length === 0) && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No events logged yet</p>
                      </div>
                    )}
                    {[...(events || [])].reverse().map(ev => {
                      const meta = EVENT_ICONS[ev.type] || EVENT_ICONS.kickoff;
                      return (
                        <div key={ev.id} className={`flex items-start gap-4 p-4 border-b ${meta.bg} border-l-4`} style={{ borderLeftColor: undefined }}>
                          <div className="shrink-0 text-center min-w-[36px]">
                            <span className="text-xl">{meta.icon}</span>
                            <p className="text-[9px] font-black text-muted-foreground">{ev.minute}'</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[10px] font-black uppercase tracking-widest">{ev.type.replace(/_/g, ' ')}</p>
                              <Badge variant="outline" className="text-[8px] font-black uppercase">{ev.team}</Badge>
                            </div>
                            {ev.playerName && <p className="text-sm font-bold mt-0.5">{ev.playerName}</p>}
                            {ev.assistPlayerName && <p className="text-[10px] text-muted-foreground">Assist: {ev.assistPlayerName}</p>}
                            {ev.goalType && (
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {ev.goalType.replace(/_/g, ' ')} • {ev.goalBodyPart?.replace(/_/g, ' ')}
                                {ev.goalDistance ? ` • ${ev.goalDistance}m` : ''}{ev.offsideFlag ? ' • OFFSIDE' : ''}
                              </p>
                            )}
                            {ev.cardReason && <p className="text-[10px] text-muted-foreground">Reason: {ev.cardReason}</p>}
                            {ev.offPlayerName && <p className="text-[10px] text-muted-foreground">Off: {ev.offPlayerName} / On: {ev.onPlayerName}</p>}
                            {ev.substitutionReason && <p className="text-[10px] text-muted-foreground">Reason: {ev.substitutionReason}</p>}
                            {ev.statSnapshot && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Score: {ev.statSnapshot.homeGoals}–{ev.statSnapshot.awayGoals}
                                {ev.statSnapshot.homePossession !== undefined && ` • Poss: ${ev.statSnapshot.homePossession}%–${100 - ev.statSnapshot.homePossession}%`}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Goal Dialog */}
      <Dialog open={eventDialog === 'goal'} onOpenChange={open => !open && setEventDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2">⚽ Log Goal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team</Label>
                <Select value={goalForm.team} onValueChange={(v: any) => setGoalForm({ ...goalForm, team: v })}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home — {activeLive?.homeTeam}</SelectItem>
                    <SelectItem value="away">Away — {activeLive?.awayTeam}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minute</Label>
                <Input type="number" value={goalForm.minute} onChange={e => setGoalForm({ ...goalForm, minute: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scorer</Label>
              <Input value={goalForm.playerName} onChange={e => setGoalForm({ ...goalForm, playerName: e.target.value })} placeholder="Player name" className="font-bold h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assist (Optional)</Label>
              <Input value={goalForm.assistPlayerName} onChange={e => setGoalForm({ ...goalForm, assistPlayerName: e.target.value })} placeholder="Assisting player" className="font-bold h-9" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goal Type</Label>
                <Select value={goalForm.goalType || 'open_play'} onValueChange={(v: any) => setGoalForm({ ...goalForm, goalType: v })}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open_play">Open Play</SelectItem>
                    <SelectItem value="penalty">Penalty</SelectItem>
                    <SelectItem value="free_kick">Free Kick</SelectItem>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="own_goal">Own Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Body Part</Label>
                <Select value={goalForm.goalBodyPart || 'right_foot'} onValueChange={(v: any) => setGoalForm({ ...goalForm, goalBodyPart: v })}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right_foot">Right Foot</SelectItem>
                    <SelectItem value="left_foot">Left Foot</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Distance (metres)</Label>
                <Input type="number" min={0} value={goalForm.goalDistance} onChange={e => setGoalForm({ ...goalForm, goalDistance: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={goalForm.offsideFlag} onCheckedChange={v => setGoalForm({ ...goalForm, offsideFlag: v })} />
                <Label className="text-[10px] font-black uppercase tracking-widest text-red-600">Offside Flag</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialog(null)}>Cancel</Button>
            <Button onClick={logGoal} disabled={isSaving || !goalForm.playerName} className="bg-green-600 hover:bg-green-700 font-black uppercase gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '⚽'} Confirm Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Dialog */}
      <Dialog open={eventDialog === 'card'} onOpenChange={open => !open && setEventDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest">Log Card</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Card Type</Label>
                <Select value={cardForm.type} onValueChange={(v: any) => setCardForm({ ...cardForm, type: v })}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yellow_card">🟨 Yellow Card</SelectItem>
                    <SelectItem value="red_card">🟥 Red Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minute</Label>
                <Input type="number" value={cardForm.minute} onChange={e => setCardForm({ ...cardForm, minute: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team</Label>
              <Select value={cardForm.team} onValueChange={(v: any) => setCardForm({ ...cardForm, team: v })}>
                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home — {activeLive?.homeTeam}</SelectItem>
                  <SelectItem value="away">Away — {activeLive?.awayTeam}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Player Name</Label>
              <Input value={cardForm.playerName} onChange={e => setCardForm({ ...cardForm, playerName: e.target.value })} placeholder="Player name" className="font-bold h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason</Label>
              <Textarea value={cardForm.cardReason} onChange={e => setCardForm({ ...cardForm, cardReason: e.target.value })} placeholder="e.g. Dangerous foul, Dissent, Simulation..." className="font-bold resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialog(null)}>Cancel</Button>
            <Button onClick={logCard} disabled={isSaving || !cardForm.playerName} className={`font-black uppercase gap-2 ${cardForm.type === 'red_card' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : cardForm.type === 'red_card' ? '🟥' : '🟨'} Log Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={eventDialog === 'sub'} onOpenChange={open => !open && setEventDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest">🔄 Substitution</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team</Label>
                <Select value={subForm.team} onValueChange={(v: any) => setSubForm({ ...subForm, team: v })}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home — {activeLive?.homeTeam}</SelectItem>
                    <SelectItem value="away">Away — {activeLive?.awayTeam}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minute</Label>
                <Input type="number" value={subForm.minute} onChange={e => setSubForm({ ...subForm, minute: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-red-500">Player Coming OFF</Label>
              <Input value={subForm.offPlayerName} onChange={e => setSubForm({ ...subForm, offPlayerName: e.target.value })} placeholder="Player leaving the field" className="font-bold h-9 border-red-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-green-600">Player Coming ON</Label>
              <Input value={subForm.onPlayerName} onChange={e => setSubForm({ ...subForm, onPlayerName: e.target.value })} placeholder="Player entering the field" className="font-bold h-9 border-green-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason (Optional)</Label>
              <Textarea value={subForm.substitutionReason} onChange={e => setSubForm({ ...subForm, substitutionReason: e.target.value })} placeholder="e.g. Tactical, Injury, Fatigue..." className="font-bold resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialog(null)}>Cancel</Button>
            <Button onClick={logSub} disabled={isSaving || !subForm.offPlayerName || !subForm.onPlayerName} className="bg-blue-600 hover:bg-blue-700 font-black uppercase gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔄'} Log Substitution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Snapshot Dialog */}
      <Dialog open={eventDialog === 'stats'} onOpenChange={open => !open && setEventDialog(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Stats Snapshot
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground">Record team totals for halftime or full time.</p>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 py-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center pb-1 border-b">
                <p className="text-[10px] font-black uppercase tracking-widest text-center truncate">{activeLive?.homeTeam || 'Home'}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-center text-muted-foreground w-36">Stat</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-center truncate">{activeLive?.awayTeam || 'Away'}</p>
              </div>

              {/* Grouped stats */}
              {[
                { section: 'Scoring', rows: STAT_ROWS.filter(r => r.section === 'Scoring') },
                { section: 'Shooting', rows: STAT_ROWS.filter(r => r.section === 'Shooting') },
                { section: 'Set Pieces', rows: STAT_ROWS.filter(r => r.section === 'Set Pieces') },
                { section: 'Attacking Play', rows: STAT_ROWS.filter(r => r.section === 'Attacking Play') },
                { section: 'Discipline', rows: STAT_ROWS.filter(r => r.section === 'Discipline') },
                { section: 'Duels', rows: STAT_ROWS.filter(r => r.section === 'Duels') },
                { section: 'Goalkeeping', rows: STAT_ROWS.filter(r => r.section === 'Goalkeeping') },
              ].map(group => (
                <div key={group.section} className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-1">{group.section}</p>
                  {group.rows.map(row => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <Input
                        type="number" min={0}
                        value={(statsForm[row.homeKey] as number) ?? 0}
                        onChange={e => setStatField(row.homeKey, Number(e.target.value))}
                        className="font-black text-center h-9"
                      />
                      <p className="text-[9px] font-black uppercase tracking-widest text-center text-muted-foreground w-36 leading-tight">{row.label}</p>
                      <Input
                        type="number" min={0}
                        value={(statsForm[row.awayKey] as number) ?? 0}
                        onChange={e => setStatField(row.awayKey, Number(e.target.value))}
                        className="font-black text-center h-9"
                      />
                    </div>
                  ))}
                </div>
              ))}

              {/* Possession */}
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-1">Possession</p>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Home Possession % (0–100)</Label>
                  <Input type="number" min={0} max={100} value={statsForm.homePossession} onChange={e => setStatField('homePossession', Number(e.target.value))} className="font-bold h-9" />
                  <p className="text-[9px] text-muted-foreground">Away will be calculated automatically: {100 - (statsForm.homePossession ?? 50)}%</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t mt-2 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEventDialog(null)}>Cancel</Button>
            <Button onClick={() => logStats('halftime')} disabled={isSaving} variant="outline" className="font-black uppercase text-[10px] gap-1">
              <Pause className="w-3 h-3" /> Save as Halftime
            </Button>
            <Button onClick={() => logStats('fulltime')} disabled={isSaving} className="font-black uppercase text-[10px] gap-1">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-3 h-3" />} Save as Full Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBar({ label, home, away, max, color = 'bg-primary' }: { label: string; home: number; away: number; max: number; color?: string }) {
  const homeWidth = max > 0 ? (home / max) * 50 : 0;
  const awayWidth = max > 0 ? (away / max) * 50 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground font-black w-6 text-right">{home}</span>
        <span className="text-center flex-1 px-2 leading-tight">{label}</span>
        <span className="text-foreground font-black w-6 text-left">{away}</span>
      </div>
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted">
        <div className="h-full flex justify-end" style={{ width: '50%' }}>
          <div className={`h-full ${color} transition-all rounded-l-full`} style={{ width: `${homeWidth * 2}%` }} />
        </div>
        <div className="h-full flex justify-start" style={{ width: '50%' }}>
          <div className={`h-full ${color} opacity-50 transition-all rounded-r-full`} style={{ width: `${awayWidth * 2}%` }} />
        </div>
      </div>
    </div>
  );
}
