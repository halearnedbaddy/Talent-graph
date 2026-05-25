'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Trophy, Plus, ChevronLeft, ChevronRight, Loader2,
  CheckCircle2, Calendar, MapPin, Users, BarChart3, Star, UserCheck
} from 'lucide-react';
import type { ClubMember, AthleteProfile, ClubMatch, UserAccount } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const CATEGORIES = ['league', 'cup', 'friendly', 'national'];
const RESULTS = ['W', 'L', 'D'] as const;

const STEP_LABELS = ['Match Details', 'Lineup', 'Team Stats', 'Player Stats'];

type PlayerStat = {
  athleteId: string;
  name: string;
  position: string;
  goals: number;
  assists: number;
  rating: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  manOfTheMatch: boolean;
};

export default function CoachMatchEntryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ClubMatch | null>(null);

  // Step 1: Match details
  const [details, setDetails] = useState({
    opponent: '', competition: '', category: 'league' as ClubMatch['category'],
    date: new Date().toISOString().slice(0, 10), location: '', venue: '',
    result: '' as '' | 'W' | 'L' | 'D', score: '', halfTimeScore: '',
  });
  // Step 3: Team stats
  const [teamStats, setTeamStats] = useState({
    shotsOnTarget: '', shotsOffTarget: '', corners: '', fouls: '',
    yellowCards: '', redCards: '', attendance: '', matchReport: '',
  });
  // Step 4: Player stats
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches, isLoading: matchesLoading } = useCollection<ClubMatch>(matchesQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => b.date.localeCompare(a.date));
  }, [matches]);

  const initPlayerStats = () => {
    if (!athletes) return;
    setPlayerStats(athletes.map(a => ({
      athleteId: a.uid,
      name: `${a.firstName} ${a.lastName}`,
      position: a.position ?? '',
      goals: 0, assists: 0, rating: 7, yellowCards: 0, redCards: 0,
      minutesPlayed: 90, manOfTheMatch: false,
    })));
  };

  const handleNext = () => {
    if (step === 1) initPlayerStats();
    setStep(s => Math.min(s + 1, 3));
  };

  const handleSaveMatch = async () => {
    if (!firestore || !clubId) return;
    setSaving(true);
    try {
      const matchData = {
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
        totalYellowCards: Number(teamStats.yellowCards) || 0,
        totalRedCards: Number(teamStats.redCards) || 0,
        attendance: Number(teamStats.attendance) || undefined,
        matchReport: teamStats.matchReport || undefined,
        createdAt: new Date().toISOString(),
      };

      const matchRef = await addDoc(collection(firestore, 'matches'), matchData);

      // Update athlete match histories + recalculate CSI scores
      for (const ps of playerStats) {
        if (!athletes) continue;
        const athlete = athletes.find(a => a.uid === ps.athleteId);
        if (!athlete) continue;
        const existing = athlete.matchHistory ?? [];
        const newEntry = {
          id: matchRef.id,
          competition: details.competition,
          category: details.category,
          opponent: details.opponent,
          apps: 1,
          minutes: ps.minutesPlayed,
          rating: ps.rating,
          goals: ps.goals,
          assists: ps.assists,
          shots: 0, duelsWon: 0, fouls: 0, saves: 0,
          yellowCards: ps.yellowCards,
          redCards: ps.redCards,
          manOfTheMatch: ps.manOfTheMatch,
          isVerified: true,
          statsLogged: true,
          updatedAt: new Date().toISOString(),
          clubMatchId: matchRef.id,
        };
        const updatedHistory = [...existing, newEntry];

        // Recalculate CSI
        let scoreUpdates: Record<string, any> = {};
        try {
          const userSnap = await getDoc(doc(firestore, 'users', ps.athleteId));
          const userAccount = (userSnap.exists() ? userSnap.data() : {}) as UserAccount;
          scoreUpdates = calculateTalentGraphScore({ ...athlete, matchHistory: updatedHistory }, userAccount);
        } catch {
          // Score recalc failed silently — stats still saved
        }

        await updateDoc(doc(firestore, 'athletes', ps.athleteId), {
          matchHistory: updatedHistory,
          ...scoreUpdates,
          updatedAt: new Date().toISOString(),
        });

        // Create a pending confirmation request so the athlete can verify their stats
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
              shots: 0,
              duelsWon: 0,
              fouls: 0,
              saves: 0,
              cleanSheet: false,
              manOfTheMatch: ps.manOfTheMatch,
            },
            status: 'pending',
            enteredBy: user!.uid,
            enteredByRole: 'coach',
            createdAt: new Date().toISOString(),
          });
        } catch {
          // Confirmation write failed silently — stats already saved
        }
      }

      toast({ title: 'Match Saved ✓', description: `Match data logged. ${playerStats.length} player profile${playerStats.length !== 1 ? 's' : ''} updated.` });
      setShowForm(false);
      setStep(0);
      setDetails({ opponent: '', competition: '', category: 'league', date: new Date().toISOString().slice(0, 10), location: '', venue: '', result: '', score: '', halfTimeScore: '' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save match.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Step indicator */}
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

            {/* STEP 0: Match Details */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Opponent *</Label>
                    <Input
                      placeholder="e.g. Gor Mahia FC"
                      value={details.opponent}
                      onChange={e => setDetails(d => ({ ...d, opponent: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Competition *</Label>
                    <Input
                      placeholder="e.g. KPL Season 2025"
                      value={details.competition}
                      onChange={e => setDetails(d => ({ ...d, competition: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Category</Label>
                    <Select value={details.category} onValueChange={v => setDetails(d => ({ ...d, category: v as any }))}>
                      <SelectTrigger className="bg-[#1C2333] border-[#1E293B] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                        {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-white capitalize font-bold">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Date *</Label>
                    <Input
                      type="date"
                      value={details.date}
                      onChange={e => setDetails(d => ({ ...d, date: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Result</Label>
                    <div className="flex gap-2">
                      {RESULTS.map(r => (
                        <button
                          key={r}
                          onClick={() => setDetails(d => ({ ...d, result: d.result === r ? '' : r }))}
                          className={cn(
                            'flex-1 h-10 rounded-xl font-black text-sm border transition-all',
                            details.result === r
                              ? r === 'W' ? 'bg-[#00C853] text-black border-[#00C853]'
                                : r === 'L' ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-[#94A3B8] text-black border-[#94A3B8]'
                              : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#94A3B8]'
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Score (FT)</Label>
                    <Input
                      placeholder="e.g. 2-1"
                      value={details.score}
                      onChange={e => setDetails(d => ({ ...d, score: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Half-Time Score</Label>
                    <Input
                      placeholder="e.g. 1-0"
                      value={details.halfTimeScore}
                      onChange={e => setDetails(d => ({ ...d, halfTimeScore: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Location</Label>
                    <Input
                      placeholder="e.g. Nairobi"
                      value={details.location}
                      onChange={e => setDetails(d => ({ ...d, location: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Venue</Label>
                    <Input
                      placeholder="e.g. Kasarani Stadium"
                      value={details.venue}
                      onChange={e => setDetails(d => ({ ...d, venue: e.target.value }))}
                      className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* STEP 1: Lineup (simplified — show squad list) */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-[#94A3B8]">
                  Review your squad. Player stats will be entered in the next step.
                </p>
                {athletes && athletes.length > 0 ? (
                  <div className="space-y-2">
                    {athletes.map(a => (
                      <div key={a.uid} className="flex items-center gap-3 p-2 rounded-lg bg-[#1C2333]">
                        <Avatar className="h-8 w-8 rounded-lg shrink-0">
                          <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                            {a.firstName[0]}{a.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                          <p className="text-[9px] text-[#94A3B8] font-bold uppercase">{a.position}</p>
                        </div>
                        {a.jerseyNumber && (
                          <span className="text-[10px] font-black text-[#94A3B8]">#{a.jerseyNumber}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#94A3B8] text-sm text-center py-4">No squad athletes yet. Add athletes via My Squad.</p>
                )}
              </div>
            )}

            {/* STEP 2: Team Stats */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'shotsOnTarget', label: 'Shots on Target' },
                  { key: 'shotsOffTarget', label: 'Shots off Target' },
                  { key: 'corners', label: 'Corners' },
                  { key: 'fouls', label: 'Fouls' },
                  { key: 'yellowCards', label: 'Yellow Cards' },
                  { key: 'redCards', label: 'Red Cards' },
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
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Match Report</Label>
                  <Textarea
                    placeholder="Optional match notes..."
                    value={teamStats.matchReport}
                    onChange={e => setTeamStats(s => ({ ...s, matchReport: e.target.value }))}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Player Stats */}
            {step === 3 && (
              <div className="space-y-3">
                {playerStats.map((ps, i) => (
                  <div key={ps.athleteId} className="p-3 rounded-xl bg-[#1C2333] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">{ps.name}</p>
                        <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{ps.position}</p>
                      </div>
                      <button
                        onClick={() => setPlayerStats(prev => prev.map((p, j) => j === i ? { ...p, manOfTheMatch: !p.manOfTheMatch } : { ...p, manOfTheMatch: false }))}
                        className={cn('flex items-center gap-1 text-[9px] font-black uppercase border px-2 py-1 rounded-lg transition-all',
                          ps.manOfTheMatch ? 'bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30' : 'text-[#94A3B8] border-[#1E293B] hover:border-[#94A3B8]'
                        )}
                      >
                        <Star className="h-3 w-3" /> MOTM
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'goals', label: 'Goals' },
                        { key: 'assists', label: 'Assists' },
                        { key: 'rating', label: 'Rating /10' },
                        { key: 'minutesPlayed', label: 'Minutes' },
                        { key: 'yellowCards', label: 'Yellows' },
                        { key: 'redCards', label: 'Reds' },
                      ].map(f => (
                        <div key={f.key} className="space-y-0.5">
                          <Label className="text-[9px] font-black text-[#94A3B8] uppercase">{f.label}</Label>
                          <Input
                            type="number" min="0"
                            max={f.key === 'rating' ? 10 : undefined}
                            value={(ps as any)[f.key]}
                            onChange={e => setPlayerStats(prev => prev.map((p, j) => j === i ? { ...p, [f.key]: Number(e.target.value) } : p))}
                            className="bg-[#0A0E1A] border-[#1E293B] text-white text-sm focus:border-[#00C853] h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => step === 0 ? setShowForm(false) : setStep(s => s - 1)}
            className="flex-1 border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-[10px] uppercase gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button
              onClick={handleNext}
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
              Save Match
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Match Data Entry</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Mobile-first 4-step match logging
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
        >
          <Plus className="h-4 w-4" /> New Match
        </Button>
      </div>

      {/* Match history */}
      {matchesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
      ) : sortedMatches.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
          <p className="text-white font-black text-lg">No matches logged yet</p>
          <p className="text-[#94A3B8] text-sm mt-1">Start by logging your first match.</p>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
          >
            <Plus className="h-4 w-4" /> Log First Match
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMatches.map(m => (
            <Card key={m.id} className="border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm',
                    m.result === 'W' ? 'bg-[#00C853]/20 text-[#00C853]' :
                      m.result === 'L' ? 'bg-red-500/20 text-red-400' :
                        m.result === 'D' ? 'bg-[#94A3B8]/20 text-[#94A3B8]' :
                          'bg-[#1C2333] text-[#94A3B8]'
                  )}>
                    {m.result || '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">vs {m.opponent}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{m.competition}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {m.score && <p className="text-sm font-black text-white">{m.score}</p>}
                    <p className="text-[9px] font-bold text-[#94A3B8]">
                      {(() => { try { return format(parseISO(m.date), 'dd MMM yyyy'); } catch { return m.date; } })()}
                    </p>
                    <Badge className={cn(
                      'text-[8px] font-black border mt-0.5',
                      m.category === 'league' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                        m.category === 'cup' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          'bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/20'
                    )}>
                      {m.category}
                    </Badge>
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
