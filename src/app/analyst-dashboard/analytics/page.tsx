'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3, TrendingUp, TrendingDown, Target, Users, ShieldCheck, Activity, Zap } from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

function getRiskLabel(r: number) {
  if (r < 25) return { label: 'Low', color: 'text-green-500' };
  if (r < 50) return { label: 'Moderate', color: 'text-yellow-500' };
  if (r < 75) return { label: 'High', color: 'text-orange-500' };
  return { label: 'Very High', color: 'text-red-500' };
}

function StatBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AnalystAnalyticsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'csi' | 'risk' | 'age'>('csi');

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<any>(matchesQuery);

  const filtered = useMemo(() => {
    let list = athletes ?? [];
    if (positionFilter !== 'All') list = list.filter(a => a.position === positionFilter || a.altPositions?.includes(positionFilter));
    return [...list].sort((a, b) => {
      if (sortBy === 'csi') return (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0);
      if (sortBy === 'risk') return (b.riskIndex ?? 0) - (a.riskIndex ?? 0);
      return (a.age ?? 0) - (b.age ?? 0);
    });
  }, [athletes, positionFilter, sortBy]);

  const summary = useMemo(() => {
    const list = athletes ?? [];
    const posMap: Record<string, number> = {};
    list.forEach(a => { posMap[a.position ?? 'Unknown'] = (posMap[a.position ?? 'Unknown'] ?? 0) + 1; });
    const topPos = Object.entries(posMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const highRisk = list.filter(a => (a.riskIndex ?? 0) >= 75).length;
    const avgCSI = list.length ? Math.round(list.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / list.length) : 0;
    const maxCSI = list.length ? Math.max(...list.map(a => a.compositeScoutingIndex ?? 0)) : 0;

    const matchList = matches ?? [];
    const wins = matchList.filter((m: any) => m.result === 'W').length;
    const losses = matchList.filter((m: any) => m.result === 'L').length;
    const draws = matchList.filter((m: any) => m.result === 'D').length;
    const goalsFor = matchList.reduce((s: number, m: any) => s + (m.goalsFor ?? 0), 0);
    const goalsAgainst = matchList.reduce((s: number, m: any) => s + (m.goalsAgainst ?? 0), 0);

    return { topPos, highRisk, avgCSI, maxCSI, wins, losses, draws, goalsFor, goalsAgainst, totalMatches: matchList.length };
  }, [athletes, matches]);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Performance Analytics</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Squad intelligence & performance metrics</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Avg CSI', value: summary.avgCSI, icon: TrendingUp, color: 'text-green-500' },
          { label: 'High Risk', value: summary.highRisk, icon: Activity, color: 'text-red-500' },
          { label: 'Total Matches', value: summary.totalMatches, icon: Target, color: 'text-blue-500' },
          { label: 'Win / Draw / Loss', value: `${summary.wins}W ${summary.draws}D ${summary.losses}L`, icon: BarChart3, color: 'text-purple-500' },
        ].map(card => (
          <Card key={card.label} className="border-none shadow-md bg-background">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xl font-black">{card.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Match record */}
      {summary.totalMatches > 0 && (
        <Card className="border-none shadow-xl bg-background">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Season Record</CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Wins', value: summary.wins, pct: summary.totalMatches, color: 'bg-green-500' },
              { label: 'Draws', value: summary.draws, pct: summary.totalMatches, color: 'bg-yellow-500' },
              { label: 'Losses', value: summary.losses, pct: summary.totalMatches, color: 'bg-red-500' },
            ].map(r => (
              <div key={r.label} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">{r.label}</span>
                  <span className="font-black text-sm">{r.value}</span>
                </div>
                <StatBar value={r.value} max={r.pct} color={r.color} />
              </div>
            ))}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Goal Difference</p>
              <p className={`text-xl font-black ${summary.goalsFor >= summary.goalsAgainst ? 'text-green-500' : 'text-red-500'}`}>
                {summary.goalsFor >= summary.goalsAgainst ? '+' : ''}{summary.goalsFor - summary.goalsAgainst}
              </p>
              <p className="text-[9px] text-muted-foreground">{summary.goalsFor}F — {summary.goalsAgainst}A</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Position distribution */}
      {summary.topPos.length > 0 && (
        <Card className="border-none shadow-xl bg-background">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Position Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {summary.topPos.map(([pos, count]) => (
              <div key={pos} className="flex items-center gap-3">
                <Badge variant="secondary" className="w-14 justify-center text-[9px] font-black uppercase shrink-0">{pos}</Badge>
                <div className="flex-1">
                  <StatBar value={count} max={athletes?.length ?? 1} color="bg-primary" />
                </div>
                <span className="text-xs font-black w-4 text-right">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-player CSI table */}
      <Card className="border-none shadow-xl bg-background">
        <CardHeader className="bg-muted/50 border-b py-3 px-4 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Player Metrics</CardTitle>
          <div className="flex gap-2">
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-20 h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-24 h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csi">By CSI</SelectItem>
                <SelectItem value="risk">By Risk</SelectItem>
                <SelectItem value="age">By Age</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No athletes found</div>
          ) : (
            <div className="divide-y">
              {filtered.map((a, i) => {
                const risk = getRiskLabel(a.riskIndex ?? 0);
                return (
                  <div key={a.uid} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                      <AvatarImage src={a.photoUrl} className="object-cover" />
                      <AvatarFallback className="rounded-lg text-[10px] font-black">{a.firstName?.[0]}{a.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black truncate">{a.firstName} {a.lastName}</p>
                        {a.isVerified && <ShieldCheck className="w-3 h-3 text-green-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[8px] h-4 font-black px-1.5">{a.position ?? '—'}</Badge>
                        <span className={`text-[9px] font-black ${risk.color}`}>{risk.label} Risk</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black">{a.compositeScoutingIndex ?? '—'}</p>
                      <p className="text-[9px] text-muted-foreground">CSI</p>
                    </div>
                    <div className="w-20 hidden sm:block">
                      <StatBar value={a.compositeScoutingIndex ?? 0} max={summary.maxCSI || 100} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
