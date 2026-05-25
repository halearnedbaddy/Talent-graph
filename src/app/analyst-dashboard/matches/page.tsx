'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2, Trophy, Plus, Calendar, MapPin, ChevronLeft, ChevronRight,
  CheckCircle2, Star, Users, BarChart3, AlertCircle, UserCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';
import type { UserAccount } from '@/lib/types';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const CATEGORIES = ['league', 'cup', 'friendly', 'national', 'other'];
const RESULTS = ['W', 'D', 'L'] as const;
const STEP_LABELS = ['Match Details', 'Select Squad', 'Team Stats', 'Player Stats'];

type PlayerStat = {
  athleteId: string;
  name: string;
  position: string;
  photoUrl?: string;
  played: boolean;
  goals: number;
  assists: number;
  shots: number;
  duelsWon: number;
  fouls: number;
  saves: number;
  rating: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  cleanSheet: boolean;
  manOfTheMatch: boolean;
};

type MatchDetails = {
  opponent: string;
  competition: string;
  category: string;
  date: string;
  location: string;
  venue: string;
  result: '' | 'W' | 'L' | 'D';
  score: string;
  halfTimeScore: string;
};

type TeamStats = {
  shotsOnTarget: string;
  shotsOffTarget: string;
  corners: string;
  fouls: string;
  yellowCards: string;
  redCards: string;
  possession: string;
  attendance: string;
  matchReport: string;
};

const EMPTY_DETAILS: MatchDetails = {
  opponent: '', competition: '', category: 'league',
  date: new Date().toISOString().slice(0, 10),
  location: '', venue: '', result: '', score: '', halfTimeScore: '',
};

const EMPTY_TEAM: TeamStats = {
  shotsOnTarget: '', shotsOffTarget: '', corners: '', fouls: '',
  yellowCards: '', redCards: '', possession: '', attendance: '', matchReport: '',
};

export default function AnalystMatchesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<MatchDetails>({ ...EMPTY_DETAILS });
  const [teamStats, setTeamStats] = useState<TeamStats>({ ...EMPTY_TEAM });
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches, isLoading } = useCollection<any>(matchesQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId), where('clubStatus', '==', 'active')) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a: any, b: any) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [matches]);

  const initSquad = () => {
    if (!athletes) return;
    setPlayerStats(athletes.map(a => ({
      athleteId: a.uid,
      name: `${a.firstName} ${a.lastName}`,
      position: a.position ?? '',
      photoUrl: a.photoUrl,
      played: true,
      goals: 0, assists: 0, shots: 0, duelsWon: 0, fouls: 0, saves: 0,
      rating: 7, yellowCards: 0, redCards: 0, minutesPlayed: 90,
      cleanSheet: false, manOfTheMatch: false,
    })));
  };

  const handleNext = () => {
    if (step === 1) {
      // Only carry forward players who played
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    if (step === 0) { resetWizard(); return; }
    setStep(s => s - 1);
  };

  const resetWizard = () => {
    setShowWizard(false);
    setStep(0);
    setDetails({ ...EMPTY_DETAILS });
    setTeamStats({ ...EMPTY_TEAM });
    setPlayerStats([]);
  };

  const handleSaveMatch = async () => {
    if (!firestore || !clubId || !user) return;
    setSaving(true);
    try {
      const matchPayload = {
        clubId,
        opponent: details.opponent,
        competition: details.competition,
        category: details.category,
        date: details.date,
        location: details.location,
        venue: details.venue,
        result: details.result || undefined,
        score: details.score || undefined,
        halfTimeScore: details.halfTimeScore || undefined,
        shotsOnTarget: Number(teamStats.shotsOnTarget) || 0,
        shotsOffTarget: Number(teamStats.shotsOffTarget) || 0,
        corners: Number(teamStats.corners) || 0,
        possession: Number(teamStats.possession) || undefined,
        totalYellowCards: Number(teamStats.yellowCards) || 0,
        totalRedCards: Number(teamStats.redCards) || 0,
        attendance: Number(teamStats.attendance) || undefined,
        matchReport: teamStats.matchReport || undefined,
        enteredBy: user.uid,
        enteredByRole: 'analyst',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const matchRef = await addDoc(collection(firestore, 'matches'), matchPayload);

      // Push stats to each athlete who played
      const playedStats = playerStats.filter(ps => ps.played);
      for (const ps of playedStats) {
        try {
          const athleteRef = doc(firestore, 'athletes', ps.athleteId);
          const athleteSnap = await getDoc(athleteRef);
          if (!athleteSnap.exists()) continue;
          const athlete = athleteSnap.data() as AthleteProfile;

          const newEntry = {
            id: matchRef.id,
            competition: details.competition,
            category: details.category as any,
            opponent: details.opponent,
            apps: 1,
            minutes: ps.minutesPlayed,
            rating: ps.rating,
            goals: ps.goals,
            assists: ps.assists,
            shots: ps.shots,
            duelsWon: ps.duelsWon,
            fouls: ps.fouls,
            saves: ps.saves,
            yellowCards: ps.yellowCards,
            redCards: ps.redCards,
            cleanSheet: ps.cleanSheet,
            manOfTheMatch: ps.manOfTheMatch,
            isVerified: true,
            statsLogged: true,
            updatedAt: new Date().toISOString(),
            clubMatchId: matchRef.id,
          };

          const updatedHistory = [...(athlete.matchHistory ?? []), newEntry];

          // Recalculate CSI scores
          let scoreUpdates: Record<string, any> = {};
          try {
            const userSnap = await getDoc(doc(firestore, 'users', ps.athleteId));
            const userAccount = (userSnap.exists() ? userSnap.data() : {}) as UserAccount;
            scoreUpdates = calculateTalentGraphScore({ ...athlete, matchHistory: updatedHistory }, userAccount);
          } catch {
            // Score recalc failed — save stats without score update
          }

          await updateDoc(athleteRef, {
            matchHistory: updatedHistory,
            ...scoreUpdates,
            updatedAt: new Date().toISOString(),
          });

          // Create a pending confirmation so the athlete can verify/dispute their stats
          try {
            await addDoc(collection(firestore, 'match_confirmations'), {
              athleteId: ps.athleteId,
              matchId: matchRef.id,
              clubId,
              opponent: details.opponent,
              competition: details.competition,
              date: details.date,
              category: details.category,
              stats: {
                goals: ps.goals,
                assists: ps.assists,
                minutes: ps.minutesPlayed,
                rating: ps.rating,
                yellowCards: ps.yellowCards,
                redCards: ps.redCards,
                shots: ps.shots,
                duelsWon: ps.duelsWon,
                fouls: ps.fouls,
                saves: ps.saves,
                cleanSheet: ps.cleanSheet,
                manOfTheMatch: ps.manOfTheMatch,
              },
              status: 'pending',
              enteredBy: user.uid,
              enteredByRole: 'analyst',
              createdAt: new Date().toISOString(),
            });
          } catch {
            // Confirmation write failed silently — stats already saved
          }
        } catch (err) {
          console.error(`Failed to update athlete ${ps.athleteId}:`, err);
        }
      }

      toast({
        title: 'Match Saved ✓',
        description: `Match vs ${details.opponent} logged. ${playedStats.length} player profile${playedStats.length !== 1 ? 's' : ''} updated.`,
      });
      resetWizard();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not save match.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMOTM = (idx: number) => {
    setPlayerStats(prev => prev.map((p, i) => ({ ...p, manOfTheMatch: i === idx ? !p.manOfTheMatch : false })));
  };

  const updateStat = (idx: number, key: keyof PlayerStat, val: any) => {
    setPlayerStats(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };

  const resultStyle = (r: string) => ({
    W: 'bg-[#00C853]/15 text-[#00C853] border-[#00C853]/30',
    D: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
    L: 'bg-red-500/15 text-red-500 border-red-500/30',
  }[r] ?? 'bg-[#1C2333] text-[#94A3B8] border-transparent');

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>;
  }

  // ── WIZARD ────────────────────────────────────────────────────────────────
  if (showWizard) {
    const playingCount = playerStats.filter(p => p.played).length;

    return (
      <div className="space-y-5 max-w-2xl mx-auto pb-8">
        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black shrink-0 transition-all',
                i < step ? 'bg-[#00C853] text-black' : i === step ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]' : 'bg-[#1C2333] text-[#94A3B8]'
              )}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('text-[9px] font-black uppercase tracking-wide hidden sm:block', i === step ? 'text-[#00C853]' : 'text-[#94A3B8]')}>
                {label}
              </span>
              {i < 3 && <div className="flex-1 h-px bg-[#1E293B] mx-1" />}
            </div>
          ))}
        </div>

        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-black text-white uppercase tracking-wide">
              Step {step + 1}: {STEP_LABELS[step]}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">

            {/* ── STEP 0: Match Details ── */}
            {step === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Opponent *</Label>
                  <Input placeholder="e.g. Gor Mahia FC" value={details.opponent}
                    onChange={e => setDetails(d => ({ ...d, opponent: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Competition *</Label>
                  <Input placeholder="e.g. KPL 2025" value={details.competition}
                    onChange={e => setDetails(d => ({ ...d, competition: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Category</Label>
                  <Select value={details.category} onValueChange={v => setDetails(d => ({ ...d, category: v }))}>
                    <SelectTrigger className="bg-[#1C2333] border-[#1E293B] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-white capitalize font-bold">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Date *</Label>
                  <Input type="date" value={details.date}
                    onChange={e => setDetails(d => ({ ...d, date: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Result</Label>
                  <div className="flex gap-2">
                    {RESULTS.map(r => (
                      <button key={r} type="button"
                        onClick={() => setDetails(d => ({ ...d, result: d.result === r ? '' : r }))}
                        className={cn('flex-1 h-10 rounded-xl font-black text-sm border transition-all',
                          details.result === r
                            ? r === 'W' ? 'bg-[#00C853] text-black border-[#00C853]'
                              : r === 'L' ? 'bg-red-500 text-white border-red-500'
                                : 'bg-[#94A3B8] text-black border-[#94A3B8]'
                            : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#94A3B8]'
                        )}
                      >{r}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Final Score</Label>
                  <Input placeholder="e.g. 2-1" value={details.score}
                    onChange={e => setDetails(d => ({ ...d, score: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Half-Time Score</Label>
                  <Input placeholder="e.g. 1-0" value={details.halfTimeScore}
                    onChange={e => setDetails(d => ({ ...d, halfTimeScore: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Location</Label>
                  <Input placeholder="e.g. Nairobi" value={details.location}
                    onChange={e => setDetails(d => ({ ...d, location: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Venue</Label>
                  <Input placeholder="e.g. Kasarani Stadium" value={details.venue}
                    onChange={e => setDetails(d => ({ ...d, venue: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]" />
                </div>
              </div>
            )}

            {/* ── STEP 1: Select Squad ── */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[#94A3B8]">
                    Select the players who featured in this match. Untick anyone who didn't play.
                  </p>
                  <Badge className="bg-[#00C853]/20 text-[#00C853] border-[#00C853]/30 font-black text-[10px]">
                    {playingCount} playing
                  </Badge>
                </div>

                {!athletes || athletes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Users className="h-10 w-10 text-[#94A3B8] opacity-30" />
                    <p className="text-[#94A3B8] font-black text-sm">No active squad athletes</p>
                    <p className="text-[#94A3B8] text-xs">Athletes need to be active club members to appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {playerStats.map((ps, idx) => (
                      <button
                        key={ps.athleteId}
                        type="button"
                        onClick={() => updateStat(idx, 'played', !ps.played)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                          ps.played
                            ? 'bg-[#00C853]/5 border-[#00C853]/30'
                            : 'bg-[#1C2333] border-[#1E293B] opacity-50'
                        )}
                      >
                        <Avatar className="h-9 w-9 rounded-lg shrink-0">
                          <AvatarImage src={ps.photoUrl} />
                          <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                            {ps.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{ps.name}</p>
                          <p className="text-[9px] text-[#94A3B8] font-bold uppercase">{ps.position}</p>
                        </div>
                        <div className={cn(
                          'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                          ps.played ? 'border-[#00C853] bg-[#00C853]' : 'border-[#94A3B8] bg-transparent'
                        )}>
                          {ps.played && <CheckCircle2 className="h-3 w-3 text-black" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Team Stats ── */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'shotsOnTarget', label: 'Shots on Target' },
                    { key: 'shotsOffTarget', label: 'Shots off Target' },
                    { key: 'corners', label: 'Corners' },
                    { key: 'fouls', label: 'Fouls' },
                    { key: 'yellowCards', label: 'Yellow Cards' },
                    { key: 'redCards', label: 'Red Cards' },
                    { key: 'possession', label: 'Possession %' },
                    { key: 'attendance', label: 'Attendance' },
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-[10px] font-black text-[#94A3B8] uppercase">{f.label}</Label>
                      <Input
                        type="number" min="0"
                        value={(teamStats as any)[f.key]}
                        onChange={e => setTeamStats(s => ({ ...s, [f.key]: e.target.value }))}
                        className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
                      />
                    </div>
                  ))}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Analyst Match Report</Label>
                  <Textarea
                    placeholder="Key observations, tactical notes, standout performers..."
                    value={teamStats.matchReport}
                    onChange={e => setTeamStats(s => ({ ...s, matchReport: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 3: Player Stats ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#00C853]/5 border border-[#00C853]/20">
                  <UserCheck className="h-4 w-4 text-[#00C853] shrink-0" />
                  <p className="text-[11px] font-bold text-[#94A3B8]">
                    Stats entered here automatically reflect on each player's Talent Graph profile.
                    MOTM can only be awarded to one player.
                  </p>
                </div>

                {playerStats.filter(p => p.played).length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-10 w-10 text-[#94A3B8] mx-auto mb-2 opacity-30" />
                    <p className="text-[#94A3B8] font-black text-sm">No players selected</p>
                    <p className="text-[#94A3B8] text-xs mt-1">Go back and select which players featured.</p>
                  </div>
                ) : (
                  playerStats.filter(p => p.played).map((ps) => {
                    const idx = playerStats.findIndex(p => p.athleteId === ps.athleteId);
                    return (
                      <div key={ps.athleteId} className="p-4 rounded-xl bg-[#1C2333] border border-[#1E293B] space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 rounded-lg shrink-0">
                              <AvatarImage src={ps.photoUrl} />
                              <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                                {ps.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate">{ps.name}</p>
                              <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{ps.position}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleMOTM(idx)}
                            className={cn(
                              'flex items-center gap-1.5 text-[9px] font-black uppercase border px-2.5 py-1.5 rounded-xl transition-all shrink-0',
                              ps.manOfTheMatch
                                ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
                                : 'text-[#94A3B8] border-[#1E293B] hover:border-[#94A3B8]'
                            )}
                          >
                            <Star className="h-3 w-3" />
                            MOTM
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'goals', label: 'Goals', max: undefined },
                            { key: 'assists', label: 'Assists', max: undefined },
                            { key: 'shots', label: 'Shots', max: undefined },
                            { key: 'duelsWon', label: 'Duels Won', max: undefined },
                            { key: 'fouls', label: 'Fouls', max: undefined },
                            { key: 'saves', label: 'Saves', max: undefined },
                            { key: 'yellowCards', label: 'Yellows', max: 2 },
                            { key: 'redCards', label: 'Reds', max: 1 },
                            { key: 'minutesPlayed', label: 'Minutes', max: 120 },
                          ].map(f => (
                            <div key={f.key} className="space-y-0.5">
                              <Label className="text-[9px] font-black text-[#94A3B8] uppercase">{f.label}</Label>
                              <Input
                                type="number" min="0"
                                max={f.max}
                                value={(ps as any)[f.key]}
                                onChange={e => updateStat(idx, f.key as keyof PlayerStat, Number(e.target.value))}
                                className="bg-[#0A0E1A] border-[#1E293B] text-white text-sm focus:border-[#00C853] h-8"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Rating slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-black text-[#94A3B8] uppercase">Match Rating</Label>
                            <span className="text-[#00C853] font-black text-sm">{ps.rating.toFixed(1)}</span>
                          </div>
                          <input
                            type="range" min="1" max="10" step="0.1"
                            value={ps.rating}
                            onChange={e => updateStat(idx, 'rating', Number(e.target.value))}
                            className="w-full accent-[#00C853]"
                          />
                          <div className="flex justify-between text-[9px] text-[#94A3B8]">
                            <span>1.0 — Poor</span>
                            <span>5.5 — Average</span>
                            <span>10.0 — World Class</span>
                          </div>
                        </div>

                        {/* Clean sheet toggle (GKs / defenders mostly) */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0A0E1A]">
                          <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Clean Sheet</Label>
                          <button
                            type="button"
                            onClick={() => updateStat(idx, 'cleanSheet', !ps.cleanSheet)}
                            className={cn(
                              'w-10 h-5 rounded-full border transition-all relative',
                              ps.cleanSheet ? 'bg-[#00C853] border-[#00C853]' : 'bg-[#1C2333] border-[#1E293B]'
                            )}
                          >
                            <span className={cn(
                              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                              ps.cleanSheet ? 'left-5' : 'left-0.5'
                            )} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-[10px] uppercase gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 0) { initSquad(); }
                handleNext();
              }}
              disabled={step === 0 && (!details.opponent.trim() || !details.competition.trim())}
              className="flex-1 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSaveMatch}
              disabled={saving}
              className="flex-1 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save & Push to Profiles
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── MATCH LIST ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Match Data Entry</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            Log matches — stats push automatically to player profiles
          </p>
        </div>
        <Button
          onClick={() => { initSquad(); setShowWizard(true); }}
          className="self-start sm:self-auto bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-widest h-11 gap-2"
        >
          <Plus className="w-4 h-4" /> New Match
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#00C853]/5 border border-[#00C853]/20">
        <UserCheck className="h-4 w-4 text-[#00C853] shrink-0 mt-0.5" />
        <p className="text-[11px] font-bold text-muted-foreground">
          When you log a match, each selected player's goals, assists, minutes, rating and MOTM award are automatically pushed to their Talent Graph profile and recalculate their CSI score.
        </p>
      </div>

      {sortedMatches.length === 0 ? (
        <Card className="border-none shadow-xl bg-background">
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-black text-sm uppercase">No Matches Recorded</p>
            <p className="text-xs text-muted-foreground">Add your first match to start tracking performance and updating player profiles.</p>
            <Button
              onClick={() => { initSquad(); setShowWizard(true); }}
              className="mt-2 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Log First Match
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedMatches.map((m: any) => (
            <Card key={m.id} className="border-none shadow-md bg-background overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Badge className={`text-[10px] font-black w-9 h-9 flex items-center justify-center shrink-0 border rounded-xl ${resultStyle(m.result)}`}>
                    {m.result || '—'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm">vs {m.opponent}</p>
                      {m.score && <span className="text-sm font-black text-primary">{m.score}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />{m.date}
                      </span>
                      {m.venue && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="w-3 h-3" />{m.venue}
                        </span>
                      )}
                      {m.competition && (
                        <Badge variant="secondary" className="text-[8px] h-4 font-bold px-1.5">{m.competition}</Badge>
                      )}
                      {m.enteredByRole && (
                        <Badge variant="outline" className="text-[8px] h-4 font-bold px-1.5 capitalize border-[#00C853]/30 text-[#00C853]">
                          {m.enteredByRole}
                        </Badge>
                      )}
                    </div>
                    {m.matchReport && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 italic line-clamp-2">"{m.matchReport}"</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
