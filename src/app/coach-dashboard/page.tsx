'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users, ShieldCheck, Trophy, TrendingUp, AlertTriangle,
  CheckCircle2, Plus, ChevronRight, Calendar, Activity, Star, Loader2, Building2
} from 'lucide-react';
import Link from 'next/link';
import type { ClubMember, AthleteProfile, ClubMatch, ClubProfile } from '@/lib/types';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function CoachOverviewPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: clubProfile } = useDoc<ClubProfile>(clubRef);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const stats = useMemo(() => {
    const total = athletes?.length ?? 0;
    const verified = athletes?.filter(a => a.isVerified).length ?? 0;
    const pending = total - verified;
    const avgCSI = total > 0
      ? Math.round((athletes ?? []).reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / total)
      : 0;
    return { total, verified, pending, avgCSI };
  }, [athletes]);

  const upcomingMatches = useMemo(() => {
    if (!matches) return [];
    const now = new Date().toISOString();
    return matches
      .filter(m => !m.result && m.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [matches]);

  const thisMonthMatches = useMemo(() => {
    if (!matches) return 0;
    const now = new Date();
    return matches.filter(m => {
      try {
        const d = parseISO(m.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } catch { return false; }
    }).length;
  }, [matches]);

  const topPerformers = useMemo(() => {
    if (!athletes) return [];
    return [...athletes]
      .sort((a, b) => (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0))
      .slice(0, 3);
  }, [athletes]);

  const flaggedAthletes = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => (a.riskIndex ?? 0) >= 60).slice(0, 3);
  }, [athletes]);

  const pendingVerification = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => !a.isVerified).slice(0, 3);
  }, [athletes]);

  if (memberLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Building2 className="h-12 w-12 text-[#94A3B8]" />
        <p className="text-white font-black">Not affiliated with a club yet.</p>
        <p className="text-[#94A3B8] text-sm">Contact your club admin to be added to a club.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Coach Overview
          </h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            {clubProfile?.clubName ?? 'Your Club'} · Command Centre
          </p>
        </div>
        <Link href="/coach-dashboard/match-entry">
          <Button className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase tracking-wide h-9 gap-2">
            <Plus className="h-4 w-4" />
            Add Match
          </Button>
        </Link>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Squad Size', value: stats.total, icon: Users, sub: 'Athletes', color: 'text-white', bg: 'bg-[#1C2333]' },
          { label: 'Pending Verifications', value: stats.pending, icon: ShieldCheck, sub: 'Awaiting review', color: 'text-[#FF6D00]', bg: 'bg-[#FF6D00]/10', href: '/coach-dashboard/verify' },
          { label: 'Matches This Month', value: thisMonthMatches, icon: Trophy, sub: 'Logged', color: 'text-[#00C853]', bg: 'bg-[#00C853]/10' },
          { label: 'Avg Composite', value: stats.avgCSI || '--', icon: TrendingUp, sub: 'Squad CSI', color: 'text-white', bg: 'bg-[#1C2333]' },
        ].map((card) => (
          <Link key={card.label} href={(card as any).href ?? '#'} className={(card as any).href ? '' : 'pointer-events-none'}>
            <Card className={`border border-[#1E293B] ${card.bg} shadow-xl hover:border-[#00C853]/30 transition-colors`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest leading-tight">{card.label}</p>
                  <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </div>
                <div className={`text-3xl font-black mt-2 ${card.color}`}>{card.value}</div>
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending Verifications strip */}
      {pendingVerification.length > 0 ? (
        <Card className="border border-[#FF6D00]/30 bg-[#FF6D00]/5">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-black text-[#FF6D00] uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Action Required — Pending Verifications ({stats.pending})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {pendingVerification.map(a => (
              <div key={a.uid} className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7 rounded-lg shrink-0">
                    <AvatarImage src={a.photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                      {a.firstName[0]}{a.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position}</p>
                  </div>
                </div>
                <Link href="/coach-dashboard/verify">
                  <Button size="sm" className="bg-[#FF6D00] hover:bg-[#FF6D00]/90 text-white font-black text-[10px] uppercase h-7 px-3">
                    Verify
                  </Button>
                </Link>
              </div>
            ))}
            {stats.pending > 3 && (
              <Link href="/coach-dashboard/verify">
                <p className="text-[10px] font-black text-[#FF6D00] text-center pt-1 hover:underline">
                  +{stats.pending - 3} more → View all
                </p>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[#00C853]/30 bg-[#00C853]/5">
          <CheckCircle2 className="h-4 w-4 text-[#00C853] shrink-0" />
          <p className="text-[11px] font-black text-[#00C853] uppercase tracking-wide">All athletes verified ✓</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Squad Performance */}
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#00C853]" /> Squad Performance Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {flaggedAthletes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> High Risk Athletes
                </p>
                {flaggedAthletes.map(a => (
                  <div key={a.uid} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                    <span className="text-sm font-bold text-white">{a.firstName} {a.lastName}</span>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-black text-[9px]">
                      Risk {a.riskIndex ?? 0}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Link href="/coach-dashboard/analytics">
              <Button variant="outline" size="sm" className="w-full border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase tracking-wide gap-2">
                View Full Analytics <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Schedule */}
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#00C853]" /> Upcoming Fixtures
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {upcomingMatches.length > 0 ? upcomingMatches.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1C2333]">
                <div className="w-9 h-9 rounded-xl bg-[#00C853]/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-4 w-4 text-[#00C853]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">vs {m.opponent}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{m.competition}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-white">
                    {(() => { try { return format(parseISO(m.date), 'dd MMM'); } catch { return m.date; } })()}
                  </p>
                  <Badge className={cn('text-[8px] font-black border', m.category === 'league' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/20')}>
                    {m.category}
                  </Badge>
                </div>
              </div>
            )) : (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-[#94A3B8] mx-auto mb-2 opacity-40" />
                <p className="text-[#94A3B8] text-sm font-bold">No upcoming matches</p>
                <Link href="/coach-dashboard/match-entry">
                  <Button size="sm" variant="ghost" className="mt-2 text-[#00C853] font-black text-[10px] uppercase">
                    + Schedule Match
                  </Button>
                </Link>
              </div>
            )}
            <Link href="/coach-dashboard/schedule">
              <Button variant="outline" size="sm" className="w-full border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase tracking-wide gap-2">
                Full Schedule <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Squad Leaderboard */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardHeader className="p-4 pb-0 flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
            <Star className="h-4 w-4 text-[#00C853]" /> Squad Leaders · CSI Ranking
          </CardTitle>
          <Link href="/coach-dashboard/squad">
            <Button variant="ghost" size="sm" className="text-[#94A3B8] hover:text-white font-black text-[10px] uppercase h-7 gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4 pt-3">
          {topPerformers.length > 0 ? (
            <div className="space-y-2">
              {topPerformers.map((a, i) => (
                <div key={a.uid} className="flex items-center gap-3 p-3 rounded-xl bg-[#1C2333] hover:bg-[#1C2333]/80 transition-colors">
                  <span className={cn('text-[11px] font-black w-5 shrink-0', i === 0 ? 'text-[#00C853]' : 'text-[#94A3B8]')}>
                    #{i + 1}
                  </span>
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarImage src={a.photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                      {a.firstName[0]}{a.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position} · {a.age}y</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {a.isVerified && (
                      <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px] hidden sm:flex">✓ Verified</Badge>
                    )}
                    <div className="text-right">
                      <p className="text-xl font-black text-[#00C853]">{a.compositeScoutingIndex ?? '--'}</p>
                      <p className="text-[8px] font-bold text-[#94A3B8]">CSI</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-2 opacity-30" />
              <p className="text-[#94A3B8] text-sm font-bold">No squad athletes yet</p>
              <p className="text-[#94A3B8] text-xs mt-1">Athletes who join your club will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
