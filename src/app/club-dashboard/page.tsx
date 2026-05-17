'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, ShieldCheck, Clock, Search } from 'lucide-react';
import type { ClubMember, ScoutConnection, AthleteProfile, ClubProfile } from '@/lib/types';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PerformanceAlerts } from '@/components/club/performance-alerts';
import { SquadAnalytics } from '@/components/club/squad-analytics';

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

  if (isMembershipLoading || isConnectionsLoading || (athleteIds.length > 0 && isAthletesLoading)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Squad Command</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
            {clubProfile?.clubName || 'Organization'}{clubProfile?.location ? ` • ${clubProfile.location}` : ''}
          </p>
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
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center font-black text-muted-foreground uppercase text-xs shrink-0">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
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
    </div>
  );
}
