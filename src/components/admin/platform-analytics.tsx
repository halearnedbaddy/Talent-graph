'use client';

import { useMemo, useEffect, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, Trophy, Building2, UserSearch, Activity, TrendingUp, MapPin, Target, Eye } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import type { AthleteProfile, UserAccount } from '@/lib/types';
import { format, parseISO, startOfMonth, isValid } from 'date-fns';

const ROLE_COLORS: Record<string, string> = {
  athlete: '#00d4aa',
  scout: '#3b82f6',
  coach: '#f59e0b',
  admin: '#8b5cf6',
  analyst: '#ec4899',
  club: '#10b981',
};

const POSITION_ORDER = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

function KPICard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-muted/60 shrink-0`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RawView { athleteId: string; viewerRole: string; viewedAt: string; }

export function PlatformAnalytics() {
  const firestore = useFirestore();

  const usersQ = useMemoFirebase(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserAccount>(usersQ);

  const athletesQ = useMemoFirebase(() => (firestore ? collection(firestore, 'athletes') : null), [firestore]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQ);

  const clubsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'clubs') : null), [firestore]);
  const { data: clubs, isLoading: clubsLoading } = useCollection<any>(clubsQ);

  const scoutsQ = useMemoFirebase(() => (firestore ? collection(firestore, 'scouts') : null), [firestore]);
  const { data: scouts, isLoading: scoutsLoading } = useCollection<any>(scoutsQ);

  const matchesQ = useMemoFirebase(() => (firestore ? collection(firestore, 'matches') : null), [firestore]);
  const { data: matches, isLoading: matchesLoading } = useCollection<any>(matchesQ);

  // ── Profile views — collectionGroup across all athletes ────────────────────
  const [rawViews, setRawViews] = useState<RawView[]>([]);
  const [viewsLoading, setViewsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    let cancelled = false;
    setViewsLoading(true);
    getDocs(collectionGroup(firestore, 'viewers'))
      .then(snap => {
        if (cancelled) return;
        const rows: RawView[] = snap.docs.map(d => ({
          athleteId: d.ref.parent.parent?.id ?? '',
          viewerRole: d.data().viewerRole ?? 'unknown',
          viewedAt: d.data().viewedAt ?? '',
        })).filter(r => r.athleteId);
        setRawViews(rows);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setViewsLoading(false); });
    return () => { cancelled = true; };
  }, [firestore]);

  const isLoading = usersLoading || athletesLoading || clubsLoading || scoutsLoading || matchesLoading;

  const kpis = useMemo(() => {
    const u = users ?? [];
    const byRole = u.reduce<Record<string, number>>((acc, user) => {
      const r = user.role ?? 'unknown';
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalUsers: u.length,
      athletes: byRole.athlete ?? 0,
      scouts: byRole.scout ?? 0,
      coaches: byRole.coach ?? 0,
      clubs: clubs?.length ?? 0,
      matches: (matches ?? []).filter(m => !m.isDraft).length,
      avgCSI: athletes?.length
        ? Math.round((athletes.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0)) / athletes.length)
        : 0,
      verified: (athletes ?? []).filter(a => a.isVerified).length,
    };
  }, [users, athletes, clubs, matches]);

  const registrationsByMonth = useMemo(() => {
    const u = users ?? [];
    const buckets: Record<string, { month: string; Athletes: number; Scouts: number; Coaches: number }> = {};
    u.forEach(user => {
      const raw = (user as any).creationTimestamp ?? (user as any).createdAt;
      if (!raw) return;
      const date = parseISO(raw);
      if (!isValid(date)) return;
      const key = format(startOfMonth(date), 'MMM yy');
      if (!buckets[key]) buckets[key] = { month: key, Athletes: 0, Scouts: 0, Coaches: 0 };
      if (user.role === 'athlete') buckets[key].Athletes++;
      else if (user.role === 'scout') buckets[key].Scouts++;
      else if (user.role === 'coach') buckets[key].Coaches++;
    });
    return Object.values(buckets).slice(-12);
  }, [users]);

  const csiDistribution = useMemo(() => {
    const buckets: Record<string, number> = {
      '0–19': 0, '20–39': 0, '40–59': 0, '60–79': 0, '80–100': 0,
    };
    (athletes ?? []).forEach(a => {
      const v = a.compositeScoutingIndex ?? 0;
      if (v < 20) buckets['0–19']++;
      else if (v < 40) buckets['20–39']++;
      else if (v < 60) buckets['40–59']++;
      else if (v < 80) buckets['60–79']++;
      else buckets['80–100']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [athletes]);

  const byPosition = useMemo(() => {
    const map: Record<string, number> = {};
    (athletes ?? []).forEach(a => { if (a.position) map[a.position] = (map[a.position] ?? 0) + 1; });
    return POSITION_ORDER.filter(p => map[p]).map(p => ({ position: p, count: map[p] }));
  }, [athletes]);

  const byCounty = useMemo(() => {
    const map: Record<string, number> = {};
    (athletes ?? []).forEach(a => { if (a.county) map[a.county] = (map[a.county] ?? 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([county, count]) => ({ county, count }));
  }, [athletes]);

  const matchesByMonth = useMemo(() => {
    const buckets: Record<string, number> = {};
    (matches ?? []).filter(m => !m.isDraft).forEach(m => {
      const raw = m.date ?? m.createdAt;
      if (!raw) return;
      const date = parseISO(raw);
      if (!isValid(date)) return;
      const key = format(startOfMonth(date), 'MMM yy');
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    return Object.entries(buckets).slice(-12).map(([month, matches]) => ({ month, matches }));
  }, [matches]);

  const topAthletes = useMemo(() => {
    return [...(athletes ?? [])]
      .sort((a, b) => (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0))
      .slice(0, 10);
  }, [athletes]);

  const roleBreakdown = useMemo(() => {
    const u = users ?? [];
    const map: Record<string, number> = {};
    u.forEach(user => { const r = user.role ?? 'unknown'; map[r] = (map[r] ?? 0) + 1; });
    return Object.entries(map).map(([role, count]) => ({ role, count }));
  }, [users]);

  // ── Profile-views leaderboard ──────────────────────────────────────────────
  const viewsLeaderboard = useMemo(() => {
    const tally: Record<string, number> = {};
    rawViews.forEach(v => { tally[v.athleteId] = (tally[v.athleteId] ?? 0) + 1; });
    const athleteMap: Record<string, AthleteProfile> = {};
    (athletes ?? []).forEach(a => { athleteMap[a.uid] = a; });
    return Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([athleteId, views]) => {
        const a = athleteMap[athleteId];
        return {
          athleteId,
          name: a ? `${a.firstName} ${a.lastName}` : 'Unknown',
          position: a?.position ?? '—',
          county: a?.county ?? '—',
          csi: a?.compositeScoutingIndex ?? 0,
          isVerified: a?.isVerified ?? false,
          views,
        };
      });
  }, [rawViews, athletes]);

  const viewsByMonth = useMemo(() => {
    const buckets: Record<string, number> = {};
    rawViews.forEach(v => {
      if (!v.viewedAt) return;
      const date = parseISO(v.viewedAt);
      if (!isValid(date)) return;
      const key = format(startOfMonth(date), 'MMM yy');
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    return Object.entries(buckets).slice(-12).map(([month, views]) => ({ month, views }));
  }, [rawViews]);

  const viewsByRole = useMemo(() => {
    const map: Record<string, number> = {};
    rawViews.forEach(v => { map[v.viewerRole] = (map[v.viewerRole] ?? 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => ({ role, count }));
  }, [rawViews]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Users" value={kpis.totalUsers} sub={`${kpis.athletes} athletes`} color="text-primary" />
        <KPICard icon={UserSearch} label="Scouts" value={kpis.scouts} sub={`${kpis.coaches} coaches`} color="text-blue-500" />
        <KPICard icon={Building2} label="Clubs" value={kpis.clubs} color="text-emerald-500" />
        <KPICard icon={Trophy} label="Matches" value={kpis.matches} sub="published" color="text-amber-500" />
        <KPICard icon={Target} label="Avg CSI" value={kpis.avgCSI} sub="composite scouting index" color="text-violet-500" />
        <KPICard icon={Activity} label="Verified" value={kpis.verified} sub="athlete profiles" color="text-cyan-500" />
        <KPICard
          icon={Eye}
          label="Profile Views"
          value={viewsLoading ? '…' : rawViews.length}
          sub={viewsLoading ? 'loading…' : `${viewsLeaderboard.length} athletes viewed`}
          color="text-fuchsia-500"
        />
        <KPICard icon={MapPin} label="Positions" value={byPosition.length} sub="tracked positions" color="text-rose-500" />
      </div>

      {/* Registrations over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest">New Registrations by Month</CardTitle>
          <CardDescription>Athletes, scouts, and coaches joining the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {registrationsByMonth.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No registration data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={registrationsByMonth} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Athletes" stroke="#00d4aa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Scouts" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Coaches" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">

        {/* CSI Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">CSI Score Distribution</CardTitle>
            <CardDescription>How athletes are spread across scouting index bands</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={csiDistribution} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Athletes" fill="#00d4aa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Athletes by position */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Athletes by Position</CardTitle>
            <CardDescription>Distribution of positions across all registered athletes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPosition} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="position" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Athletes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Athletes by county */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Top Counties by Athletes</CardTitle>
            <CardDescription>Geographic distribution — top 12 counties</CardDescription>
          </CardHeader>
          <CardContent>
            {byCounty.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No county data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byCounty} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="county" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" name="Athletes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Matches published per month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Matches Published by Month</CardTitle>
            <CardDescription>Coach-entered match records over time</CardDescription>
          </CardHeader>
          <CardContent>
            {matchesByMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No match data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={matchesByMonth} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="matches" name="Matches" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User role breakdown pie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest">User Breakdown by Role</CardTitle>
          <CardDescription>Proportion of platform users across all roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie
                  data={roleBreakdown}
                  dataKey="count"
                  nameKey="role"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {roleBreakdown.map((entry) => (
                    <Cell key={entry.role} fill={ROLE_COLORS[entry.role] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3">
              {roleBreakdown.sort((a, b) => b.count - a.count).map(({ role, count }) => (
                <div key={role} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ background: ROLE_COLORS[role] ?? '#94a3b8' }}
                  />
                  <span className="capitalize font-semibold">{role}</span>
                  <span className="text-muted-foreground">({count})</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top athletes table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest">Top 10 Athletes by CSI</CardTitle>
          <CardDescription>Highest composite scouting index scores across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {topAthletes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No athletes yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">Athlete</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">Pos</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">Age</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">County</th>
                    <th className="text-right py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">CSI</th>
                  </tr>
                </thead>
                <tbody>
                  {topAthletes.map((a, i) => (
                    <tr key={a.uid} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        {a.firstName} {a.lastName}
                        {a.isVerified && <span className="ml-1.5 text-[10px] text-primary font-black">✓</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{a.position ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{a.age ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{a.county ?? '—'}</td>
                      <td className="py-2.5 text-right font-black text-primary">{a.compositeScoutingIndex ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Profile Views section ──────────────────────────────────────────── */}

      {/* Views over time + by viewer role */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Eye className="h-4 w-4 text-fuchsia-500" /> Profile Views by Month
            </CardTitle>
            <CardDescription>Total athlete profile views across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {viewsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : viewsByMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No view data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={viewsByMonth} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="views" name="Profile Views" fill="#d946ef" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Eye className="h-4 w-4 text-fuchsia-500" /> Views by Viewer Role
            </CardTitle>
            <CardDescription>Which roles are viewing athlete profiles most</CardDescription>
          </CardHeader>
          <CardContent>
            {viewsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : viewsByRole.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No view data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={viewsByRole} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Views" radius={[4, 4, 0, 0]}>
                    {viewsByRole.map(entry => (
                      <Cell key={entry.role} fill={ROLE_COLORS[entry.role] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most-viewed athletes leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Eye className="h-4 w-4 text-fuchsia-500" /> Most Viewed Athletes
          </CardTitle>
          <CardDescription>Top 15 athlete profiles by total scout / recruiter views</CardDescription>
        </CardHeader>
        <CardContent>
          {viewsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : viewsLeaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No profile view data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">Athlete</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">Pos</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">County</th>
                    <th className="text-left py-2 pr-4 text-xs font-black uppercase tracking-wider text-muted-foreground">CSI</th>
                    <th className="text-right py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {viewsLeaderboard.map((row, i) => (
                    <tr key={row.athleteId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        {row.name}
                        {row.isVerified && <span className="ml-1.5 text-[10px] text-primary font-black">✓</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.position}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.county}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.csi}</td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 font-black text-fuchsia-500">
                          <Eye className="h-3 w-3" />{row.views}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
