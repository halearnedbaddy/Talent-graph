'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, Clock, Trophy, Target, BookOpen, TrendingUp, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ClubMember, ScoutConnection, AthleteProfile, ClubProfile, ClubMatch } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PerformanceAlerts } from '@/components/club/performance-alerts';
import { SquadAnalytics } from '@/components/club/squad-analytics';
import { RecruitmentPipeline } from '@/components/club/recruitment-pipeline';

export default function ClubOverviewPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [posFilter, setPosFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: clubMemberships, isLoading: isMembershipLoading } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = clubMemberships?.[0]?.clubId;

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: clubProfile } = useDoc<ClubProfile>(clubRef);

  const connectionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
  ), [firestore, clubId]);
  const { data: connections, isLoading: isConnectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const athleteIds = React.useMemo(() => [...new Set(connections?.map(c => c.athleteId) || [])], [connections]);

  const athletesQuery = useMemoFirebase(() => (
    firestore && athleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', athleteIds)) : null
  ), [firestore, athleteIds.join(',')]);
  const { data: athletes, isLoading: isAthletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const seasonStats = React.useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const played = matches.filter(m => m.result).length;
    const wins = matches.filter(m => m.result === 'W').length;
    const draws = matches.filter(m => m.result === 'D').length;
    const losses = matches.filter(m => m.result === 'L').length;
    let goalsFor = 0, goalsAgainst = 0;
    matches.forEach(m => {
      if (m.score) {
        const parts = m.score.split('-').map(s => parseInt(s.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          goalsFor += parts[0];
          goalsAgainst += parts[1];
        }
      }
    });
    const totalYellows = matches.reduce((s, m) => s + (m.totalYellowCards || 0), 0);
    const totalReds = matches.reduce((s, m) => s + (m.totalRedCards || 0), 0);
    return { played, wins, draws, losses, goalsFor, goalsAgainst, goalDiff: goalsFor - goalsAgainst, totalYellows, totalReds };
  }, [matches]);

  const leaderboards = React.useMemo(() => {
    if (!athletes || athletes.length === 0) return { topScorer: null, topAssister: null, mostBooked: null };
    let topScorer: { name: string; value: number; photo?: string; position?: string } | null = null;
    let topAssister: { name: string; value: number; photo?: string; position?: string } | null = null;
    let mostBooked: { name: string; value: number; photo?: string; position?: string } | null = null;
    athletes.forEach(a => {
      const goals = (a.matchHistory || []).reduce((s, m) => s + (m.goals || 0), 0);
      const assists = (a.matchHistory || []).reduce((s, m) => s + (m.assists || 0), 0);
      const bookings = (a.matchHistory || []).reduce((s, m) => s + (m.yellowCards || 0) + (m.redCards || 0), 0);
      const name = `${a.firstName} ${a.lastName}`;
      if (!topScorer || goals > topScorer.value) topScorer = { name, value: goals, photo: a.photoUrl, position: a.position };
      if (!topAssister || assists > topAssister.value) topAssister = { name, value: assists, photo: a.photoUrl, position: a.position };
      if (!mostBooked || bookings > mostBooked.value) mostBooked = { name, value: bookings, photo: a.photoUrl, position: a.position };
    });
    return { topScorer, topAssister, mostBooked };
  }, [athletes]);

  const stats = React.useMemo(() => {
    if (!athletes) return { count: 0, avgAge: 0, avgCSI: 0, verified: 0, pending: 0 };
    const filtered = athletes.filter(a => {
      const matchesPos = posFilter === 'all' || a.position?.toLowerCase() === posFilter.toLowerCase();
      const matchesTier = tierFilter === 'all' || a.readinessTier?.toLowerCase() === tierFilter.toLowerCase();
      return matchesPos && matchesTier;
    });
    const totalCSI = filtered.reduce((acc, a) => acc + (a.compositeScoutingIndex || 0), 0);
    const totalAge = filtered.reduce((acc, a) => acc + (a.age || 0), 0);
    return {
      count: filtered.length,
      avgAge: filtered.length > 0 ? (totalAge / filtered.length).toFixed(1) : 0,
      avgCSI: filtered.length > 0 ? Math.round(totalCSI / filtered.length) : 0,
      verified: filtered.filter(a => a.isVerified).length,
      pending: filtered.filter(a => !a.isVerified).length,
    };
  }, [athletes, posFilter, tierFilter]);

  const readinessCounts = React.useMemo(() => {
    if (!athletes) return { available: 0, doubtful: 0, injured: 0, suspended: 0 };
    const filtered = athletes.filter(a => {
      const matchesPos = posFilter === 'all' || a.position?.toLowerCase() === posFilter.toLowerCase();
      const matchesTier = tierFilter === 'all' || a.readinessTier?.toLowerCase() === tierFilter.toLowerCase();
      return matchesPos && matchesTier;
    });
    const getStatus = (a: AthleteProfile): 'available' | 'doubtful' | 'injured' | 'suspended' => {
      const readiness = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((a.readinessTier === 'Elite' || a.readinessTier === 'Pro') ? 90 : a.readinessTier === 'Advanced' ? 80 : a.readinessTier === 'Semi-Pro' ? 70 : a.readinessTier === 'Developing' ? 55 : 45) -
              Math.min(a.riskIndex || 0, 40) +
              (a.isVerified ? 10 : 0)
          )
        )
      );
      return readiness >= 80 ? 'available' : readiness >= 65 ? 'doubtful' : readiness >= 45 ? 'injured' : 'suspended';
    };
    return filtered.reduce(
      (acc, athlete) => {
        acc[getStatus(athlete)] += 1;
        return acc;
      },
      { available: 0, doubtful: 0, injured: 0, suspended: 0 }
    );
  }, [athletes, posFilter, tierFilter]);

  if (isMembershipLoading || isConnectionsLoading || (athleteIds.length > 0 && isAthletesLoading)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {clubProfile?.logoUrl && (
            <Avatar className="h-14 w-14 rounded-xl shrink-0 border shadow-sm">
              <AvatarImage src={clubProfile.logoUrl} alt={clubProfile.clubName} className="object-cover rounded-xl" />
              <AvatarFallback className="rounded-xl bg-primary/10 font-black text-primary text-lg uppercase">
                {clubProfile.clubName?.[0] ?? 'C'}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Squad Command</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
              {clubProfile?.clubName || 'Organization'}{clubProfile?.location ? ` • ${clubProfile.location}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={posFilter} onValueChange={setPosFilter}>
            <SelectTrigger className="h-10 min-h-[44px] flex-1 min-w-[130px] bg-background text-xs font-bold">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="forward">Forward</SelectItem>
              <SelectItem value="midfielder">Midfielder</SelectItem>
              <SelectItem value="defender">Defender</SelectItem>
              <SelectItem value="goalkeeper">Goalkeeper</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-10 min-h-[44px] flex-1 min-w-[130px] bg-background text-xs font-bold">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="semi-pro">Semi-Pro</SelectItem>
              <SelectItem value="developing">Developing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats grid - 2 cols on mobile, 5 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-neutral-900 text-white border-none shadow-xl col-span-2 sm:col-span-1">
          <CardHeader className="p-4 pb-1 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Players</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-4xl font-black">{stats.count}</div>
            <p className="text-[9px] font-bold text-primary mt-1 tracking-widest uppercase">Squad Density</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-1 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg. Age</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black">{stats.avgAge}</div>
            <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Years</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-1 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg. CSI</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-primary">{stats.avgCSI}</div>
            <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Rating</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-1 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-green-600">{stats.verified}</div>
            <div className="flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Confirmed</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-1 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-orange-500">{stats.pending}</div>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-orange-500" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b p-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Squad Readiness Board</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Coach availability tracker</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Available', value: readinessCounts.available, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-500/5 border-green-400/30' },
              { label: 'Doubtful', value: readinessCounts.doubtful, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/5 border-amber-400/30' },
              { label: 'Injured', value: readinessCounts.injured, icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-500/5 border-orange-400/30' },
              { label: 'Suspended', value: readinessCounts.suspended, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-500/5 border-red-400/30' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest">{item.label}</p>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className={`mt-2 text-3xl font-black ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Season Record + Leaderboards */}
      {seasonStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Season Record */}
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-neutral-950 text-white p-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Season Record</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">{seasonStats.played} matches played</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Win', value: seasonStats.wins, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-900' },
                  { label: 'Draw', value: seasonStats.draws, color: 'text-neutral-500', bg: 'bg-muted/40', border: 'border-border' },
                  { label: 'Loss', value: seasonStats.losses, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900' },
                  { label: 'GD', value: seasonStats.goalDiff > 0 ? `+${seasonStats.goalDiff}` : seasonStats.goalDiff, color: seasonStats.goalDiff >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-muted/40', border: 'border-border' },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.bg} ${stat.border}`}>
                    <p className={`text-2xl font-black leading-none ${stat.color}`}>{stat.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-muted-foreground">Goals For / Against</span>
                  <span className="font-black">{seasonStats.goalsFor} <span className="text-muted-foreground">—</span> {seasonStats.goalsAgainst}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${(seasonStats.goalsFor / Math.max(seasonStats.goalsFor + seasonStats.goalsAgainst, 1)) * 100}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${(seasonStats.goalsAgainst / Math.max(seasonStats.goalsFor + seasonStats.goalsAgainst, 1)) * 100}%` }} />
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{seasonStats.totalYellows} Yellows</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-600" /><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{seasonStats.totalReds} Reds</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboards */}
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-muted/50 border-b p-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Squad Leaders
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Based on logged match data</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {(
                [
                  { label: 'Top Scorer', icon: '⚽', leader: leaderboards.topScorer, unit: 'goals', color: 'text-green-600' },
                  { label: 'Most Assists', icon: '🎯', leader: leaderboards.topAssister, unit: 'assists', color: 'text-blue-600' },
                  { label: 'Most Booked', icon: '🟨', leader: leaderboards.mostBooked, unit: 'cards', color: 'text-yellow-600' },
                ] as Array<{ label: string; icon: string; leader: { name: string; value: number; photo?: string; position?: string } | null; unit: string; color: string }>
              ).map(({ label, icon, leader, unit, color }) => (
                <div key={label} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                      {leader ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Avatar className="w-6 h-6 rounded-md shrink-0">
                            <AvatarImage src={leader.photo} className="object-cover rounded-md" />
                            <AvatarFallback className="rounded-md bg-muted font-black text-[9px] text-muted-foreground uppercase">{leader.name[0]}</AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-black uppercase leading-none truncate">{leader.name}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">No data yet</p>
                      )}
                    </div>
                  </div>
                  {leader && (
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-2xl font-black leading-none ${color}`}>{leader.value}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">{unit}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main body - stacked on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        <div className="lg:col-span-4 space-y-5">
          {/* Squad distribution */}
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-muted/50 border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Top Squad</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-tight">By CSI Score</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-[10px] font-black uppercase tracking-widest">Export</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {athletes?.slice(0, 5).sort((a, b) => (b.compositeScoutingIndex || 0) - (a.compositeScoutingIndex || 0)).map(a => (
                  <div key={a.uid} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-9 h-9 rounded-xl shrink-0">
                        <AvatarImage src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} className="object-cover rounded-xl" />
                        <AvatarFallback className="rounded-xl bg-muted font-black text-muted-foreground uppercase text-xs">
                          {a.firstName[0]}{a.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase leading-none truncate">{a.firstName} {a.lastName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{a.position} • {a.age}y</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xl font-black text-primary leading-none">{a.compositeScoutingIndex || '--'}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">CSI</p>
                    </div>
                  </div>
                ))}
                {(!athletes || athletes.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest">No athletes linked yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Org health */}
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-muted/50 border-b p-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Organization Health</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-tight">System Integrity Score</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span>Data Freshness</span>
                  <span className="text-primary">85%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '85%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span>Verification Rate</span>
                  <span className="text-green-600">{Math.round((stats.verified / (stats.count || 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${(stats.verified / (stats.count || 1)) * 100}%` }} />
                </div>
              </div>
              <div className="pt-3 border-t space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary text-primary-foreground font-black h-5 text-[8px] px-1.5 tracking-tighter">LIVE</Badge>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recruitment Pipeline Active</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-black h-5 text-[8px] px-1.5 tracking-tighter">SCAN</Badge>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Automated CSI Benchmarking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <PerformanceAlerts athletes={athletes || []} />
        </div>
      </div>

      {/* Analytics section */}
      <SquadAnalytics athletes={athletes || []} />

      {/* Recruitment pipeline */}
      <RecruitmentPipeline connections={connections || []} athletes={athletes || []} />
    </div>
  );
}
