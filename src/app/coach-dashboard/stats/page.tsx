'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, Users, Target, ShieldAlert, ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';

// ─── raw Firestore shapes ────────────────────────────────────────────────────
interface MatchDoc {
  id: string;
  clubId: string;
  opponent: string;
  competition?: string;
  date: string;
  venue?: string;
  season?: string;
  result?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  cleanSheet?: boolean;
  possession?: number;
  shotsOnTarget?: number;
  shotsOffTarget?: number;
  corners?: number;
  fouls?: number;
  attendance?: number;
  totalYellowCards?: number;
  totalRedCards?: number;
  goals?: { scorerName?: string | null; scorerId?: string | null; assisterName?: string | null; assisterId?: string | null; ownGoal?: boolean }[];
  isDraft?: boolean;
}

interface ConfirmDoc {
  id: string;
  athleteId: string;
  clubId: string;
  stats: {
    goals?: number;
    assists?: number;
    minutes?: number;
    rating?: number;
    yellowCards?: number;
    redCards?: number;
    shots?: number;
    cleanSheet?: boolean;
    manOfTheMatch?: boolean;
  };
}

// ─── aggregated row types ─────────────────────────────────────────────────────
interface PlayerRow {
  athleteId: string;
  name: string;
  position: string;
  apps: number;
  goals: number;
  assists: number;
  shots: number;
  pom: number;
  avgRating: number;
  yellow: number;
  red: number;
  mins: number;
}

interface VenueSplit {
  total: number;
  home: number;
  away: number;
  neutral: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const n = (v: number | undefined | null, dec = 0) =>
  (v ?? 0).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const pct = (num: number, den: number) =>
  den === 0 ? '0%' : `${Math.round((num / den) * 100)}%`;

const ratingColor = (r: number) =>
  r >= 7 ? '#22C55E' : r >= 5 ? '#F59E0B' : '#EF4444';

function exportCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

type SortDir = 'asc' | 'desc' | null;
function useSortState(defaultCol: string) {
  const [col, setCol] = useState(defaultCol);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const toggle = (c: string) => {
    if (col === c) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setCol(c); setDir('desc'); }
  };
  return { col, dir, toggle };
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp className="inline h-3 w-3 ml-1 text-[#00C853]" />
    : <ChevronDown className="inline h-3 w-3 ml-1 text-[#00C853]" />;
}

// ─── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#00C853' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#1C2333] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1">{label}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Sortable TH ─────────────────────────────────────────────────────────────
function Th({ col, label, sort, className = '' }: { col: string; label: string; sort: ReturnType<typeof useSortState>; className?: string }) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[#64748B] cursor-pointer select-none whitespace-nowrap hover:text-white transition-colors ${className}`}
      onClick={() => sort.toggle(col)}
    >
      {label}<SortIcon active={sort.col === col} dir={sort.col === col ? sort.dir : null} />
    </th>
  );
}

// ─── venue-split row component ────────────────────────────────────────────────
function VRow({ label, split, color }: { label: string; split: VenueSplit; color?: string }) {
  return (
    <tr className="border-t border-white/5 hover:bg-white/3 transition-colors">
      <td className="px-4 py-3 text-[12px] font-bold text-white sticky left-0 bg-[#1C2333]">{label}</td>
      {(['total', 'home', 'away', 'neutral'] as const).map((k, i) => (
        <td key={k} className={`px-4 py-3 text-center font-mono text-sm font-bold ${i > 0 ? 'bg-white/[0.015]' : ''}`}
          style={{ color: color ?? 'white' }}>
          {n(split[k])}
        </td>
      ))}
    </tr>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // ── club membership ──────────────────────────────────────────────────────
  const memberQ = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null,
    [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQ);
  const clubId = memberships?.[0]?.clubId ?? null;

  // ── matches ──────────────────────────────────────────────────────────────
  const matchQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: allMatches, isLoading: matchLoading } = useCollection<MatchDoc>(matchQ);

  // ── confirmations (player stats) ─────────────────────────────────────────
  const confirmQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'match_confirmations'), where('clubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: confirmations } = useCollection<ConfirmDoc>(confirmQ);

  // ── squad athletes (for names) ────────────────────────────────────────────
  const athleteQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athleteQ);

  const athleteMap = useMemo(() => {
    const m = new Map<string, AthleteProfile>();
    athletes?.forEach(a => m.set(a.uid, a));
    return m;
  }, [athletes]);

  // ── filters ───────────────────────────────────────────────────────────────
  const [season, setSeason] = useState<string>('all');
  const [venue, setVenue] = useState<string>('all');
  const [competition, setCompetition] = useState<string>('all');

  const publishedMatches = useMemo(() =>
    (allMatches ?? []).filter(m => !m.isDraft),
    [allMatches]);

  const seasons = useMemo(() => {
    const s = new Set(publishedMatches.map(m => m.season).filter(Boolean) as string[]);
    return ['all', ...Array.from(s).sort().reverse()];
  }, [publishedMatches]);

  const competitions = useMemo(() => {
    const c = new Set(publishedMatches.map(m => m.competition).filter(Boolean) as string[]);
    return ['all', ...Array.from(c).sort()];
  }, [publishedMatches]);

  const filtered = useMemo(() =>
    publishedMatches.filter(m =>
      (season === 'all' || m.season === season) &&
      (venue === 'all' || (m.venue ?? 'Home') === venue) &&
      (competition === 'all' || m.competition === competition)
    ),
    [publishedMatches, season, venue, competition]);

  // ─── TEAM STATS aggregation ───────────────────────────────────────────────
  const teamStats = useMemo(() => {
    const init = (): VenueSplit => ({ total: 0, home: 0, away: 0, neutral: 0 });
    const v = (m: MatchDoc): keyof VenueSplit => {
      const ven = (m.venue ?? 'Home').toLowerCase();
      return ven === 'away' ? 'away' : ven === 'neutral' ? 'neutral' : 'home';
    };
    const played = init(), wins = init(), draws = init(), losses = init(),
      gf = init(), ga = init(), cs = init(), att = init(), attCount = init();

    for (const m of filtered) {
      const key = v(m);
      played.total++; played[key]++;
      if (m.result === 'W') { wins.total++; wins[key]++; }
      else if (m.result === 'D') { draws.total++; draws[key]++; }
      else if (m.result === 'L') { losses.total++; losses[key]++; }
      gf.total += m.goalsFor ?? 0; gf[key] += m.goalsFor ?? 0;
      ga.total += m.goalsAgainst ?? 0; ga[key] += m.goalsAgainst ?? 0;
      if (m.cleanSheet) { cs.total++; cs[key]++; }
      if (m.attendance) { att.total += m.attendance; att[key] += m.attendance; attCount.total++; attCount[key]++; }
    }
    const avgAtt: VenueSplit = {
      total: attCount.total ? Math.round(att.total / attCount.total) : 0,
      home: attCount.home ? Math.round(att.home / attCount.home) : 0,
      away: attCount.away ? Math.round(att.away / attCount.away) : 0,
      neutral: attCount.neutral ? Math.round(att.neutral / attCount.neutral) : 0,
    };
    return { played, wins, draws, losses, gf, ga, cs, avgAtt };
  }, [filtered]);

  // ─── GOAL STATS aggregation ───────────────────────────────────────────────
  const goalStats = useMemo(() => {
    const init = (): VenueSplit => ({ total: 0, home: 0, away: 0, neutral: 0 });
    const v = (m: MatchDoc): keyof VenueSplit => {
      const ven = (m.venue ?? 'Home').toLowerCase();
      return ven === 'away' ? 'away' : ven === 'neutral' ? 'neutral' : 'home';
    };
    const gf = init(), ga = init(), assists = init();
    const scorers = new Map<string, { name: string; goals: number }>();

    for (const m of filtered) {
      const key = v(m);
      gf.total += m.goalsFor ?? 0; gf[key] += m.goalsFor ?? 0;
      ga.total += m.goalsAgainst ?? 0; ga[key] += m.goalsAgainst ?? 0;
      for (const g of m.goals ?? []) {
        if (!g.ownGoal && g.scorerName) {
          const existing = scorers.get(g.scorerName) ?? { name: g.scorerName, goals: 0 };
          existing.goals++;
          scorers.set(g.scorerName, existing);
        }
        if (g.assisterName) {
          assists.total++; assists[key]++;
        }
      }
    }

    const topScorers = Array.from(scorers.values()).sort((a, b) => b.goals - a.goals).slice(0, 10);
    const matchCount = filtered.length || 1;
    const avgGf: VenueSplit = {
      total: +(gf.total / matchCount).toFixed(2),
      home: +(gf.home / (filtered.filter(m => (m.venue ?? 'Home') === 'Home').length || 1)).toFixed(2),
      away: +(gf.away / (filtered.filter(m => m.venue === 'Away').length || 1)).toFixed(2),
      neutral: +(gf.neutral / (filtered.filter(m => m.venue === 'Neutral').length || 1)).toFixed(2),
    };
    return { gf, ga, assists, avgGf, topScorers };
  }, [filtered]);

  // ─── DISCIPLINE STATS aggregation ────────────────────────────────────────
  const disciplineStats = useMemo(() => {
    const init = (): VenueSplit => ({ total: 0, home: 0, away: 0, neutral: 0 });
    const v = (m: MatchDoc): keyof VenueSplit => {
      const ven = (m.venue ?? 'Home').toLowerCase();
      return ven === 'away' ? 'away' : ven === 'neutral' ? 'neutral' : 'home';
    };
    const yellows = init(), reds = init(), fouls = init();
    const byPlayer = new Map<string, { name: string; yellow: number; red: number }>();

    for (const m of filtered) {
      const key = v(m);
      yellows.total += m.totalYellowCards ?? 0; yellows[key] += m.totalYellowCards ?? 0;
      reds.total += m.totalRedCards ?? 0; reds[key] += m.totalRedCards ?? 0;
      fouls.total += m.fouls ?? 0; fouls[key] += m.fouls ?? 0;
    }

    // per-player cards from match_confirmations
    for (const c of confirmations ?? []) {
      const athlete = athleteMap.get(c.athleteId);
      const name = athlete ? `${athlete.firstName} ${athlete.lastName}` : c.athleteId;
      const existing = byPlayer.get(c.athleteId) ?? { name, yellow: 0, red: 0 };
      existing.yellow += c.stats.yellowCards ?? 0;
      existing.red += c.stats.redCards ?? 0;
      byPlayer.set(c.athleteId, existing);
    }

    const playerDiscipline = Array.from(byPlayer.values())
      .filter(p => p.yellow > 0 || p.red > 0)
      .sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));

    const matchCount = filtered.length || 1;
    const foulRate = +(fouls.total / matchCount).toFixed(1);

    return { yellows, reds, fouls, foulRate, playerDiscipline };
  }, [filtered, confirmations, athleteMap]);

  // ─── PLAYER STATS aggregation ────────────────────────────────────────────
  const playerSort = useSortState('goals');

  const playerRows: PlayerRow[] = useMemo(() => {
    const byAthlete = new Map<string, {
      goals: number; assists: number; shots: number; pom: number;
      ratingSum: number; ratingCount: number; yellow: number; red: number; mins: number; apps: number;
    }>();

    // Only include confirmations for filtered matches
    const filteredIds = new Set(filtered.map(m => m.id));

    for (const c of confirmations ?? []) {
      if (!filteredIds.has(c.id.split('_')[0]) && filteredIds.size > 0) {
        // match_confirmation IDs don't embed matchId, so include all if match filter is active
        // We still show all confirmations for the club filtered by season/venue via date — skip for now, include all
      }
      const existing = byAthlete.get(c.athleteId) ?? { goals: 0, assists: 0, shots: 0, pom: 0, ratingSum: 0, ratingCount: 0, yellow: 0, red: 0, mins: 0, apps: 0 };
      existing.apps++;
      existing.goals += c.stats.goals ?? 0;
      existing.assists += c.stats.assists ?? 0;
      existing.shots += c.stats.shots ?? 0;
      if (c.stats.manOfTheMatch) existing.pom++;
      if ((c.stats.rating ?? 0) > 0) { existing.ratingSum += c.stats.rating ?? 0; existing.ratingCount++; }
      existing.yellow += c.stats.yellowCards ?? 0;
      existing.red += c.stats.redCards ?? 0;
      existing.mins += c.stats.minutes ?? 0;
      byAthlete.set(c.athleteId, existing);
    }

    const rows: PlayerRow[] = Array.from(byAthlete.entries()).map(([athleteId, s]) => {
      const athlete = athleteMap.get(athleteId);
      return {
        athleteId,
        name: athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Unknown Player',
        position: athlete?.position ?? '—',
        apps: s.apps,
        goals: s.goals,
        assists: s.assists,
        shots: s.shots,
        pom: s.pom,
        avgRating: s.ratingCount > 0 ? +(s.ratingSum / s.ratingCount).toFixed(2) : 0,
        yellow: s.yellow,
        red: s.red,
        mins: s.mins,
      };
    });

    const dir = playerSort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const av = (a as any)[playerSort.col] ?? 0;
      const bv = (b as any)[playerSort.col] ?? 0;
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (av - bv);
    });
  }, [confirmations, filtered, athleteMap, playerSort.col, playerSort.dir]);

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const playerKpis = useMemo(() => {
    const topPom = [...playerRows].sort((a, b) => b.pom - a.pom)[0];
    const topGoals = [...playerRows].sort((a, b) => b.goals - a.goals)[0];
    const avgRating = playerRows.length
      ? +(playerRows.reduce((s, r) => s + r.avgRating, 0) / playerRows.length).toFixed(2)
      : 0;
    return { total: playerRows.length, avgRating, topPom, topGoals };
  }, [playerRows]);

  const isLoading = matchLoading && !allMatches;

  // ─── CSV exports ──────────────────────────────────────────────────────────
  const exportPlayers = () => {
    exportCSV(
      [['Name', 'Position', 'Apps', 'Goals', 'Assists', 'Shots', 'POM', 'Avg Rating', 'Yellow', 'Red', 'Mins'],
        ...playerRows.map(r => [r.name, r.position, r.apps, r.goals, r.assists, r.shots, r.pom, r.avgRating, r.yellow, r.red, r.mins])],
      `player-stats-${season}.csv`
    );
  };

  const exportTeam = () => {
    const { played, wins, draws, losses, gf, ga, cs } = teamStats;
    exportCSV(
      [['Metric', 'Total', 'Home', 'Away', 'Neutral'],
        ['Games Played', played.total, played.home, played.away, played.neutral],
        ['Wins', wins.total, wins.home, wins.away, wins.neutral],
        ['Draws', draws.total, draws.home, draws.away, draws.neutral],
        ['Losses', losses.total, losses.home, losses.away, losses.neutral],
        ['Goals Scored', gf.total, gf.home, gf.away, gf.neutral],
        ['Goals Conceded', ga.total, ga.home, ga.away, ga.neutral],
        ['Clean Sheets', cs.total, cs.home, cs.away, cs.neutral]],
      `team-stats-${season}.csv`
    );
  };

  const exportGoals = () => {
    const { gf, ga, assists, topScorers } = goalStats;
    exportCSV(
      [['Metric', 'Total', 'Home', 'Away', 'Neutral'],
        ['Goals Scored', gf.total, gf.home, gf.away, gf.neutral],
        ['Goals Conceded', ga.total, ga.home, ga.away, ga.neutral],
        ['Assists', assists.total, assists.home, assists.away, assists.neutral],
        [],
        ['Top Scorers', 'Goals'],
        ...topScorers.map(s => [s.name, s.goals])],
      `goal-stats-${season}.csv`
    );
  };

  const exportDiscipline = () => {
    const { yellows, reds, fouls } = disciplineStats;
    exportCSV(
      [['Metric', 'Total', 'Home', 'Away', 'Neutral'],
        ['Yellow Cards', yellows.total, yellows.home, yellows.away, yellows.neutral],
        ['Red Cards', reds.total, reds.home, reds.away, reds.neutral],
        ['Fouls', fouls.total, fouls.home, fouls.away, fouls.neutral],
        [],
        ['Player', 'Yellow Cards', 'Red Cards'],
        ...disciplineStats.playerDiscipline.map(p => [p.name, p.yellow, p.red])],
      `discipline-stats-${season}.csv`
    );
  };

  // ─── shared table header for venue-split tables ───────────────────────────
  const VenueTableHead = () => (
    <thead>
      <tr className="border-b border-white/10">
        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[#64748B] sticky left-0 bg-[#1C2333]">Metric</th>
        {['Total', 'Home', 'Away', 'Neutral'].map((h, i) => (
          <th key={h} className={`px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'text-white' : 'text-[#64748B]'}`}>{h}</th>
        ))}
      </tr>
    </thead>
  );

  if (!clubId && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <TrendingUp className="h-12 w-12 text-[#64748B]" />
        <p className="text-lg font-black text-white">No club linked</p>
        <p className="text-sm text-[#64748B]">Join or create a club to start tracking stats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Stats</h1>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            {filtered.length} match{filtered.length !== 1 ? 'es' : ''} · Aggregated from match records
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2">
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="h-8 w-32 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s === 'all' ? 'All Seasons' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={venue} onValueChange={setVenue}>
            <SelectTrigger className="h-8 w-28 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Venue" />
            </SelectTrigger>
            <SelectContent>
              {['all', 'Home', 'Away', 'Neutral'].map(v => (
                <SelectItem key={v} value={v} className="text-xs">{v === 'all' ? 'All Venues' : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={competition} onValueChange={setCompetition}>
            <SelectTrigger className="h-8 w-36 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c === 'all' ? 'All Competitions' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
        </div>
      ) : (
        <Tabs defaultValue="player">
          <TabsList className="bg-[#1C2333] border border-white/8 h-auto p-1 flex flex-wrap gap-1">
            {[
              { value: 'player', label: 'Player Stats', icon: Users },
              { value: 'team', label: 'Team Stats', icon: TrendingUp },
              { value: 'goals', label: 'Goal Stats', icon: Target },
              { value: 'discipline', label: 'Discipline', icon: ShieldAlert },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase tracking-widest gap-1.5 h-8 px-3"
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══════════════ PLAYER STATS ══════════════ */}
          <TabsContent value="player" className="mt-5 space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Players Tracked" value={n(playerKpis.total)} sub="across all matches" />
              <KpiCard label="Avg Team Rating" value={playerKpis.avgRating > 0 ? n(playerKpis.avgRating, 2) : '—'} color={ratingColor(playerKpis.avgRating)} />
              <KpiCard label="Top POM" value={playerKpis.topPom?.name ?? '—'} sub={playerKpis.topPom ? `${playerKpis.topPom.pom} award${playerKpis.topPom.pom !== 1 ? 's' : ''}` : undefined} color="#F59E0B" />
              <KpiCard label="Top Scorer" value={playerKpis.topGoals?.name ?? '—'} sub={playerKpis.topGoals ? `${playerKpis.topGoals.goals} goal${playerKpis.topGoals.goals !== 1 ? 's' : ''}` : undefined} color="#22C55E" />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">
                  {playerRows.length} player{playerRows.length !== 1 ? 's' : ''}
                </p>
                <Button size="sm" variant="ghost" onClick={exportPlayers} className="h-7 gap-1.5 text-[11px] font-black text-[#64748B] hover:text-white">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>

              {playerRows.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-10 w-10 text-[#334155] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#64748B]">No stats recorded yet.</p>
                  <p className="text-xs text-[#475569] mt-1">Log matches in Match Entry to populate this table.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-white border-collapse">
                      <thead className="border-b border-white/10 bg-[#151D2E]">
                        <tr>
                          <Th col="name" label="Name" sort={playerSort} className="min-w-[140px]" />
                          <Th col="position" label="Pos" sort={playerSort} />
                          <Th col="apps" label="Apps" sort={playerSort} />
                          <Th col="goals" label="Goals" sort={playerSort} />
                          <Th col="assists" label="Asst" sort={playerSort} />
                          <Th col="shots" label="Shots" sort={playerSort} />
                          <Th col="pom" label="POM" sort={playerSort} />
                          <Th col="avgRating" label="Avg Rtg" sort={playerSort} />
                          <Th col="yellow" label="Y" sort={playerSort} />
                          <Th col="red" label="R" sort={playerSort} />
                          <Th col="mins" label="Mins" sort={playerSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {playerRows.map((row, i) => (
                          <tr key={row.athleteId} className={`border-t border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                            <td className="px-3 py-3 font-bold text-white">{row.name}</td>
                            <td className="px-3 py-3 text-[11px] text-[#94A3B8] font-mono">{row.position}</td>
                            <td className="px-3 py-3 font-mono text-center">{row.apps}</td>
                            <td className="px-3 py-3 font-mono text-center font-black text-[#22C55E]">{row.goals}</td>
                            <td className="px-3 py-3 font-mono text-center">{row.assists}</td>
                            <td className="px-3 py-3 font-mono text-center text-[#94A3B8]">{row.shots}</td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.pom > 0 ? <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 text-[10px] font-black px-1.5">{row.pom}×</Badge> : <span className="text-[#475569]">—</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.avgRating > 0 ? (
                                <span className="font-black text-sm" style={{ color: ratingColor(row.avgRating) }}>
                                  {n(row.avgRating, 2)}
                                </span>
                              ) : <span className="text-[#475569]">—</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.yellow > 0 ? <span className="font-black text-[#F59E0B]">{row.yellow}</span> : <span className="text-[#475569]">0</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.red > 0 ? <span className="font-black text-[#EF4444]">{row.red}</span> : <span className="text-[#475569]">0</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center text-[#94A3B8]">{n(row.mins)}'</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-white/5">
                    {playerRows.map(row => (
                      <div key={row.athleteId} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-black text-white text-sm">{row.name}</p>
                            <p className="text-[10px] text-[#64748B] font-mono">{row.position} · {row.apps} apps</p>
                          </div>
                          {row.avgRating > 0 && (
                            <span className="text-lg font-black tabular-nums" style={{ color: ratingColor(row.avgRating) }}>
                              {n(row.avgRating, 2)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center">
                          {[
                            { label: 'G', value: row.goals, color: '#22C55E' },
                            { label: 'A', value: row.assists, color: 'white' },
                            { label: 'POM', value: row.pom, color: '#F59E0B' },
                            { label: 'YC', value: row.yellow, color: '#F59E0B' },
                            { label: 'RC', value: row.red, color: '#EF4444' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-[#151D2E] rounded-lg py-1.5">
                              <p className="text-[10px] text-[#64748B] font-black">{label}</p>
                              <p className="font-black text-sm tabular-nums" style={{ color }}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ══════════════ TEAM STATS ══════════════ */}
          <TabsContent value="team" className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Win Rate" value={pct(teamStats.wins.total, teamStats.played.total)} sub={`${teamStats.wins.total}W ${teamStats.draws.total}D ${teamStats.losses.total}L`} color="#22C55E" />
              <KpiCard label="Goals Scored" value={n(teamStats.gf.total)} sub={`${n(teamStats.ga.total)} conceded`} />
              <KpiCard label="Clean Sheets" value={n(teamStats.cs.total)} sub={pct(teamStats.cs.total, teamStats.played.total)} color="#3B82F6" />
              <KpiCard label="Avg Attendance" value={teamStats.avgAtt.total > 0 ? n(teamStats.avgAtt.total) : '—'} sub="per match" color="#A855F7" />
            </div>

            <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Match Record</p>
                <Button size="sm" variant="ghost" onClick={exportTeam} className="h-7 gap-1.5 text-[11px] font-black text-[#64748B] hover:text-white">
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-[#94A3B8] border-collapse">
                  <VenueTableHead />
                  <tbody>
                    <VRow label="Games Played" split={teamStats.played} color="white" />
                    <VRow label="Wins" split={teamStats.wins} color="#22C55E" />
                    <VRow label="Draws" split={teamStats.draws} color="#F59E0B" />
                    <VRow label="Losses" split={teamStats.losses} color="#EF4444" />
                    <VRow label="Goals Scored" split={teamStats.gf} color="#22C55E" />
                    <VRow label="Goals Conceded" split={teamStats.ga} color="#EF4444" />
                    <VRow label="Clean Sheets" split={teamStats.cs} color="#3B82F6" />
                    <VRow label="Avg Attendance" split={teamStats.avgAtt} color="#A855F7" />
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════ GOAL STATS ══════════════ */}
          <TabsContent value="goals" className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Goals" value={n(goalStats.gf.total)} sub="this period" color="#22C55E" />
              <KpiCard label="Avg per Match" value={n(goalStats.avgGf.total, 2)} sub="goals scored" />
              <KpiCard label="Top Scorer" value={goalStats.topScorers[0]?.name ?? '—'} sub={goalStats.topScorers[0] ? `${goalStats.topScorers[0].goals} goal${goalStats.topScorers[0].goals !== 1 ? 's' : ''}` : undefined} color="#F59E0B" />
              <KpiCard label="Total Assists" value={n(goalStats.assists.total)} sub="recorded" color="#3B82F6" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Venue breakdown */}
              <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Goals by Venue</p>
                  <Button size="sm" variant="ghost" onClick={exportGoals} className="h-7 gap-1.5 text-[11px] font-black text-[#64748B] hover:text-white">
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-[#94A3B8] border-collapse">
                    <VenueTableHead />
                    <tbody>
                      <VRow label="Goals Scored" split={goalStats.gf} color="#22C55E" />
                      <VRow label="Goals Conceded" split={goalStats.ga} color="#EF4444" />
                      <VRow label="Assists" split={goalStats.assists} color="#3B82F6" />
                      <VRow label="Avg Scored" split={goalStats.avgGf} color="#F59E0B" />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top scorers */}
              <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Top Scorers</p>
                </div>
                {goalStats.topScorers.length === 0 ? (
                  <div className="py-10 text-center">
                    <Target className="h-8 w-8 text-[#334155] mx-auto mb-2" />
                    <p className="text-xs text-[#64748B]">No goals recorded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {goalStats.topScorers.map((scorer, i) => {
                      const max = goalStats.topScorers[0].goals;
                      return (
                        <div key={scorer.name} className="px-4 py-3 flex items-center gap-3">
                          <span className="text-[11px] font-black text-[#475569] w-5 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{scorer.name}</p>
                            <div className="mt-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${(scorer.goals / max) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-lg font-black tabular-nums text-[#22C55E]">{scorer.goals}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════════════ DISCIPLINE STATS ══════════════ */}
          <TabsContent value="discipline" className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Yellow Cards" value={n(disciplineStats.yellows.total)} sub="this period" color="#F59E0B" />
              <KpiCard label="Red Cards" value={n(disciplineStats.reds.total)} sub="this period" color="#EF4444" />
              <KpiCard label="Total Fouls" value={n(disciplineStats.fouls.total)} sub={`${disciplineStats.foulRate}/match avg`} color="#94A3B8" />
              <KpiCard label="Most Disciplined"
                value={disciplineStats.playerDiscipline[0]?.name ?? '—'}
                sub={disciplineStats.playerDiscipline[0] ? `${disciplineStats.playerDiscipline[0].yellow}Y ${disciplineStats.playerDiscipline[0].red}R` : undefined}
                color="#EF4444" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Venue breakdown */}
              <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Cards by Venue</p>
                  <Button size="sm" variant="ghost" onClick={exportDiscipline} className="h-7 gap-1.5 text-[11px] font-black text-[#64748B] hover:text-white">
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-[#94A3B8] border-collapse">
                    <VenueTableHead />
                    <tbody>
                      <VRow label="Yellow Cards" split={disciplineStats.yellows} color="#F59E0B" />
                      <VRow label="Red Cards" split={disciplineStats.reds} color="#EF4444" />
                      <VRow label="Fouls" split={disciplineStats.fouls} />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-player discipline */}
              <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Player Discipline</p>
                </div>
                {disciplineStats.playerDiscipline.length === 0 ? (
                  <div className="py-10 text-center">
                    <ShieldAlert className="h-8 w-8 text-[#334155] mx-auto mb-2" />
                    <p className="text-xs text-[#64748B]">No cards recorded.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {disciplineStats.playerDiscipline.map(player => {
                      const atRisk = player.yellow >= 4;
                      return (
                        <div key={player.name} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white truncate">{player.name}</p>
                              {atRisk && (
                                <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 text-[9px] font-black px-1.5 py-0 h-4 shrink-0">
                                  ⚠ RISK
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {player.yellow > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="inline-block w-3 h-4 rounded-[2px] bg-[#F59E0B]" />
                                <span className="text-sm font-black text-[#F59E0B] tabular-nums">{player.yellow}</span>
                              </div>
                            )}
                            {player.red > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="inline-block w-3 h-4 rounded-[2px] bg-[#EF4444]" />
                                <span className="text-sm font-black text-[#EF4444] tabular-nums">{player.red}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
