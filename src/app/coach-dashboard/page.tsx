'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users, ShieldCheck, Trophy, TrendingUp, AlertTriangle,
  CheckCircle2, Plus, ChevronRight, Calendar, Activity, Star,
  Loader2, Building2, Dumbbell, Clock, MessageSquare, Settings
} from 'lucide-react';
import Link from 'next/link';
import type { ClubMember, AthleteProfile, ClubMatch, ClubProfile, UserAccount } from '@/lib/types';
import { ClubInvitationsCard } from '@/components/scout/club-invitations-card';
import { CoachClubInvitations } from '@/components/coach/club-invitations';
import { useMemo } from 'react';
import { format, parseISO, formatDistanceToNow, isAfter } from 'date-fns';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface TrainingSession {
  id: string;
  clubId: string;
  title: string;
  date: string;
  duration: number;
  focus: string;
  attendees: string[];
  createdAt: string;
}

interface VerificationRecord {
  id: string;
  athleteId: string;
  athleteName: string;
  coachId: string;
  coachName: string;
  clubId: string;
  verifiedAt: string;
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

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount } = useDoc<UserAccount>(userDocRef);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const sessionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'training_sessions'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: trainingSessions } = useCollection<TrainingSession>(sessionsQuery);

  const verificationsQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'verifications'), where('coachId', '==', user.uid), orderBy('verifiedAt', 'desc'), limit(10))
      : null
  ), [firestore, user]);
  const { data: verifications } = useCollection<VerificationRecord>(verificationsQuery);

  const stats = useMemo(() => {
    const total = athletes?.length ?? 0;
    const verified = athletes?.filter(a => a.isVerified).length ?? 0;
    const pending = total - verified;
    const avgCSI = total > 0
      ? Math.round((athletes ?? []).reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / total)
      : 0;
    return { total, verified, pending, avgCSI };
  }, [athletes]);

  const nextSession = useMemo(() => {
    if (!trainingSessions) return null;
    const now = new Date().toISOString();
    return trainingSessions
      .filter(s => s.date >= now.slice(0, 10))
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [trainingSessions]);

  const upcomingMatches = useMemo(() => {
    if (!matches) return [];
    const now = new Date().toISOString();
    return matches
      .filter(m => !m.result && m.date >= now.slice(0, 10))
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

  const lastMOTMMatch = useMemo(() => {
    if (!matches) return null;
    return [...matches]
      .filter(m => m.result && (m as any).motmPlayerName)
      .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))[0] ?? null;
  }, [matches]);

  const flaggedAthletes = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => (a.riskIndex ?? 0) >= 60).slice(0, 3);
  }, [athletes]);

  const pendingVerification = useMemo(() => {
    if (!athletes) return [];
    return athletes.filter(a => !a.isVerified).slice(0, 3);
  }, [athletes]);

  // Recent Activity Feed — combine verifications + recent matches entries
  const activityFeed = useMemo(() => {
    const items: { id: string; icon: string; text: string; time: string; color: string }[] = [];

    (verifications ?? []).slice(0, 5).forEach(v => {
      items.push({
        id: `v-${v.id}`,
        icon: 'verify',
        text: `You verified ${v.athleteName}'s profile`,
        time: v.verifiedAt,
        color: '#00C853',
      });
    });

    const recentMatches = [...(matches ?? [])]
      .filter(m => m.result && m.createdAt)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 5);

    recentMatches.forEach(m => {
      items.push({
        id: `m-${m.id}`,
        icon: 'match',
        text: `Match entered — vs ${m.opponent} (${m.result ?? 'TBD'})`,
        time: m.createdAt ?? m.date,
        color: '#00C853',
      });
    });

    const recentSessions = [...(trainingSessions ?? [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);

    recentSessions.forEach(s => {
      items.push({
        id: `s-${s.id}`,
        icon: 'training',
        text: `Training session created — ${s.title}`,
        time: s.createdAt,
        color: '#3B82F6',
      });
    });

    return items
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 10);
  }, [verifications, matches, trainingSessions]);

  if (memberLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Coach Overview</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">Command Centre</p>
        </div>
        <ClubInvitationsCard />
        <CoachClubInvitations coachUid={user?.uid ?? ''} coachName={userAccount ? `${(userAccount as any).firstName || ''} ${(userAccount as any).lastName || ''}`.trim() : 'Coach'} />
        <div className="rounded-2xl border border-[#00C853]/30 bg-[#00C853]/5 p-8 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#00C853]/15 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-[#00C853]" />
          </div>
          <div className="space-y-1">
            <p className="text-white font-black text-lg">You're not affiliated with a club yet</p>
            <p className="text-[#94A3B8] text-sm max-w-xs">
              Browse clubs and send a join request, or ask your club admin to share the invite link.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/coach-dashboard/find-club">
              <Button className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2">
                <Users className="h-4 w-4" /> Browse Clubs
              </Button>
            </Link>
            <Link href="/coach-dashboard/settings">
              <Button variant="outline" className="border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-xs uppercase gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">What happens next?</p>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Find your club', desc: 'Browse the directory and submit a join request as a coach.' },
              { step: '2', title: 'Admin approves', desc: 'The club admin reviews and approves your application.' },
              { step: '3', title: 'Full access', desc: 'Manage your squad, verify athletes, enter match data, and more.' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-black text-white">{s.title}</p>
                  <p className="text-[11px] text-[#94A3B8]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          { label: 'Squad Size', value: stats.total, icon: Users, sub: 'Athletes', color: 'text-white', bg: 'bg-[#1C2333]', href: '/coach-dashboard/squad' },
          { label: 'Pending Verifications', value: stats.pending, icon: ShieldCheck, sub: 'Awaiting review', color: 'text-[#FF6D00]', bg: 'bg-[#FF6D00]/10', href: '/coach-dashboard/verify' },
          { label: 'Matches This Month', value: thisMonthMatches, icon: Trophy, sub: 'Logged', color: 'text-[#00C853]', bg: 'bg-[#00C853]/10', href: '/coach-dashboard/match-entry' },
          {
            label: 'Next Session',
            value: nextSession ? (() => { try { return format(parseISO(nextSession.date), 'dd MMM'); } catch { return nextSession.date; } })() : '—',
            icon: Dumbbell,
            sub: nextSession ? nextSession.title : 'No upcoming',
            color: 'text-white',
            bg: 'bg-[#1C2333]',
            href: '/coach-dashboard/schedule',
          },
        ].map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className={`border border-[#1E293B] ${card.bg} shadow-xl hover:border-[#00C853]/30 transition-colors`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest leading-tight">{card.label}</p>
                  <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </div>
                <div className={`text-2xl font-black mt-2 ${card.color} truncate`}>{card.value}</div>
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest mt-1 truncate">{card.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Performance Intelligence Banner */}
      {(athletes?.length ?? 0) > 0 && (
        <Link href="/coach-dashboard/analytics">
          <Card className="border border-[#1E293B] bg-gradient-to-r from-[#111827] to-[#0d1f2d] hover:border-[#00C853]/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] font-black text-[#00C853] uppercase tracking-widest mb-1">Performance Intelligence</p>
                  <div className="flex items-center gap-5 flex-wrap">
                    <div>
                      <span className="text-xl font-black text-white">{stats.avgCSI}</span>
                      <span className="text-[9px] font-black text-[#94A3B8] ml-1 uppercase">Avg CSI</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-red-400">
                        {athletes?.filter(a => (a.riskIndex ?? 0) >= 60).length ?? 0}
                      </span>
                      <span className="text-[9px] font-black text-[#94A3B8] ml-1 uppercase">High Risk</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-[#00C853]">
                        {matches?.filter(m => m.result === 'W').length ?? 0}W
                      </span>
                      <span className="text-xl font-black text-yellow-400 ml-2">
                        {matches?.filter(m => m.result === 'D').length ?? 0}D
                      </span>
                      <span className="text-xl font-black text-red-400 ml-2">
                        {matches?.filter(m => m.result === 'L').length ?? 0}L
                      </span>
                      <span className="text-[9px] font-black text-[#94A3B8] ml-1 uppercase">Season</span>
                    </div>
                    {(() => {
                      const gf = (matches ?? []).reduce((s, m) => s + ((m as any).goalsFor ?? 0), 0);
                      const ga = (matches ?? []).reduce((s, m) => s + ((m as any).goalsAgainst ?? 0), 0);
                      const gd = gf - ga;
                      return (matches ?? []).length > 0 ? (
                        <div>
                          <span className={`text-xl font-black ${gd >= 0 ? 'text-[#00C853]' : 'text-red-400'}`}>
                            {gd >= 0 ? '+' : ''}{gd}
                          </span>
                          <span className="text-[9px] font-black text-[#94A3B8] ml-1 uppercase">GD</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#94A3B8]">
                  <span className="text-[10px] font-black uppercase">View Analytics</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

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
                    Verify Now
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

      {/* Last Match Best Player */}
      {lastMOTMMatch && (
        <Card className="border border-[#FF6D00]/30 bg-gradient-to-r from-[#FF6D00]/10 to-[#FF6D00]/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#FF6D00]/20 flex items-center justify-center shrink-0">
                <Star className="h-6 w-6 text-[#FF6D00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-[#FF6D00] uppercase tracking-widest">Man of the Match</p>
                <p className="text-xl font-black text-white truncate">{(lastMOTMMatch as any).motmPlayerName}</p>
                <p className="text-[10px] font-bold text-[#94A3B8] mt-0.5">
                  vs {lastMOTMMatch.opponent} · {lastMOTMMatch.score ?? lastMOTMMatch.result} ·{' '}
                  {(() => { try { return format(parseISO(lastMOTMMatch.date), 'dd MMM yyyy'); } catch { return lastMOTMMatch.date; } })()}
                </p>
              </div>
              <div className="shrink-0">
                <Badge className={cn(
                  'font-black border text-sm px-3 py-1',
                  lastMOTMMatch.result === 'W' ? 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/30' :
                    lastMOTMMatch.result === 'L' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-[#94A3B8]/20 text-[#94A3B8] border-[#94A3B8]/30'
                )}>
                  {lastMOTMMatch.result}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Squad Performance */}
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#00C853]" /> Squad Performance Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-[#1C2333] rounded-xl">
                <p className="text-lg font-black text-[#00C853]">{stats.total}</p>
                <p className="text-[8px] font-black text-[#94A3B8] uppercase">Players</p>
              </div>
              <div className="text-center p-2 bg-[#1C2333] rounded-xl">
                <p className="text-lg font-black text-[#00C853]">{stats.verified}</p>
                <p className="text-[8px] font-black text-[#94A3B8] uppercase">Verified</p>
              </div>
              <div className="text-center p-2 bg-[#1C2333] rounded-xl">
                <p className="text-lg font-black text-white">{stats.avgCSI || '--'}</p>
                <p className="text-[8px] font-black text-[#94A3B8] uppercase">Avg CSI</p>
              </div>
            </div>
            {flaggedAthletes.length > 0 && (
              <div className="space-y-1.5">
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
            {topPerformers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-[#00C853] uppercase tracking-widest flex items-center gap-1">
                  <Star className="h-3 w-3" /> Top Performer
                </p>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-[#00C853]/5 border border-[#00C853]/20">
                  <Avatar className="h-7 w-7 rounded-lg shrink-0">
                    <AvatarImage src={topPerformers[0].photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                      {topPerformers[0].firstName[0]}{topPerformers[0].lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-black text-white flex-1">{topPerformers[0].firstName} {topPerformers[0].lastName}</span>
                  <span className="text-lg font-black text-[#00C853]">{topPerformers[0].compositeScoutingIndex ?? '--'}</span>
                </div>
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

      {/* Recent Activity Feed */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardHeader className="p-4 pb-0 flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#00C853]" /> Recent Activity
          </CardTitle>
          <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[9px]">Last 10 events</Badge>
        </CardHeader>
        <CardContent className="p-4">
          {activityFeed.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-[#94A3B8] text-sm font-bold">No activity yet</p>
              <p className="text-[#94A3B8] text-xs mt-1">Your activity will appear here as you verify athletes and log matches.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {activityFeed.map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.color }} />
                    {i < activityFeed.length - 1 && (
                      <div className="w-px flex-1 bg-[#1E293B] mt-1" style={{ minHeight: '16px' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[13px] font-semibold text-white leading-snug">{item.text}</p>
                    <p className="text-[10px] text-[#94A3B8] font-bold mt-0.5">
                      {(() => {
                        try { return formatDistanceToNow(new Date(item.time), { addSuffix: true }); }
                        catch { return item.time; }
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
