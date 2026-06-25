'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Users,
  Loader2, Star, AlertTriangle, Activity, Target, Shield, Printer,
  Brain, Dumbbell, Zap, ChevronRight
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend
} from 'recharts';
import type { ClubMember, AthleteProfile, ClubMatch } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const METRIC_LABELS: Record<string, string> = {
  compositeScoutingIndex: 'CSI', performanceIndex: 'Performance',
  efficiencyIndex: 'Efficiency', consistencyIndex: 'Consistency',
  contextIndex: 'Context', developmentIndex: 'Development', riskIndex: 'Risk',
};

export default function CoachAnalyticsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const preselected = searchParams.get('athlete');

  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(preselected ?? 'squad');
  const [analyticsPositionFilter, setAnalyticsPositionFilter] = useState('All');
  const [analyticsSortBy, setAnalyticsSortBy] = useState<'csi' | 'risk' | 'age'>('csi');

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const selectedAthlete = useMemo(() => {
    if (!athletes || selectedAthleteId === 'squad') return null;
    return athletes.find(a => a.uid === selectedAthleteId) ?? null;
  }, [athletes, selectedAthleteId]);

  // Squad aggregate radar
  const squadRadarData = useMemo(() => {
    if (!athletes || athletes.length === 0) return [];
    const metrics = ['performanceIndex', 'efficiencyIndex', 'consistencyIndex', 'contextIndex', 'developmentIndex'];
    return metrics.map(m => ({
      subject: METRIC_LABELS[m] ?? m,
      value: Math.round(athletes.reduce((s, a) => s + ((a as any)[m] ?? 0), 0) / athletes.length),
    }));
  }, [athletes]);

  // Individual high-level radar (index scores)
  const individualRadarData = useMemo(() => {
    if (!selectedAthlete) return [];
    return [
      { subject: 'Performance', value: selectedAthlete.performanceIndex ?? 0 },
      { subject: 'Efficiency', value: selectedAthlete.efficiencyIndex ?? 0 },
      { subject: 'Consistency', value: selectedAthlete.consistencyIndex ?? 0 },
      { subject: 'Context', value: selectedAthlete.contextIndex ?? 0 },
      { subject: 'Development', value: selectedAthlete.developmentIndex ?? 0 },
    ];
  }, [selectedAthlete]);

  // Tabbed attribute radars — Technical, Mental, Physical
  const technicalRadar = useMemo(() => {
    const attrs = selectedAthlete?.detailedAttributes?.Technical;
    if (!attrs) return [];
    return Object.entries(attrs).map(([k, v]) => ({ subject: k.replace(/([A-Z])/g, ' $1').trim(), value: Number(v) || 0 }));
  }, [selectedAthlete]);

  const mentalRadar = useMemo(() => {
    const attrs = selectedAthlete?.detailedAttributes?.Mental;
    if (!attrs) return [];
    return Object.entries(attrs).map(([k, v]) => ({ subject: k.replace(/([A-Z])/g, ' $1').trim(), value: Number(v) || 0 }));
  }, [selectedAthlete]);

  const physicalRadar = useMemo(() => {
    const attrs = selectedAthlete?.detailedAttributes?.Physical;
    if (!attrs) return [];
    return Object.entries(attrs).map(([k, v]) => ({ subject: k.replace(/([A-Z])/g, ' $1').trim(), value: Number(v) || 0 }));
  }, [selectedAthlete]);

  // Match history charts
  const matchHistoryData = useMemo(() => {
    if (!selectedAthlete?.matchHistory) return [];
    return [...(selectedAthlete.matchHistory)]
      .slice(-10)
      .map(m => ({
        name: m.opponent ? `vs ${m.opponent}`.slice(0, 10) : m.competition.slice(0, 8),
        rating: m.rating ?? 0,
        goals: m.goals ?? 0,
        assists: m.assists ?? 0,
        yellowCards: m.yellowCards ?? 0,
        redCards: m.redCards ?? 0,
        minutes: m.minutes ?? 0,
        competition: m.competition,
        opponent: m.opponent,
      }));
  }, [selectedAthlete]);

  // Discipline timeline — matches with cards
  const disciplineTimeline = useMemo(() => {
    if (!selectedAthlete?.matchHistory) return [];
    return [...(selectedAthlete.matchHistory)]
      .filter(m => (m.yellowCards ?? 0) > 0 || (m.redCards ?? 0) > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [selectedAthlete]);

  // Consistency metrics
  const consistencyStats = useMemo(() => {
    const history = selectedAthlete?.matchHistory ?? [];
    if (history.length < 2) return null;
    const ratings = history.map(m => m.rating ?? 0).filter(r => r > 0);
    if (ratings.length < 2) return null;
    const mean = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const variance = ratings.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / ratings.length;
    const stdDev = Math.sqrt(variance);
    const above7 = ratings.filter(r => r >= 7).length;
    const below6 = ratings.filter(r => r < 6).length;
    return {
      mean: mean.toFixed(1),
      stdDev: stdDev.toFixed(2),
      above7: Math.round(above7 / ratings.length * 100),
      below6: Math.round(below6 / ratings.length * 100),
      totalApps: history.length,
    };
  }, [selectedAthlete]);

  // Squad ranking + most improved (need previous benchmarks — use developmentIndex as proxy)
  const squadRanking = useMemo(() => {
    if (!athletes) return [];
    return [...athletes].sort((a, b) => (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0));
  }, [athletes]);

  const mostImproved = useMemo(() => {
    if (!athletes) return [];
    return [...athletes]
      .filter(a => (a.developmentIndex ?? 0) > 0)
      .sort((a, b) => (b.developmentIndex ?? 0) - (a.developmentIndex ?? 0))
      .slice(0, 3);
  }, [athletes]);

  const recentForm = useMemo(() => {
    if (!matches) return [];
    return [...matches]
      .filter(m => m.result)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse();
  }, [matches]);

  const seasonSummary = useMemo(() => {
    const ml = matches ?? [];
    const wins = ml.filter((m: any) => m.result === 'W').length;
    const draws = ml.filter((m: any) => m.result === 'D').length;
    const losses = ml.filter((m: any) => m.result === 'L').length;
    const goalsFor = ml.reduce((s: number, m: any) => s + (m.goalsFor ?? 0), 0);
    const goalsAgainst = ml.reduce((s: number, m: any) => s + (m.goalsAgainst ?? 0), 0);
    return { wins, draws, losses, goalsFor, goalsAgainst, total: ml.length };
  }, [matches]);

  const positionDistribution = useMemo(() => {
    const posMap: Record<string, number> = {};
    (athletes ?? []).forEach(a => { posMap[a.position ?? 'Unknown'] = (posMap[a.position ?? 'Unknown'] ?? 0) + 1; });
    return Object.entries(posMap).sort((a, b) => b[1] - a[1]);
  }, [athletes]);

  const filteredSquad = useMemo(() => {
    let list = [...(athletes ?? [])];
    if (analyticsPositionFilter !== 'All') list = list.filter(a => a.position === analyticsPositionFilter || a.altPositions?.includes(analyticsPositionFilter));
    return list.sort((a, b) => {
      if (analyticsSortBy === 'csi') return (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0);
      if (analyticsSortBy === 'risk') return (b.riskIndex ?? 0) - (a.riskIndex ?? 0);
      return (a.age ?? 0) - (b.age ?? 0);
    });
  }, [athletes, analyticsPositionFilter, analyticsSortBy]);

  const maxCSI = useMemo(() => Math.max(...(athletes ?? []).map(a => a.compositeScoutingIndex ?? 0), 1), [athletes]);

  const isLoading = memberLoading || athletesLoading;

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
        @page { size: A4 landscape; margin: 1.2cm; }
      `}</style>

      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Performance Analytics</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Individual · Squad · Discipline Timeline
          </p>
        </div>
        <Button
          size="sm" variant="outline"
          className="gap-2 border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-bold text-xs"
          onClick={() => window.print()}
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </Button>
      </div>

      {/* Athlete selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
          <SelectTrigger className="w-[220px] bg-[#1C2333] border-[#1E293B] text-white font-bold">
            <SelectValue placeholder="Select athlete or squad" />
          </SelectTrigger>
          <SelectContent className="bg-[#1C2333] border-[#1E293B]">
            <SelectItem value="squad" className="text-white font-black">Squad Overview</SelectItem>
            {athletes?.map(a => (
              <SelectItem key={a.uid} value={a.uid} className="text-white font-bold">
                {a.firstName} {a.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAthleteId !== 'squad' && selectedAthlete && (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 rounded-xl">
              <AvatarImage src={selectedAthlete.photoUrl} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-black text-white">{selectedAthlete.firstName} {selectedAthlete.lastName}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{selectedAthlete.position} · {selectedAthlete.age}y</p>
            </div>
            {selectedAthlete.isVerified && (
              <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[9px] gap-1">
                <Shield className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
      ) : selectedAthleteId === 'squad' ? (

        /* ─── SQUAD VIEW ─── */
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Squad Size', value: athletes?.length ?? 0, color: 'text-white' },
              { label: 'Avg CSI', value: athletes?.length ? Math.round(athletes.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / athletes.length) : 0, color: 'text-[#00C853]' },
              { label: 'Verified', value: athletes?.filter(a => a.isVerified).length ?? 0, color: 'text-[#00C853]' },
              { label: 'High Risk', value: athletes?.filter(a => (a.riskIndex ?? 0) >= 60).length ?? 0, color: 'text-red-400' },
            ].map(s => (
              <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
                <CardContent className="p-4 text-center">
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent form */}
          {recentForm.length > 0 && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#00C853]" /> Recent Form (Last 5)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  {recentForm.map(m => (
                    <div key={m.id} className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl flex-1 border',
                      m.result === 'W' ? 'bg-[#00C853]/10 border-[#00C853]/30' :
                        m.result === 'L' ? 'bg-red-500/10 border-red-500/30' :
                          'bg-[#94A3B8]/10 border-[#94A3B8]/30'
                    )}>
                      <span className={cn('text-xl font-black',
                        m.result === 'W' ? 'text-[#00C853]' : m.result === 'L' ? 'text-red-400' : 'text-[#94A3B8]'
                      )}>{m.result}</span>
                      <span className="text-[8px] font-bold text-[#94A3B8] truncate max-w-full">{m.score ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Season Record */}
          {seasonSummary.total > 0 && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#00C853]" /> Season Record
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Wins', value: seasonSummary.wins, color: 'bg-[#00C853]' },
                  { label: 'Draws', value: seasonSummary.draws, color: 'bg-yellow-500' },
                  { label: 'Losses', value: seasonSummary.losses, color: 'bg-red-500' },
                ].map(r => (
                  <div key={r.label} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-[#94A3B8]">{r.label}</span>
                      <span className="font-black text-sm text-white">{r.value}</span>
                    </div>
                    <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${r.color} transition-all`} style={{ width: seasonSummary.total > 0 ? `${Math.round((r.value / seasonSummary.total) * 100)}%` : '0%' }} />
                    </div>
                  </div>
                ))}
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-[#94A3B8]">Goal Difference</p>
                  <p className={`text-xl font-black ${seasonSummary.goalsFor >= seasonSummary.goalsAgainst ? 'text-[#00C853]' : 'text-red-400'}`}>
                    {seasonSummary.goalsFor >= seasonSummary.goalsAgainst ? '+' : ''}{seasonSummary.goalsFor - seasonSummary.goalsAgainst}
                  </p>
                  <p className="text-[9px] text-[#94A3B8]">{seasonSummary.goalsFor}F — {seasonSummary.goalsAgainst}A</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Squad radar */}
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Squad Avg Index Radar</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-56">
                {squadRadarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={squadRadarData}>
                      <PolarGrid stroke="#1E293B" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                      <Radar name="Squad" dataKey="value" stroke="#00C853" fill="#00C853" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#94A3B8] text-sm">No data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CSI Ranking */}
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">CSI Ranking</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {squadRanking.slice(0, 5).map((a, i) => (
                  <button
                    key={a.uid}
                    onClick={() => setSelectedAthleteId(a.uid)}
                    className="w-full flex items-center gap-3 hover:bg-[#1C2333] rounded-lg px-1 py-0.5 transition-colors"
                  >
                    <span className={cn('text-[10px] font-black w-5 shrink-0', i === 0 ? 'text-[#00C853]' : 'text-[#94A3B8]')}>#{i + 1}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-20 rounded-full bg-[#1E293B] overflow-hidden">
                        <div className="h-full bg-[#00C853] rounded-full" style={{ width: `${Math.min(a.compositeScoutingIndex ?? 0, 100)}%` }} />
                      </div>
                      <span className="text-sm font-black text-[#00C853] w-8 text-right">{a.compositeScoutingIndex ?? 0}</span>
                    </div>
                  </button>
                ))}
                {squadRanking.length === 0 && <p className="text-[#94A3B8] text-sm text-center py-4">No athletes yet</p>}
              </CardContent>
            </Card>
          </div>

          {/* Position Distribution */}
          {positionDistribution.length > 0 && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#00C853]" /> Position Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {positionDistribution.map(([pos, count]) => (
                  <div key={pos} className="flex items-center gap-3">
                    <Badge className="w-14 justify-center text-[9px] font-black uppercase shrink-0 bg-[#1C2333] text-[#94A3B8] border-[#1E293B]">{pos}</Badge>
                    <div className="flex-1">
                      <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-[#00C853] transition-all" style={{ width: `${Math.round((count / (athletes?.length ?? 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-black text-white w-4 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Most Improved */}
          {mostImproved.length > 0 && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#00C853]" /> Most Improved (by Development Index)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mostImproved.map((a, i) => (
                    <button
                      key={a.uid}
                      onClick={() => setSelectedAthleteId(a.uid)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#1C2333] hover:bg-[#1C2333]/80 text-left transition-colors border border-[#1E293B] hover:border-[#00C853]/30"
                    >
                      <span className={cn('text-[10px] font-black w-4 shrink-0', i === 0 ? 'text-[#00C853]' : 'text-[#94A3B8]')}>#{i + 1}</span>
                      <Avatar className="h-8 w-8 rounded-xl shrink-0">
                        <AvatarImage src={a.photoUrl} className="object-cover" />
                        <AvatarFallback className="rounded-xl bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                          {a.firstName[0]}{a.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                        <p className="text-[9px] font-bold text-[#94A3B8]">Dev Index: <span className="text-[#00C853]">{a.developmentIndex}</span></p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Player Intelligence Table */}
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                <Brain className="h-4 w-4 text-[#00C853]" /> Player Intelligence
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={analyticsPositionFilter} onValueChange={setAnalyticsPositionFilter}>
                  <SelectTrigger className="w-20 h-8 text-xs font-bold bg-[#1C2333] border-[#1E293B] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                    {['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'].map(p => (
                      <SelectItem key={p} value={p} className="text-white font-bold">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={analyticsSortBy} onValueChange={(v: any) => setAnalyticsSortBy(v)}>
                  <SelectTrigger className="w-24 h-8 text-xs font-bold bg-[#1C2333] border-[#1E293B] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                    <SelectItem value="csi" className="text-white font-bold">By CSI</SelectItem>
                    <SelectItem value="risk" className="text-white font-bold">By Risk</SelectItem>
                    <SelectItem value="age" className="text-white font-bold">By Age</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-3">
              {filteredSquad.length === 0 ? (
                <p className="text-center text-[#94A3B8] text-sm py-8">No athletes found</p>
              ) : (
                <div className="divide-y divide-[#1E293B]">
                  {filteredSquad.map((a, i) => {
                    const risk = (a.riskIndex ?? 0);
                    const riskLabel = risk < 25 ? 'Low' : risk < 50 ? 'Moderate' : risk < 75 ? 'High' : 'Very High';
                    const riskColor = risk < 25 ? 'text-[#00C853]' : risk < 50 ? 'text-yellow-400' : risk < 75 ? 'text-[#FF6D00]' : 'text-red-400';
                    return (
                      <button
                        key={a.uid}
                        onClick={() => setSelectedAthleteId(a.uid)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1C2333] transition-colors text-left"
                      >
                        <span className="text-[10px] font-black text-[#94A3B8] w-4 shrink-0">{i + 1}</span>
                        <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                          <AvatarImage src={a.photoUrl} className="object-cover" />
                          <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-[10px] font-black">{a.firstName?.[0]}{a.lastName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-white truncate">{a.firstName} {a.lastName}</p>
                            {a.isVerified && <Shield className="w-3 h-3 text-[#00C853] shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[8px] h-4 font-black px-1.5 bg-[#1E293B] text-[#94A3B8] border-0">{a.position ?? '—'}</Badge>
                            <span className={`text-[9px] font-black ${riskColor}`}>{riskLabel} Risk</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-[#00C853]">{a.compositeScoutingIndex ?? '—'}</p>
                          <p className="text-[9px] text-[#94A3B8]">CSI</p>
                        </div>
                        <div className="w-20 hidden sm:block">
                          <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-[#00C853] rounded-full" style={{ width: `${Math.round(((a.compositeScoutingIndex ?? 0) / maxCSI) * 100)}%` }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Full squad detail table */}
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Full Squad Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1E293B]">
                      {['Athlete', 'Pos', 'Age', 'CSI', 'Perf', 'Eff', 'Con', 'Dev', 'Risk'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-[9px] font-black text-[#94A3B8] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {squadRanking.map(a => (
                      <tr key={a.uid} className="hover:bg-[#1C2333] transition-colors cursor-pointer" onClick={() => setSelectedAthleteId(a.uid)}>
                        <td className="py-2 px-2"><span className="font-black text-white">{a.firstName} {a.lastName}</span></td>
                        <td className="py-2 px-2 text-[#94A3B8] font-bold">{a.position ?? '—'}</td>
                        <td className="py-2 px-2 text-[#94A3B8] font-bold">{a.age}</td>
                        {[a.compositeScoutingIndex, a.performanceIndex, a.efficiencyIndex, a.consistencyIndex, a.developmentIndex].map((v, idx) => (
                          <td key={idx} className={cn('py-2 px-2 font-black', (v ?? 0) >= 70 ? 'text-[#00C853]' : (v ?? 0) >= 50 ? 'text-white' : 'text-[#94A3B8]')}>
                            {v ?? '—'}
                          </td>
                        ))}
                        <td className={cn('py-2 px-2 font-black', (a.riskIndex ?? 0) >= 60 ? 'text-red-400' : (a.riskIndex ?? 0) >= 40 ? 'text-[#FF6D00]' : 'text-[#94A3B8]')}>
                          {a.riskIndex ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {squadRanking.length === 0 && <p className="text-center text-[#94A3B8] text-sm py-8">No athletes in squad</p>}
              </div>
            </CardContent>
          </Card>
        </div>

      ) : selectedAthlete ? (

        /* ─── INDIVIDUAL VIEW ─── */
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'CSI', value: selectedAthlete.compositeScoutingIndex ?? '--', color: 'text-[#00C853]' },
              { label: 'Performance', value: selectedAthlete.performanceIndex ?? '--', color: 'text-white' },
              { label: 'Efficiency', value: selectedAthlete.efficiencyIndex ?? '--', color: 'text-white' },
              { label: 'Consistency', value: selectedAthlete.consistencyIndex ?? '--', color: 'text-white' },
              { label: 'Development', value: selectedAthlete.developmentIndex ?? '--', color: 'text-[#00C853]' },
              { label: 'Risk', value: selectedAthlete.riskIndex ?? '--', color: (selectedAthlete.riskIndex ?? 0) >= 60 ? 'text-red-400' : 'text-[#94A3B8]' },
            ].map(s => (
              <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[8px] font-black text-[#94A3B8] uppercase tracking-widest mt-0.5 leading-tight">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* High-level performance radar */}
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Performance Radar</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-56">
                {individualRadarData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={individualRadarData}>
                      <PolarGrid stroke="#1E293B" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                      <Radar name={selectedAthlete.firstName} dataKey="value" stroke="#00C853" fill="#00C853" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <BarChart3 className="h-10 w-10 text-[#94A3B8] opacity-30" />
                    <p className="text-[#94A3B8] text-sm">No metric data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Match rating history */}
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Match Rating History</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-56">
                {matchHistoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={matchHistoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 8, fontWeight: 700 }} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#94A3B8', fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: '#1C2333', border: '1px solid #1E293B', borderRadius: 8 }} />
                      <Line type="monotone" dataKey="rating" stroke="#00C853" strokeWidth={2} dot={{ fill: '#00C853', r: 3 }} name="Rating" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Activity className="h-10 w-10 text-[#94A3B8] opacity-30" />
                    <p className="text-[#94A3B8] text-sm">No match history yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goals/Assists */}
          {matchHistoryData.length > 0 && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Goals & Assists per Match</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 8, fontWeight: 700 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#1C2333', border: '1px solid #1E293B', borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10, color: '#94A3B8' }} />
                    <Bar dataKey="goals" fill="#00C853" radius={[4, 4, 0, 0]} name="Goals" />
                    <Bar dataKey="assists" fill="#FF6D00" radius={[4, 4, 0, 0]} name="Assists" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── ATTRIBUTE RADARS — Technical / Mental / Physical tabs ── */}
          {selectedAthlete.detailedAttributes && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#00C853]" /> Detailed Attribute Radars
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="technical" className="space-y-4">
                  <TabsList className="bg-[#1C2333] border border-[#1E293B] p-1">
                    <TabsTrigger
                      value="technical"
                      className="data-[state=active]:bg-blue-500 data-[state=active]:text-white font-black text-[10px] uppercase gap-1.5"
                    >
                      <Zap className="h-3 w-3" /> Technical
                      {technicalRadar.length > 0 && (
                        <span className="ml-1 text-[9px] opacity-70">
                          avg {Math.round(technicalRadar.reduce((s, d) => s + d.value, 0) / technicalRadar.length)}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="mental"
                      className="data-[state=active]:bg-purple-500 data-[state=active]:text-white font-black text-[10px] uppercase gap-1.5"
                    >
                      <Brain className="h-3 w-3" /> Mental
                      {mentalRadar.length > 0 && (
                        <span className="ml-1 text-[9px] opacity-70">
                          avg {Math.round(mentalRadar.reduce((s, d) => s + d.value, 0) / mentalRadar.length)}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="physical"
                      className="data-[state=active]:bg-[#FF6D00] data-[state=active]:text-white font-black text-[10px] uppercase gap-1.5"
                    >
                      <Dumbbell className="h-3 w-3" /> Physical
                      {physicalRadar.length > 0 && (
                        <span className="ml-1 text-[9px] opacity-70">
                          avg {Math.round(physicalRadar.reduce((s, d) => s + d.value, 0) / physicalRadar.length)}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {[
                    { key: 'technical', data: technicalRadar, color: '#3B82F6', label: 'Technical', icon: Zap },
                    { key: 'mental', data: mentalRadar, color: '#A855F7', label: 'Mental', icon: Brain },
                    { key: 'physical', data: physicalRadar, color: '#FF6D00', label: 'Physical', icon: Dumbbell },
                  ].map(({ key, data, color, label }) => (
                    <TabsContent key={key} value={key} className="space-y-4">
                      {data.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Radar */}
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={data}>
                                <PolarGrid stroke="#1E293B" />
                                <PolarAngleAxis
                                  dataKey="subject"
                                  tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 700 }}
                                />
                                <Radar
                                  name={label}
                                  dataKey="value"
                                  stroke={color}
                                  fill={color}
                                  fillOpacity={0.15}
                                  strokeWidth={2}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                          {/* Bar list */}
                          <div className="space-y-2">
                            {[...data].sort((a, b) => b.value - a.value).map(d => (
                              <div key={d.subject} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-[#94A3B8]">{d.subject}</span>
                                  <span className="text-[10px] font-black text-white">{d.value}</span>
                                </div>
                                <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(d.value, 100)}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <BarChart3 className="h-10 w-10 text-[#94A3B8] opacity-30" />
                          <p className="text-[#94A3B8] text-sm font-bold">No {label.toLowerCase()} attributes recorded</p>
                          <p className="text-[#94A3B8] text-xs">Verify the athlete's profile to populate these stats.</p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* ── CONSISTENCY DEEP DIVE ── */}
          {consistencyStats && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#00C853]" /> Consistency Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Apps Analysed', value: `${consistencyStats.totalApps}`, color: 'text-white' },
                    { label: 'Avg Rating', value: consistencyStats.mean, color: Number(consistencyStats.mean) >= 7 ? 'text-[#00C853]' : 'text-[#FF6D00]' },
                    { label: 'Rating StdDev', value: consistencyStats.stdDev, color: Number(consistencyStats.stdDev) <= 1 ? 'text-[#00C853]' : 'text-[#FF6D00]' },
                    { label: 'Rated 7+', value: `${consistencyStats.above7}%`, color: consistencyStats.above7 >= 60 ? 'text-[#00C853]' : 'text-[#94A3B8]' },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-[#1C2333] text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[8px] font-black text-[#94A3B8] uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 rounded-xl bg-[#1C2333] border border-[#1E293B]">
                  <p className="text-[10px] text-[#94A3B8]">
                    {Number(consistencyStats.stdDev) <= 0.8
                      ? '✓ Highly consistent performer — rating variance is very low.'
                      : Number(consistencyStats.stdDev) <= 1.5
                        ? '~ Moderate consistency — some match-to-match variation.'
                        : '⚠ High variance — performance fluctuates significantly between matches.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── DISCIPLINE TIMELINE ── */}
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#FF6D00]" /> Discipline Timeline
                {disciplineTimeline.length > 0 && (
                  <Badge className="bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30 font-black text-[9px]">
                    {disciplineTimeline.reduce((s, m) => s + (m.yellowCards ?? 0), 0)}Y ·{' '}
                    {disciplineTimeline.reduce((s, m) => s + (m.redCards ?? 0), 0)}R
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {disciplineTimeline.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-8 w-8 text-[#00C853] mx-auto mb-2 opacity-60" />
                  <p className="text-[#94A3B8] text-sm font-bold">Clean discipline record</p>
                  <p className="text-[#94A3B8] text-xs mt-1">No yellow or red cards on record.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary bar */}
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-[#1C2333]">
                    <div className="text-center">
                      <p className="text-2xl font-black text-yellow-400">
                        {disciplineTimeline.reduce((s, m) => s + (m.yellowCards ?? 0), 0)}
                      </p>
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase">Yellow Cards</p>
                    </div>
                    <div className="w-px h-10 bg-[#1E293B]" />
                    <div className="text-center">
                      <p className="text-2xl font-black text-red-400">
                        {disciplineTimeline.reduce((s, m) => s + (m.redCards ?? 0), 0)}
                      </p>
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase">Red Cards</p>
                    </div>
                    <div className="w-px h-10 bg-[#1E293B]" />
                    <div className="flex-1">
                      <p className="text-xs text-[#94A3B8]">
                        Across <span className="text-white font-black">{disciplineTimeline.length}</span> match{disciplineTimeline.length !== 1 ? 'es' : ''} with disciplinary incidents
                        out of <span className="text-white font-black">{selectedAthlete.matchHistory?.length ?? 0}</span> total appearances.
                      </p>
                    </div>
                  </div>

                  {/* Timeline cards */}
                  <div className="space-y-0">
                    {disciplineTimeline.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 py-2.5">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-[#FF6D00] mt-1.5 shrink-0" />
                          {i < disciplineTimeline.length - 1 && (
                            <div className="w-px flex-1 bg-[#1E293B] mt-1" style={{ minHeight: '14px' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-white">
                              {m.opponent ? `vs ${m.opponent}` : m.competition}
                            </p>
                            {(m.yellowCards ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-400/15 text-yellow-400 border border-yellow-400/30">
                                🟨 ×{m.yellowCards}
                              </span>
                            )}
                            {(m.redCards ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500/15 text-red-400 border border-red-500/30">
                                🟥 ×{m.redCards}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#94A3B8] font-bold mt-0.5">
                            {m.competition} · {m.minutes ?? 0} mins
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      ) : (
        <div className="text-center py-16">
          <BarChart3 className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
          <p className="text-white font-black">Select an athlete to view their analytics</p>
        </div>
      )}
    </div>
  );
}
