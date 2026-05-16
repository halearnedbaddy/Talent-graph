'use client';

import React, { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Trophy, Activity, TrendingUp, Target, Loader2, Users, Star, Flame, Shield } from 'lucide-react';
import type { ClubMatch, ClubMember, AthleteProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function StatisticsHubPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const teamStats = useMemo(() => {
    if (!matches || matches.length === 0) return { W: 0, L: 0, D: 0, GS: 0, GC: 0, GD: 0, totalYellows: 0, totalReds: 0, highestAttendance: 0, unbeatenStreak: 0, winStreak: 0, lossStreak: 0 };

    const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
    let W = 0, L = 0, D = 0, GS = 0, GC = 0, totalYellows = 0, totalReds = 0, highestAttendance = 0;

    let unbeatenStreak = 0, winStreak = 0, lossStreak = 0;
    let curUnbeaten = 0, curWin = 0, curLoss = 0;

    for (const m of sorted) {
      if (m.result === 'W') { W++; curWin++; curLoss = 0; curUnbeaten++; }
      else if (m.result === 'L') { L++; curLoss++; curWin = 0; curUnbeaten = 0; }
      else if (m.result === 'D') { D++; curWin = 0; curLoss = 0; curUnbeaten++; }

      winStreak = Math.max(winStreak, curWin);
      lossStreak = Math.max(lossStreak, curLoss);
      unbeatenStreak = Math.max(unbeatenStreak, curUnbeaten);

      const parts = m.score?.split('-') || ['0', '0'];
      GS += Number(parts[0]) || 0;
      GC += Number(parts[1]) || 0;

      totalYellows += Number(m.totalYellowCards) || 0;
      totalReds += Number(m.totalRedCards) || 0;

      if ((m.attendance || 0) > highestAttendance) highestAttendance = m.attendance || 0;
    }

    return { W, L, D, GS, GC, GD: GS - GC, totalYellows, totalReds, highestAttendance, unbeatenStreak, winStreak, lossStreak };
  }, [matches]);

  const athletePerformance = selectedAthleteId ? athletes?.find(a => a.uid === selectedAthleteId) : null;

  const categoryBreakdown = useMemo(() => {
    if (!matches) return {};
    return matches.reduce((acc: Record<string, { W: number; L: number; D: number }>, m) => {
      const cat = m.category || 'other';
      if (!acc[cat]) acc[cat] = { W: 0, L: 0, D: 0 };
      if (m.result) acc[cat][m.result]++;
      return acc;
    }, {});
  }, [matches]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight uppercase">Statistics Hub</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Organization-wide data aggregates</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-background border p-1 h-10 mb-8">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase px-4">Team Overview</TabsTrigger>
          <TabsTrigger value="streaks" className="text-[10px] font-black uppercase px-4">Streaks & Records</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-[10px] font-black uppercase px-4">Player Ranks</TabsTrigger>
          <TabsTrigger value="individual" className="text-[10px] font-black uppercase px-4">Player Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <StatCard label="Matches Won" value={teamStats.W} icon={Trophy} color="text-green-600" sub="League of champions" />
            <StatCard label="Drawn" value={teamStats.D} icon={Activity} sub="Equal contest" />
            <StatCard label="Matches Lost" value={teamStats.L} icon={Target} color="text-red-600" sub="Recovery area" />
            <StatCard label="Goal Difference" value={teamStats.GD > 0 ? `+${teamStats.GD}` : teamStats.GD} icon={TrendingUp} color={teamStats.GD >= 0 ? 'text-green-600' : 'text-red-600'} sub={`${teamStats.GS} scored / ${teamStats.GC} conceded`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Yellow Cards" value={teamStats.totalYellows} icon={Activity} color="text-yellow-600" sub="Total discipline" />
            <StatCard label="Red Cards" value={teamStats.totalReds} icon={Activity} color="text-red-600" sub="Sending offs" />
            <StatCard label="Highest Attendance" value={teamStats.highestAttendance > 0 ? teamStats.highestAttendance.toLocaleString() : '--'} icon={Users} sub="Peak crowd" />
            <StatCard label="Total Played" value={matches?.length || 0} icon={BarChart3} sub="Institutional sample" />
          </div>

          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-neutral-50 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Win/Loss Ratio</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex h-8 w-full rounded-2xl overflow-hidden bg-muted">
                <div className="h-full bg-green-600 transition-all" style={{ width: `${(teamStats.W / (matches?.length || 1)) * 100}%` }} />
                <div className="h-full bg-neutral-400 transition-all" style={{ width: `${(teamStats.D / (matches?.length || 1)) * 100}%` }} />
                <div className="h-full bg-red-600 transition-all" style={{ width: `${(teamStats.L / (matches?.length || 1)) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span className="text-green-600">W: {Math.round((teamStats.W / (matches?.length || 1)) * 100)}%</span>
                <span>D: {Math.round((teamStats.D / (matches?.length || 1)) * 100)}%</span>
                <span className="text-red-600">L: {Math.round((teamStats.L / (matches?.length || 1)) * 100)}%</span>
              </div>
            </CardContent>
          </Card>

          {Object.keys(categoryBreakdown).length > 0 && (
            <Card className="border-none shadow-sm bg-background overflow-hidden">
              <CardHeader className="bg-neutral-50 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-widest">Performance by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest text-green-600">W</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">D</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest text-red-600">L</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(categoryBreakdown).map(([cat, stats]) => {
                      const total = stats.W + stats.L + stats.D;
                      const winRate = total > 0 ? Math.round((stats.W / total) * 100) : 0;
                      return (
                        <TableRow key={cat} className="hover:bg-muted/20">
                          <TableCell><Badge variant="outline" className="font-black uppercase text-[9px]">{cat}</Badge></TableCell>
                          <TableCell className="text-center font-black text-green-600">{stats.W}</TableCell>
                          <TableCell className="text-center font-mono">{stats.D}</TableCell>
                          <TableCell className="text-center font-black text-red-600">{stats.L}</TableCell>
                          <TableCell className="text-right font-black text-primary">{winRate}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="streaks" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-xl bg-background overflow-hidden border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-green-500" /> Best Win Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-green-600">{teamStats.winStreak}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Consecutive Wins</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-background overflow-hidden border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" /> Unbeaten Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-blue-600">{teamStats.unbeatenStreak}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Games Without Defeat</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-background overflow-hidden border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-500" /> Worst Loss Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-black text-red-600">{teamStats.lossStreak}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Consecutive Losses</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-background overflow-hidden">
            <CardHeader className="bg-neutral-50 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Match Results Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-2">
                {[...(matches || [])].sort((a, b) => a.date.localeCompare(b.date)).map((m, i) => (
                  <div
                    key={m.id}
                    title={`${m.opponent} ${m.score || ''} (${m.date})`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black cursor-default ${
                      m.result === 'W' ? 'bg-green-600' : m.result === 'L' ? 'bg-red-600' : m.result === 'D' ? 'bg-neutral-500' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {m.result || '?'}
                  </div>
                ))}
                {(!matches || matches.length === 0) && (
                  <p className="text-sm text-muted-foreground">No match results yet.</p>
                )}
              </div>
              {matches && matches.length > 0 && (
                <div className="flex items-center gap-4 mt-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block" /> Win</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-500 inline-block" /> Draw</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600 inline-block" /> Loss</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Discipline Record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Yellow Cards</span>
                  <span className="text-3xl font-black text-yellow-600">{teamStats.totalYellows}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Red Cards</span>
                  <span className="text-3xl font-black text-red-600">{teamStats.totalReds}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-background">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attendance Record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Highest Attendance</span>
                  <span className="text-3xl font-black text-primary">{teamStats.highestAttendance > 0 ? teamStats.highestAttendance.toLocaleString() : '--'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matches with Attendance Data</span>
                  <span className="text-2xl font-black">{matches?.filter(m => m.attendance && m.attendance > 0).length || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card className="border-none shadow-2xl bg-background overflow-hidden">
            <CardHeader className="bg-neutral-900 text-white">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Institutional Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-neutral-50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[9px] font-black uppercase">#</TableHead>
                    <TableHead className="text-[9px] font-black uppercase">Athlete</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Goals</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Assists</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">MoM</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">Avg Rating</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">CSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes?.sort((a, b) => (b.compositeScoutingIndex || 0) - (a.compositeScoutingIndex || 0)).map((a, idx) => {
                    const career = a.matchHistory || [];
                    const goals = career.reduce((acc, m) => acc + (Number(m.goals) || 0), 0);
                    const assists = career.reduce((acc, m) => acc + (Number(m.assists) || 0), 0);
                    const motm = career.filter(m => m.manOfTheMatch).length;
                    const ratingSum = career.reduce((acc, m) => acc + ((Number(m.rating) || 0) * (Number(m.apps) || 0)), 0);
                    const totalApps = career.reduce((acc, m) => acc + (Number(m.apps) || 0), 0);
                    const avg = totalApps > 0 ? (ratingSum / totalApps).toFixed(1) : '--';

                    return (
                      <TableRow key={a.uid} className="hover:bg-muted/30">
                        <TableCell className="font-black text-muted-foreground text-sm w-8">{idx + 1}</TableCell>
                        <TableCell className="font-black uppercase text-xs">{a.firstName} {a.lastName}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{goals}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{assists}</TableCell>
                        <TableCell className="text-center text-xs">
                          {motm > 0 && <span className="flex items-center justify-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{motm}</span>}
                          {motm === 0 && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center font-black text-primary text-xs">{avg}</TableCell>
                        <TableCell className="text-right font-black text-primary">{a.compositeScoutingIndex || '--'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="individual">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Squad Member</h3>
              <div className="divide-y bg-background border rounded-xl overflow-hidden">
                {athletes?.map(a => (
                  <div key={a.uid} onClick={() => setSelectedAthleteId(a.uid)} className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${selectedAthleteId === a.uid ? 'bg-primary/5 border-l-4 border-primary' : ''}`}>
                    <p className="text-xs font-black uppercase">{a.firstName} {a.lastName}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{a.position}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-3">
              {athletePerformance ? (
                <Card className="border-none shadow-2xl bg-background overflow-hidden">
                  <CardHeader className="bg-neutral-50 border-b p-8">
                    <div className="flex justify-between items-end">
                      <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">{athletePerformance.firstName} {athletePerformance.lastName}</CardTitle>
                        <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mt-1">{athletePerformance.readinessTier || 'Developing'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-5xl font-black tracking-tighter leading-none">{athletePerformance.compositeScoutingIndex || '--'}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Institutional Rating</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 border-b">
                      <MetricItem label="Efficiency" value={athletePerformance.efficiencyIndex} />
                      <MetricItem label="Consistency" value={athletePerformance.consistencyIndex} />
                      <MetricItem label="Risk Index" value={athletePerformance.riskIndex} />
                      <MetricItem label="Performance" value={athletePerformance.performanceIndex} />
                    </div>
                    <Table>
                      <TableHeader className="bg-neutral-50/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[9px] font-black uppercase">Competition</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-center">Mins</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-center">G/A</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-center">MoM</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-right">Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {athletePerformance.matchHistory?.map((m, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="text-xs font-bold uppercase">
                              {m.competition}
                              {m.opponent && <span className="text-muted-foreground font-normal"> vs {m.opponent}</span>}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{m.minutes}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{m.goals}/{m.assists}</TableCell>
                            <TableCell className="text-center">{m.manOfTheMatch ? <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right font-black text-primary text-xs">{Number(m.rating || 0).toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground bg-muted/10 rounded-3xl border-4 border-dashed">
                  <Activity className="w-16 h-16 mb-4 opacity-10" />
                  <p className="font-black uppercase tracking-widest">Select an athlete to view performance breakdown</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, sub, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-background">
      <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
        <CardTitle className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
        <Icon className="w-3 h-3 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={`text-2xl font-black ${color || 'text-foreground'}`}>{value}</div>
        <p className="text-[8px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MetricItem({ label, value }: { label: string; value?: number }) {
  return (
    <div className="p-6 text-center border-r last:border-0 hover:bg-muted/20 transition-colors">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-black">{value || '--'}</p>
    </div>
  );
}
