'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart3, Trophy, Loader2, Users, Star, Shield, Target, Activity,
  ArrowUpDown, ArrowUp, ArrowDown, Download, AlertTriangle,
} from 'lucide-react';
import type { ClubMatch, ClubMember, AthleteProfile, MatchEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
type VenueKey = 'all' | 'home' | 'away' | 'neutral';

interface PlayerRow {
  uid: string;
  name: string;
  position: string;
  username?: string;
  apps: number;
  goals: number;
  assists: number;
  shots: number;
  pom: number;
  mins: number;
  yellows: number;
  reds: number;
  fouls: number;
  saves: number;
  avgRating: number | null;
  won: number;
  drawn: number;
  lost: number;
  hasRisk: boolean;
}

interface VenueBucket {
  played: number;
  goals: number;
  conceded: number;
  won: number;
  lost: number;
  drawn: number;
  cleanSheets: number;
  attendance: number;
  attCount: number;
  yellows: number;
  reds: number;
  fouls: number;
  penalties: number;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function getVenueType(m: ClubMatch): 'home' | 'away' | 'neutral' {
  const v = (m.venue || '').toLowerCase().trim();
  if (v === 'home') return 'home';
  if (v === 'away') return 'away';
  return 'neutral';
}

function getMatchYear(m: ClubMatch) {
  return (m.date || '').slice(0, 4);
}

function getEntryYear(e: MatchEntry) {
  return ((e as any).date || '').slice(0, 4);
}

function parseScore(score?: string): [number, number] {
  if (!score) return [0, 0];
  const parts = score.split('-');
  return [Number(parts[0]) || 0, Number(parts[1]) || 0];
}

function emptyBucket(): VenueBucket {
  return {
    played: 0, goals: 0, conceded: 0, won: 0, lost: 0, drawn: 0,
    cleanSheets: 0, attendance: 0, attCount: 0, yellows: 0, reds: 0,
    fouls: 0, penalties: 0,
  };
}

function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = 'text-primary', icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <Card className="border-none shadow-md bg-background">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={cn('text-3xl font-black mt-1 leading-none truncate', color)}>{value}</p>
            {sub && (
              <p className="text-[9px] text-muted-foreground mt-1.5 font-bold uppercase tracking-wider truncate">{sub}</p>
            )}
          </div>
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SortIcon({ col, sortCol, dir }: { col: string; sortCol: string; dir: SortDir }) {
  if (col !== sortCol) return <ArrowUpDown className="w-3 h-3 opacity-25 ml-1 inline-block" />;
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 inline-block text-primary" />
    : <ArrowDown className="w-3 h-3 ml-1 inline-block text-primary" />;
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-muted-foreground font-mono">—</span>;
  const cls = rating >= 7
    ? 'bg-green-500/10 text-green-700 border-green-300'
    : rating >= 5
      ? 'bg-amber-500/10 text-amber-700 border-amber-300'
      : 'bg-red-500/10 text-red-700 border-red-300';
  return (
    <Badge variant="outline" className={cn('font-mono text-xs px-1.5 py-0', cls)}>
      {rating.toFixed(2)}
    </Badge>
  );
}

function SortableTh({
  col, sortCol, dir, onSort, children, className,
}: {
  col: string; sortCol: string; dir: SortDir;
  onSort: (c: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <TableHead
      className={cn(
        'text-[9px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-primary whitespace-nowrap transition-colors',
        className,
      )}
      onClick={() => onSort(col)}
    >
      {children}
      <SortIcon col={col} sortCol={sortCol} dir={dir} />
    </TableHead>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function VenueTableHeader() {
  return (
    <TableRow className="hover:bg-transparent bg-neutral-900">
      <TableHead className="text-[9px] font-black uppercase text-white sticky left-0 bg-neutral-900 min-w-[150px]">Metric</TableHead>
      <TableHead className="text-[9px] font-black uppercase text-white text-center min-w-[70px]">Total</TableHead>
      <TableHead className="text-[9px] font-black uppercase text-green-400 text-center min-w-[70px] bg-green-500/10">Home</TableHead>
      <TableHead className="text-[9px] font-black uppercase text-blue-400 text-center min-w-[70px] bg-blue-500/10">Away</TableHead>
      <TableHead className="text-[9px] font-black uppercase text-neutral-300 text-center min-w-[70px] bg-neutral-500/10">Neutral</TableHead>
    </TableRow>
  );
}

function VenueRow({
  label, all, home, away, neutral, fmt,
}: {
  label: string;
  all: number; home: number; away: number; neutral: number;
  fmt?: (n: number) => string;
}) {
  const f = fmt ?? String;
  return (
    <TableRow className="hover:bg-muted/20 border-b last:border-0">
      <TableCell className="font-black text-xs sticky left-0 bg-background/95 backdrop-blur whitespace-nowrap">{label}</TableCell>
      <TableCell className="text-center font-mono text-xs font-bold">{f(all)}</TableCell>
      <TableCell className="text-center font-mono text-xs bg-green-500/5">{f(home)}</TableCell>
      <TableCell className="text-center font-mono text-xs bg-blue-500/5">{f(away)}</TableCell>
      <TableCell className="text-center font-mono text-xs bg-neutral-500/5">{f(neutral)}</TableCell>
    </TableRow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatisticsHub() {
  const { user } = useUser();
  const firestore = useFirestore();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [season, setSeason] = useState<string>('all');
  const [matchType, setMatchType] = useState<string>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('players');

  // ── Player table sort ───────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('goals');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = useCallback((col: string) => {
    setSortDir(prev => sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortCol(col);
  }, [sortCol]);

  // ── Club context ─────────────────────────────────────────────────────────────
  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = memberships?.[0]?.clubId;

  // ── Data ─────────────────────────────────────────────────────────────────────
  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'matches'), where('clubId', '==', clubId))
      : null
  ), [firestore, clubId]);
  const { data: rawMatches, isLoading: matchesLoading } = useCollection<ClubMatch>(matchesQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId))
      : null
  ), [firestore, clubId]);
  const { data: rawAthletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  // ── Season list ──────────────────────────────────────────────────────────────
  const seasons = useMemo(() => {
    const years = new Set<string>();
    (rawMatches || []).forEach(m => { const y = getMatchYear(m); if (y) years.add(y); });
    return Array.from(years).sort().reverse();
  }, [rawMatches]);

  // ── Filtered matches ─────────────────────────────────────────────────────────
  const matches = useMemo(() => {
    let ms = rawMatches || [];
    if (season !== 'all') ms = ms.filter(m => getMatchYear(m) === season);
    if (matchType !== 'all') ms = ms.filter(m => (m.category || 'other') === matchType);
    if (venueFilter !== 'all') ms = ms.filter(m => getVenueType(m) === venueFilter);
    return ms;
  }, [rawMatches, season, matchType, venueFilter]);

  // ── Player rows ──────────────────────────────────────────────────────────────
  const playerRows = useMemo<PlayerRow[]>(() => {
    if (!rawAthletes) return [];
    return rawAthletes.map(a => {
      let history: MatchEntry[] = a.matchHistory || [];
      if (season !== 'all') history = history.filter(e => getEntryYear(e) === season);
      if (matchType !== 'all') history = history.filter(e => (e.category || 'other') === matchType);

      const apps     = history.reduce((s, e) => s + (Number(e.apps)        || 0), 0);
      const goals    = history.reduce((s, e) => s + (Number(e.goals)       || 0), 0);
      const assists  = history.reduce((s, e) => s + (Number(e.assists)     || 0), 0);
      const shots    = history.reduce((s, e) => s + (Number(e.shots)       || 0), 0);
      const fouls    = history.reduce((s, e) => s + (Number(e.fouls)       || 0), 0);
      const saves    = history.reduce((s, e) => s + (Number(e.saves)       || 0), 0);
      const mins     = history.reduce((s, e) => s + (Number(e.minutes)     || 0), 0);
      const yellows  = history.reduce((s, e) => s + (Number(e.yellowCards) || 0), 0);
      const reds     = history.reduce((s, e) => s + (Number(e.redCards)    || 0), 0);
      const pom      = history.filter(e => e.manOfTheMatch).length;

      const rated = history.filter(e => e.rating > 0);
      const avgRating = rated.length > 0
        ? rated.reduce((s, e) => s + e.rating, 0) / rated.length
        : null;

      const won   = history.filter(e => (e as any).result === 'W').length;
      const drawn = history.filter(e => (e as any).result === 'D').length;
      const lost  = history.filter(e => (e as any).result === 'L').length;

      return {
        uid: a.uid,
        name: `${a.firstName} ${a.lastName}`,
        position: a.position || '',
        username: a.username,
        apps, goals, assists, shots, fouls, saves,
        pom, mins, yellows, reds, avgRating, won, drawn, lost,
        hasRisk: yellows >= 4,
      };
    });
  }, [rawAthletes, season, matchType]);

  // ── Sorted player rows ───────────────────────────────────────────────────────
  const sortedPlayers = useMemo(() => {
    return [...playerRows].sort((a, b) => {
      const av = (a as any)[sortCol] ?? (sortCol === 'avgRating' ? -1 : 0);
      const bv = (b as any)[sortCol] ?? (sortCol === 'avgRating' ? -1 : 0);
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [playerRows, sortCol, sortDir]);

  // ── Venue buckets ─────────────────────────────────────────────────────────────
  const venueBuckets = useMemo(() => {
    const buckets: Record<VenueKey, VenueBucket> = {
      all: emptyBucket(), home: emptyBucket(), away: emptyBucket(), neutral: emptyBucket(),
    };

    for (const m of matches) {
      const vt = getVenueType(m);
      const [gs, gc] = parseScore(m.score);

      for (const key of ['all', vt] as VenueKey[]) {
        const b = buckets[key];
        b.played++;
        b.goals += gs;
        b.conceded += gc;
        if (m.result === 'W') b.won++;
        else if (m.result === 'L') b.lost++;
        else if (m.result === 'D') b.drawn++;
        if (gc === 0 && m.result !== undefined) b.cleanSheets++;
        if (m.attendance) { b.attendance += m.attendance; b.attCount++; }
        b.yellows += Number(m.totalYellowCards) || 0;
        b.reds += Number(m.totalRedCards) || 0;
        b.fouls += Number((m as any).totalFouls) || 0;
        b.penalties += Number((m as any).penaltiesConceded) || 0;
      }
    }
    return buckets;
  }, [matches]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────
  const ts = venueBuckets.all;
  const winRatePct     = ts.played > 0 ? Math.round((ts.won / ts.played) * 100) : 0;
  const cleanSheetPct  = ts.played > 0 ? Math.round((ts.cleanSheets / ts.played) * 100) : 0;
  const avgAttendance  = ts.attCount > 0 ? Math.round(ts.attendance / ts.attCount) : 0;
  const avgGoals       = ts.played > 0 ? (ts.goals / ts.played).toFixed(2) : '0.00';

  const topScorer  = useMemo(() => [...playerRows].sort((a, b) => b.goals - a.goals)[0] ?? null, [playerRows]);
  const topRated   = useMemo(() => {
    const rated = playerRows.filter(p => p.avgRating !== null);
    return rated.length ? [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0] : null;
  }, [playerRows]);
  const mostDisciplined = useMemo(() => (
    playerRows.filter(p => p.yellows === 0 && p.reds === 0 && p.apps > 0)
      .sort((a, b) => b.apps - a.apps)[0] ?? null
  ), [playerRows]);
  const worstOffender = useMemo(() => (
    [...playerRows].sort((a, b) => (b.yellows + b.reds * 3) - (a.yellows + a.reds * 3))[0] ?? null
  ), [playerRows]);
  const riskPlayers = useMemo(() => playerRows.filter(p => p.hasRisk).sort((a, b) => b.yellows - a.yellows), [playerRows]);
  const avgTeamRating = useMemo(() => {
    const rated = playerRows.filter(p => p.avgRating !== null);
    if (!rated.length) return null;
    return rated.reduce((s, p) => s + p.avgRating!, 0) / rated.length;
  }, [playerRows]);
  const totalPom = useMemo(() => playerRows.reduce((s, p) => s + p.pom, 0), [playerRows]);
  const scorers  = useMemo(() => playerRows.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 10), [playerRows]);
  const foulRatePerMatch = ts.played > 0 ? (ts.fouls / ts.played).toFixed(1) : '0.0';

  // ── CSV exports ───────────────────────────────────────────────────────────────
  const handleExportPlayers = () => {
    exportCSV(
      ['Name', 'Position', 'Apps', 'Goals', 'Assists', 'Shots', 'POM', 'Avg Rating', 'Yellows', 'Reds', 'Mins', 'Won', 'Drawn', 'Lost'],
      sortedPlayers.map(p => [
        p.name, p.position, p.apps, p.goals, p.assists, p.shots, p.pom,
        p.avgRating !== null ? p.avgRating.toFixed(2) : '',
        p.yellows, p.reds, p.mins, p.won, p.drawn, p.lost,
      ]),
      `player-stats-${season}.csv`,
    );
  };

  const handleExportVenue = (label: string) => {
    const b = venueBuckets;
    exportCSV(
      ['Metric', 'Total', 'Home', 'Away', 'Neutral'],
      [
        ['Games Played',    b.all.played,      b.home.played,      b.away.played,      b.neutral.played],
        ['Won',             b.all.won,          b.home.won,         b.away.won,         b.neutral.won],
        ['Drawn',           b.all.drawn,        b.home.drawn,       b.away.drawn,       b.neutral.drawn],
        ['Lost',            b.all.lost,         b.home.lost,        b.away.lost,        b.neutral.lost],
        ['Goals Scored',    b.all.goals,        b.home.goals,       b.away.goals,       b.neutral.goals],
        ['Goals Conceded',  b.all.conceded,     b.home.conceded,    b.away.conceded,    b.neutral.conceded],
        ['Clean Sheets',    b.all.cleanSheets,  b.home.cleanSheets, b.away.cleanSheets, b.neutral.cleanSheets],
        ['Yellow Cards',    b.all.yellows,      b.home.yellows,     b.away.yellows,     b.neutral.yellows],
        ['Red Cards',       b.all.reds,         b.home.reds,        b.away.reds,        b.neutral.reds],
      ],
      `${label}-${season}.csv`,
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  const isLoading = matchesLoading || athletesLoading;
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Statistics Hub</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Athletic intelligence dashboard
        </p>
      </div>

      {/* ── Global filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger className="h-8 w-[120px] text-[10px] font-black uppercase">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Seasons</SelectItem>
            {seasons.map(y => <SelectItem key={y} value={y}>{y} / {String(Number(y) + 1).slice(2)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={matchType} onValueChange={setMatchType}>
          <SelectTrigger className="h-8 w-[110px] text-[10px] font-black uppercase">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="league">League</SelectItem>
            <SelectItem value="cup">Cup</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="national">National</SelectItem>
          </SelectContent>
        </Select>

        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="h-8 w-[110px] text-[10px] font-black uppercase">
            <SelectValue placeholder="Venue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Venues</SelectItem>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="away">Away</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>

        {(season !== 'all' || matchType !== 'all' || venueFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[10px] font-black uppercase text-muted-foreground"
            onClick={() => { setSeason('all'); setMatchType('all'); setVenueFilter('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto no-scrollbar mb-4">
          <TabsList className="bg-background border p-1 h-11 w-max min-w-full">
            <TabsTrigger value="players"    className="text-[10px] font-black uppercase px-4">Player Stats</TabsTrigger>
            <TabsTrigger value="team"       className="text-[10px] font-black uppercase px-4">Team Stats</TabsTrigger>
            <TabsTrigger value="goals"      className="text-[10px] font-black uppercase px-4">Goal Stats</TabsTrigger>
            <TabsTrigger value="discipline" className="text-[10px] font-black uppercase px-4">Discipline</TabsTrigger>
          </TabsList>
        </div>

        {/* ════════════════════ PLAYER STATS ════════════════════ */}
        <TabsContent value="players" className="space-y-5">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Players Tracked"  value={playerRows.length}         icon={Users} />
            <KpiCard
              label="Avg Team Rating"
              value={avgTeamRating !== null ? avgTeamRating.toFixed(2) : '--'}
              icon={BarChart3}
              color={avgTeamRating !== null ? (avgTeamRating >= 7 ? 'text-green-600' : avgTeamRating >= 5 ? 'text-amber-600' : 'text-red-600') : 'text-muted-foreground'}
            />
            <KpiCard
              label="Top Performer (POM)"
              value={totalPom}
              sub={topRated ? `Best avg: ${topRated.name.split(' ')[0]} (${topRated.avgRating!.toFixed(2)})` : undefined}
              icon={Star}
              color="text-yellow-600"
            />
            <KpiCard
              label="Top Scorer"
              value={topScorer?.goals ?? 0}
              sub={topScorer?.name}
              icon={Trophy}
              color="text-green-600"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {sortedPlayers.length} {sortedPlayers.length === 1 ? 'player' : 'players'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] font-black uppercase gap-1.5"
              onClick={handleExportPlayers}
              disabled={sortedPlayers.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {sortedPlayers.length === 0 ? (
            <EmptyState label="No player stats recorded for the current filters" />
          ) : (
            <>
              {/* Desktop table */}
              <Card className="border-none shadow-lg overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-neutral-900">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-white sticky left-0 bg-neutral-900 min-w-[160px]">
                          Player
                        </TableHead>
                        <SortableTh col="apps"      sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">Apps</SortableTh>
                        <SortableTh col="goals"     sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-green-400 text-center">Goals</SortableTh>
                        <SortableTh col="assists"   sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">Ast</SortableTh>
                        <SortableTh col="shots"     sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">Shots</SortableTh>
                        <SortableTh col="pom"       sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-yellow-400 text-center">POM</SortableTh>
                        <SortableTh col="avgRating" sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">Rating</SortableTh>
                        <SortableTh col="yellows"   sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-yellow-400 text-center">🟨</SortableTh>
                        <SortableTh col="reds"      sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-red-400 text-center">🟥</SortableTh>
                        <SortableTh col="mins"      sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">Mins</SortableTh>
                        <SortableTh col="won"       sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-green-400 text-center">W</SortableTh>
                        <SortableTh col="drawn"     sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-white text-center">D</SortableTh>
                        <SortableTh col="lost"      sortCol={sortCol} dir={sortDir} onSort={handleSort} className="text-red-400 text-center">L</SortableTh>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPlayers.map((p, i) => (
                        <TableRow
                          key={p.uid}
                          className={cn('hover:bg-primary/5 transition-colors', i % 2 === 1 && 'bg-muted/10')}
                        >
                          <TableCell className="sticky left-0 bg-inherit min-w-[160px]">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <p className="font-black text-xs uppercase truncate max-w-[130px]">{p.name}</p>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{p.position}</p>
                              </div>
                              {p.hasRisk && (
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="Discipline risk: 4+ yellow cards" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">{p.apps || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-black text-green-700">{p.goals || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{p.assists || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{p.shots || '—'}</TableCell>
                          <TableCell className="text-center text-xs">
                            {p.pom > 0
                              ? <span className="flex items-center justify-center gap-0.5"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{p.pom}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <RatingBadge rating={p.avgRating} />
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-yellow-700">{p.yellows || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-red-700">{p.reds || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{p.mins ? p.mins.toLocaleString() : '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-green-700">{p.won || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">{p.drawn || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-red-700">{p.lost || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Mobile card stacks */}
              <div className="md:hidden space-y-3">
                {sortedPlayers.map(p => (
                  <Card key={p.uid} className="border-none shadow-sm bg-background overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-black text-sm uppercase truncate">{p.name}</p>
                            {p.hasRisk && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          </div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{p.position}</p>
                        </div>
                        <RatingBadge rating={p.avgRating} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {[
                          { l: 'Apps', v: p.apps },
                          { l: 'Goals', v: p.goals },
                          { l: 'Ast', v: p.assists },
                          { l: 'POM', v: p.pom },
                        ].map(({ l, v }) => (
                          <div key={l} className="bg-muted/30 rounded-lg py-1.5">
                            <p className="text-[8px] font-black uppercase text-muted-foreground">{l}</p>
                            <p className="font-black text-sm">{v || '—'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2.5 border-t text-[9px] font-black uppercase">
                        <span className="text-yellow-700">{p.yellows}🟨</span>
                        <span className="text-red-700">{p.reds}🟥</span>
                        <span className="text-muted-foreground">{p.mins}min</span>
                        <span className="text-green-700">W{p.won}</span>
                        <span className="text-muted-foreground">D{p.drawn}</span>
                        <span className="text-red-700">L{p.lost}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ════════════════════ TEAM STATS ════════════════════ */}
        <TabsContent value="team" className="space-y-5">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Win Rate"
              value={`${winRatePct}%`}
              sub={`${ts.won}W · ${ts.drawn}D · ${ts.lost}L`}
              icon={Trophy}
              color="text-green-600"
            />
            <KpiCard
              label="Goals Scored"
              value={ts.goals}
              sub={`${ts.conceded} conceded · GD ${ts.goals - ts.conceded >= 0 ? '+' : ''}${ts.goals - ts.conceded}`}
              icon={Target}
            />
            <KpiCard
              label="Clean Sheet %"
              value={`${cleanSheetPct}%`}
              sub={`${ts.cleanSheets} of ${ts.played} matches`}
              icon={Shield}
              color="text-blue-600"
            />
            <KpiCard
              label="Avg Attendance"
              value={avgAttendance > 0 ? avgAttendance.toLocaleString() : '--'}
              sub={ts.attCount > 0 ? `${ts.attCount} matches recorded` : 'No attendance data'}
              icon={Users}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} in view
            </p>
            <Button
              size="sm" variant="outline"
              className="h-8 text-[10px] font-black uppercase gap-1.5"
              onClick={() => handleExportVenue('team-stats')}
              disabled={matches.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {matches.length === 0 ? (
            <EmptyState label="No match data for the selected filters" />
          ) : (
            <>
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><VenueTableHeader /></TableHeader>
                    <TableBody>
                      <VenueRow label="Games Played"    all={ts.played}       home={venueBuckets.home.played}       away={venueBuckets.away.played}       neutral={venueBuckets.neutral.played} />
                      <VenueRow label="Won"             all={ts.won}          home={venueBuckets.home.won}          away={venueBuckets.away.won}          neutral={venueBuckets.neutral.won} />
                      <VenueRow label="Drawn"           all={ts.drawn}        home={venueBuckets.home.drawn}        away={venueBuckets.away.drawn}        neutral={venueBuckets.neutral.drawn} />
                      <VenueRow label="Lost"            all={ts.lost}         home={venueBuckets.home.lost}         away={venueBuckets.away.lost}         neutral={venueBuckets.neutral.lost} />
                      <VenueRow label="Goals Scored"    all={ts.goals}        home={venueBuckets.home.goals}        away={venueBuckets.away.goals}        neutral={venueBuckets.neutral.goals} />
                      <VenueRow label="Goals Conceded"  all={ts.conceded}     home={venueBuckets.home.conceded}     away={venueBuckets.away.conceded}     neutral={venueBuckets.neutral.conceded} />
                      <VenueRow label="Clean Sheets"    all={ts.cleanSheets}  home={venueBuckets.home.cleanSheets}  away={venueBuckets.away.cleanSheets}  neutral={venueBuckets.neutral.cleanSheets} />
                      <VenueRow
                        label="Avg Attendance"
                        all={ts.attCount > 0 ? Math.round(ts.attendance / ts.attCount) : 0}
                        home={venueBuckets.home.attCount > 0 ? Math.round(venueBuckets.home.attendance / venueBuckets.home.attCount) : 0}
                        away={venueBuckets.away.attCount > 0 ? Math.round(venueBuckets.away.attendance / venueBuckets.away.attCount) : 0}
                        neutral={venueBuckets.neutral.attCount > 0 ? Math.round(venueBuckets.neutral.attendance / venueBuckets.neutral.attCount) : 0}
                        fmt={n => n > 0 ? n.toLocaleString() : '—'}
                      />
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Result distribution bars */}
              <Card className="border-none shadow-sm bg-background">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Result Distribution by Venue
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">
                  {(['all', 'home', 'away', 'neutral'] as VenueKey[]).map(key => {
                    const b = venueBuckets[key];
                    if (b.played === 0) return null;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                          <span className={cn(
                            key === 'home' ? 'text-green-600' : key === 'away' ? 'text-blue-600' : key === 'neutral' ? 'text-neutral-500' : ''
                          )}>{key}</span>
                          <span>{b.played} played</span>
                        </div>
                        <div className="h-6 flex rounded-xl overflow-hidden bg-muted/40 gap-px">
                          {b.won > 0 && (
                            <div
                              className="bg-green-600 flex items-center justify-center text-[8px] font-black text-white transition-all"
                              style={{ width: `${(b.won / b.played) * 100}%` }}
                            >
                              {b.won > 1 || b.won / b.played > 0.15 ? `W${b.won}` : ''}
                            </div>
                          )}
                          {b.drawn > 0 && (
                            <div
                              className="bg-neutral-400 flex items-center justify-center text-[8px] font-black text-white transition-all"
                              style={{ width: `${(b.drawn / b.played) * 100}%` }}
                            >
                              {b.drawn > 1 || b.drawn / b.played > 0.15 ? `D${b.drawn}` : ''}
                            </div>
                          )}
                          {b.lost > 0 && (
                            <div
                              className="bg-red-600 flex items-center justify-center text-[8px] font-black text-white transition-all"
                              style={{ width: `${(b.lost / b.played) * 100}%` }}
                            >
                              {b.lost > 1 || b.lost / b.played > 0.15 ? `L${b.lost}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ════════════════════ GOAL STATS ════════════════════ */}
        <TabsContent value="goals" className="space-y-5">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Goals"       value={ts.goals}      icon={Trophy}   color="text-green-600" />
            <KpiCard
              label="Home vs Away"
              value={`${venueBuckets.home.goals} / ${venueBuckets.away.goals}`}
              sub="Home / Away goals"
              icon={Target}
            />
            <KpiCard
              label="Top Scorer"
              value={topScorer?.goals ?? 0}
              sub={topScorer?.name}
              icon={Star}
              color="text-yellow-600"
            />
            <KpiCard label="Avg Goals / Match" value={avgGoals} icon={BarChart3} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} in view
            </p>
            <Button
              size="sm" variant="outline"
              className="h-8 text-[10px] font-black uppercase gap-1.5"
              onClick={() => handleExportVenue('goal-stats')}
              disabled={matches.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {matches.length === 0 ? (
            <EmptyState label="No goal data for the selected filters" />
          ) : (
            <Card className="border-none shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><VenueTableHeader /></TableHeader>
                  <TableBody>
                    <VenueRow label="Goals Scored" all={ts.goals} home={venueBuckets.home.goals} away={venueBuckets.away.goals} neutral={venueBuckets.neutral.goals} />
                    <VenueRow
                      label="Avg Goals / Match"
                      all={ts.played > 0 ? ts.goals / ts.played : 0}
                      home={venueBuckets.home.played > 0 ? venueBuckets.home.goals / venueBuckets.home.played : 0}
                      away={venueBuckets.away.played > 0 ? venueBuckets.away.goals / venueBuckets.away.played : 0}
                      neutral={venueBuckets.neutral.played > 0 ? venueBuckets.neutral.goals / venueBuckets.neutral.played : 0}
                      fmt={n => n > 0 ? n.toFixed(2) : '—'}
                    />
                    <VenueRow label="Goals Conceded" all={ts.conceded} home={venueBuckets.home.conceded} away={venueBuckets.away.conceded} neutral={venueBuckets.neutral.conceded} />
                    <VenueRow
                      label="Clean Sheets"
                      all={ts.cleanSheets} home={venueBuckets.home.cleanSheets} away={venueBuckets.away.cleanSheets} neutral={venueBuckets.neutral.cleanSheets}
                    />
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Top scorers leaderboard */}
          {scorers.length > 0 && (
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-neutral-900 text-white py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Top Scorers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {scorers.map((p, i) => (
                  <div
                    key={p.uid}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 border-b last:border-0',
                      i % 2 === 1 && 'bg-muted/10',
                    )}
                  >
                    <span className={cn(
                      'text-xl font-black w-7 shrink-0 text-center',
                      i === 0 ? 'text-yellow-500' : i === 1 ? 'text-neutral-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground/40',
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase truncate">{p.name}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{p.position}</p>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Goals</p>
                        <p className="font-black text-2xl text-green-600 leading-none mt-0.5">{p.goals}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Ast</p>
                        <p className="font-black text-2xl leading-none mt-0.5">{p.assists}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Apps</p>
                        <p className="font-black text-lg text-muted-foreground leading-none mt-0.5">{p.apps}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════ DISCIPLINE ════════════════════ */}
        <TabsContent value="discipline" className="space-y-5">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Cards"
              value={ts.yellows + ts.reds}
              sub={`${ts.yellows} yellow · ${ts.reds} red`}
              icon={Activity}
              color="text-amber-600"
            />
            <KpiCard
              label="Most Disciplined"
              value={mostDisciplined ? mostDisciplined.name.split(' ')[0] : '—'}
              sub={mostDisciplined ? `${mostDisciplined.apps} apps, 0 cards` : 'No clean record found'}
              icon={Shield}
              color="text-green-600"
            />
            <KpiCard
              label="Worst Offender"
              value={worstOffender && (worstOffender.yellows + worstOffender.reds) > 0 ? worstOffender.name.split(' ')[0] : '—'}
              sub={worstOffender && (worstOffender.yellows + worstOffender.reds) > 0
                ? `${worstOffender.yellows}🟨 ${worstOffender.reds}🟥`
                : 'No cards recorded'}
              icon={AlertTriangle}
              color="text-red-600"
            />
            <KpiCard
              label="Foul Rate / Match"
              value={foulRatePerMatch}
              sub={`${ts.fouls} total fouls`}
              icon={Target}
            />
          </div>

          {/* Risk players banner */}
          {riskPlayers.length > 0 && (
            <Card className="border-amber-400/40 bg-amber-50/5 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                    Discipline Risk — {riskPlayers.length} player{riskPlayers.length > 1 ? 's' : ''} with 4+ yellow cards
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {riskPlayers.map(p => (
                    <Badge
                      key={p.uid}
                      variant="outline"
                      className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 gap-1.5 text-xs font-black"
                    >
                      {p.name} · {p.yellows}🟨{p.reds > 0 ? ` ${p.reds}🟥` : ''}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} in view
            </p>
            <Button
              size="sm" variant="outline"
              className="h-8 text-[10px] font-black uppercase gap-1.5"
              onClick={() => handleExportVenue('discipline-stats')}
              disabled={matches.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {matches.length > 0 && (
            <Card className="border-none shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><VenueTableHeader /></TableHeader>
                  <TableBody>
                    <VenueRow label="Yellow Cards"       all={ts.yellows}   home={venueBuckets.home.yellows}   away={venueBuckets.away.yellows}   neutral={venueBuckets.neutral.yellows} />
                    <VenueRow label="Red Cards"          all={ts.reds}      home={venueBuckets.home.reds}      away={venueBuckets.away.reds}      neutral={venueBuckets.neutral.reds} />
                    <VenueRow label="Fouls"              all={ts.fouls}     home={venueBuckets.home.fouls}     away={venueBuckets.away.fouls}     neutral={venueBuckets.neutral.fouls} />
                    <VenueRow label="Penalties Conceded" all={ts.penalties} home={venueBuckets.home.penalties} away={venueBuckets.away.penalties} neutral={venueBuckets.neutral.penalties} />
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {playerRows.filter(p => p.yellows > 0 || p.reds > 0 || p.fouls > 0).length > 0 && (
            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-neutral-900 text-white py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest">
                  Player Discipline Record
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest">Player</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-yellow-700">Yellow</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-red-700">Red</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Fouls</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Apps</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...playerRows]
                      .filter(p => p.yellows > 0 || p.reds > 0 || p.fouls > 0)
                      .sort((a, b) => (b.yellows + b.reds * 3) - (a.yellows + a.reds * 3))
                      .map((p, i) => (
                        <TableRow key={p.uid} className={cn('hover:bg-muted/20', i % 2 === 1 && 'bg-muted/10')}>
                          <TableCell>
                            <p className="font-black text-xs uppercase">{p.name}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">{p.position}</p>
                          </TableCell>
                          <TableCell className="text-center font-mono font-black text-yellow-700">{p.yellows || '—'}</TableCell>
                          <TableCell className="text-center font-mono font-black text-red-700">{p.reds || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">{p.fouls || '—'}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{p.apps}</TableCell>
                          <TableCell className="text-center">
                            {p.hasRisk ? (
                              <Badge variant="outline" className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 text-[8px] gap-1 px-1.5 py-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Risk
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 text-[8px] px-1.5 py-0.5">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
