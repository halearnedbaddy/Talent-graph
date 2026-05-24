'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Trophy, TrendingUp, BarChart3, Target, Activity, FileText, MessageSquare } from 'lucide-react';
import type { ClubMember, AthleteProfile, ClubProfile } from '@/lib/types';
import Link from 'next/link';

export default function AnalystDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const membership = memberships?.[0];
  const clubId = membership?.clubId;

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: club } = useDoc<ClubProfile>(clubRef);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<any>(matchesQuery);

  if (memberLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!clubId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground" />
        <p className="font-black text-lg uppercase">Not Assigned to a Club</p>
        <p className="text-sm text-muted-foreground">Ask your club admin to add you as an analyst.</p>
      </div>
    );
  }

  const avgCSI = athletes?.length
    ? Math.round(athletes.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / athletes.length)
    : 0;
  const verified = athletes?.filter(a => a.isVerified).length ?? 0;
  const totalWins = matches?.filter((m: any) => m.result === 'W').length ?? 0;
  const totalMatches = matches?.length ?? 0;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const statCards = [
    { label: 'Squad Size', value: athletes?.length ?? 0, icon: Users, color: 'text-blue-500', link: '/analyst-dashboard/squad' },
    { label: 'Verified Athletes', value: verified, icon: Target, color: 'text-green-500', link: '/analyst-dashboard/squad' },
    { label: 'Avg CSI Score', value: avgCSI, icon: TrendingUp, color: 'text-yellow-500', link: '/analyst-dashboard/analytics' },
    { label: 'Win Rate', value: `${winRate}%`, icon: Trophy, color: 'text-purple-500', link: '/analyst-dashboard/matches' },
  ];

  const quickActions = [
    { label: 'Enter Match Data', icon: Trophy, href: '/analyst-dashboard/matches', desc: 'Log match performance & stats' },
    { label: 'Performance Analytics', icon: BarChart3, href: '/analyst-dashboard/analytics', desc: 'Deep-dive squad metrics' },
    { label: 'Squad View', icon: Users, href: '/analyst-dashboard/squad', desc: 'Browse athlete profiles' },
    { label: 'Communications', icon: MessageSquare, href: '/analyst-dashboard/messages', desc: 'Message coaching staff' },
  ];

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Analyst Overview</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
          {club?.clubName ?? 'Your Club'} — Performance Intelligence
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Link key={card.label} href={card.link}>
            <Card className="border-none shadow-lg bg-background hover:shadow-xl transition-shadow cursor-pointer">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                  <Activity className="w-3 h-3 text-muted-foreground/30" />
                </div>
                <p className="text-2xl font-black">{card.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-none shadow-xl bg-background">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href}>
              <div className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors group cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <action.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Role Notice */}
      <Card className="border border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-500 mb-1">Analyst Role</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              As an analyst you have full read access to squad profiles, match data entry, and performance analytics. 
              Communications go through the coaching staff. Athlete verification is handled by the head coach.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
