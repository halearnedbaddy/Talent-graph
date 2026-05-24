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
  Loader2, Star, AlertTriangle, Activity, Target, Shield, Printer
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend
} from 'recharts';
import type { ClubMember, AthleteProfile, ClubMatch } from '@/lib/types';
import { useSearchParams } from 'next/navigation';

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

  // Squad aggregate radar data
  const squadRadarData = useMemo(() => {
    if (!athletes || athletes.length === 0) return [];
    const metrics = ['performanceIndex', 'efficiencyIndex', 'consistencyIndex', 'contextIndex', 'developmentIndex'];
    return metrics.map(m => ({
      subject: METRIC_LABELS[m] ?? m,
      value: Math.round(athletes.reduce((s, a) => s + ((a as any)[m] ?? 0), 0) / athletes.length),
    }));
  }, [athletes]);

  // Individual radar data
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

  // Match history bar chart
  const matchHistoryData = useMemo(() => {
    if (!selectedAthlete?.matchHistory) return [];
    return [...(selectedAthlete.matchHistory)]
      .slice(-10)
      .map(m => ({
        name: m.opponent ? `vs ${m.opponent}`.slice(0, 10) : m.competition.slice(0, 8),
        rating: m.rating ?? 0,
        goals: m.goals ?? 0,
        assists: m.assists ?? 0,
      }));
  }, [selectedAthlete]);

  // Squad CSI ranking
  const squadRanking = useMemo(() => {
    if (!athletes) return [];
    return [...athletes].sort((a, b) => (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0));
  }, [athletes]);

  // Squad match form (last 5 matches)
  const recentForm = useMemo(() => {
    if (!matches) return [];
    return [...matches]
      .filter(m => m.result)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse();
  }, [matches]);

  const isLoading = memberLoading || athletesLoading;

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-root { color: black !important; }
        }
        @page { size: A4 landscape; margin: 1.2cm; }
      `}</style>
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Performance Analytics</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Individual · Squad · Trends
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-bold text-xs"
          onClick={() => window.print()}
        >
          <Printer className="w-3.5 h-3.5" />
          Export PDF
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
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
      ) : selectedAthleteId === 'squad' ? (
        /* Squad View */
        <div className="space-y-5">
          {/* Squad KPIs */}
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

          {/* Match form */}
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
                      )}>
                        {m.result}
                      </span>
                      <span className="text-[8px] font-bold text-[#94A3B8] truncate max-w-full text-center">
                        {m.score ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Radar + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Squad Avg Radar</CardTitle>
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

            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">CSI Ranking</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {squadRanking.slice(0, 5).map((a, i) => (
                  <div key={a.uid} className="flex items-center gap-3">
                    <span className={cn('text-[10px] font-black w-5 shrink-0', i === 0 ? 'text-[#00C853]' : 'text-[#94A3B8]')}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-20 rounded-full bg-[#1E293B] overflow-hidden">
                        <div
                          className="h-full bg-[#00C853] rounded-full"
                          style={{ width: `${Math.min((a.compositeScoutingIndex ?? 0), 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-[#00C853] w-8 text-right">
                        {a.compositeScoutingIndex ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
                {squadRanking.length === 0 && (
                  <p className="text-[#94A3B8] text-sm text-center py-4">No athletes yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Full squad table */}
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
                        <td className="py-2 px-2">
                          <span className="font-black text-white">{a.firstName} {a.lastName}</span>
                        </td>
                        <td className="py-2 px-2 text-[#94A3B8] font-bold">{a.position ?? '—'}</td>
                        <td className="py-2 px-2 text-[#94A3B8] font-bold">{a.age}</td>
                        {[a.compositeScoutingIndex, a.performanceIndex, a.efficiencyIndex, a.consistencyIndex, a.developmentIndex].map((v, i) => (
                          <td key={i} className={cn('py-2 px-2 font-black', (v ?? 0) >= 70 ? 'text-[#00C853]' : (v ?? 0) >= 50 ? 'text-white' : 'text-[#94A3B8]')}>
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
                {squadRanking.length === 0 && (
                  <p className="text-center text-[#94A3B8] text-sm py-8">No athletes in squad</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : selectedAthlete ? (
        /* Individual View */
        <div className="space-y-5">
          {/* Individual KPIs */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'CSI', value: selectedAthlete.compositeScoutingIndex ?? '--', color: 'text-[#00C853]' },
              { label: 'Performance', value: selectedAthlete.performanceIndex ?? '--', color: 'text-white' },
              { label: 'Efficiency', value: selectedAthlete.efficiencyIndex ?? '--', color: 'text-white' },
              { label: 'Consistency', value: selectedAthlete.consistencyIndex ?? '--', color: 'text-white' },
              { label: 'Development', value: selectedAthlete.developmentIndex ?? '--', color: 'text-white' },
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
            {/* Radar */}
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

            {/* Match history */}
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

          {/* Goals/Assists bar */}
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

          {/* Detailed attributes */}
          {selectedAthlete.detailedAttributes && (
            <Card className="border border-[#1E293B] bg-[#111827]">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Detailed Attributes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {Object.entries(selectedAthlete.detailedAttributes).map(([cat, attrs]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-2">{cat}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(attrs).map(([attr, val]) => {
                        const numVal = Number(val) || 0;
                        return (
                          <div key={attr} className="flex items-center justify-between p-2 rounded-lg bg-[#1C2333]">
                            <span className="text-[10px] font-bold text-[#94A3B8]">{attr}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-12 rounded-full bg-[#1E293B] overflow-hidden">
                                <div className="h-full bg-[#00C853] rounded-full" style={{ width: `${Math.min(numVal, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-black text-white w-5 text-right">{numVal}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
