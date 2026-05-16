'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, Target, ShieldCheck, TrendingUp, AlertCircle, Clock, Search } from 'lucide-react';
import type { ClubMember, ScoutConnection, AthleteProfile, ClubProfile } from '@/lib/types';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PerformanceAlerts } from '@/components/club/performance-alerts';

export default function ClubOverviewPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [posFilter, setPosFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  // 1. Get current user's club ID
  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: clubMemberships, isLoading: isMembershipLoading } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = clubMemberships?.[0]?.clubId;

  // 2. Get club profile
  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: clubProfile } = useDoc<ClubProfile>(clubRef);

  // 3. Get all athletes connected to this club
  const connectionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
  ), [firestore, clubId]);
  const { data: connections, isLoading: isConnectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const athleteIds = React.useMemo(() => [...new Set(connections?.map(c => c.athleteId) || [])], [connections]);

  // 4. Get athlete profiles
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">SQUAD COMMAND</h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
            {clubProfile?.clubName || 'Organization'} &bull; {clubProfile?.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger className="w-[140px] h-9 bg-background"><SelectValue placeholder="Position" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    <SelectItem value="forward">Forward</SelectItem>
                    <SelectItem value="midfielder">Midfielder</SelectItem>
                    <SelectItem value="defender">Defender</SelectItem>
                    <SelectItem value="goalkeeper">Goalkeeper</SelectItem>
                </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[140px] h-9 bg-background"><SelectValue placeholder="Tier" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="semi-pro">Semi-Pro</SelectItem>
                    <SelectItem value="developing">Developing</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-neutral-900 text-white border-none shadow-xl overflow-hidden">
          <CardHeader className="p-4 pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Total Players</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-4xl font-black">{stats.count}</div>
            <p className="text-[9px] font-bold text-primary mt-1 tracking-widest uppercase">Squad Density</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg. Squad Age</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black">{stats.avgAge}</div>
            <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Years</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg. CSI Score</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-primary">{stats.avgCSI}</div>
            <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Institutional Grade</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verified Profiles</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-green-600">{stats.verified}</div>
            <div className="flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3 h-3 text-green-600" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Coach Confirmed</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="p-4 pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black text-orange-500">{stats.pending}</div>
            <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-orange-500" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Self Reported</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <div className="col-span-4 space-y-6">
            <Card className="border-none shadow-xl bg-background overflow-hidden">
                <CardHeader className="bg-neutral-50 border-b p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest">Squad Distribution</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Composite Index Rankings</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest">Export Pool</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {athletes?.slice(0, 5).sort((a,b) => (b.compositeScoutingIndex || 0) - (a.compositeScoutingIndex || 0)).map(a => (
                            <div key={a.uid} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-muted-foreground uppercase">
                                        {a.firstName[0]}{a.lastName[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase leading-none">{a.firstName} {a.lastName}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{a.position} &bull; {a.age}yrs</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-primary leading-none">{a.compositeScoutingIndex || '--'}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">CSI RATING</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-background overflow-hidden">
                <CardHeader className="bg-neutral-50 border-b p-6">
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Organization Health</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-tight">System Integrity Score</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
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
                    
                    <div className="pt-4 border-t space-y-3">
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

        <div className="col-span-3">
            <PerformanceAlerts athletes={athletes || []} />
        </div>
      </div>
    </div>
  );
}
