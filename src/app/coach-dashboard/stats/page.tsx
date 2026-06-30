'use client';

import { useMemo, useState, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Download, TrendingUp, Users, Target, ShieldAlert,
  ChevronUp, ChevronDown, ChevronsUpDown, Loader2,
  Plus, ChevronLeft, ChevronRight, Star
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// ─── Firestore shapes ─────────────────────────────────────────────────────────
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
  matchId?: string;
  opponent?: string;
  manual?: boolean;
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
  won: number;
  drawn: number;
  lost: number;
}

interface PlayerMatchRow {
  confirmId: string;
  matchId?: string;
  opponent: string;
  date: string;
  goals: number;
  assists: number;
  shots: number;
  mins: number;
  rating: number;
  yellow: number;
  red: number;
  pom: boolean;
  manual: boolean;
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

function exportCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

type SortDir = 'asc' | 'desc';
function useSortState(defaultCol: string) {
  const [col, setCol] = useState(defaultCol);
  const [dir, setDir] = useState<SortDir>('desc');
  const toggle = useCallback((c: string) => {
    if (col === c) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setCol(c); setDir('desc'); }
  }, [col]);
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
      <p className="text-2xl font-black tabular-nums truncate" style={{ color }}>{value}</p>
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
      {label}<SortIcon active={sort.col === col} dir={sort.col === col ? sort.dir : 'desc'} />
    </th>
  );
}

// ─── Venue-split row ─────────────────────────────────────────────────────────
function VRow({ label, split, color, fmt }: { label: string; split: VenueSplit; color?: string; fmt?: (v: number) => string }) {
  const format = fmt ?? ((v: number) => n(v));
  return (
    <tr className="border-t border-white/5 hover:bg-white/3 transition-colors">
      <td className="px-4 py-3 text-[12px] font-bold text-white sticky left-0 bg-[#1C2333]">{label}</td>
      {(['total', 'home', 'away', 'neutral'] as const).map((k, i) => (
        <td key={k} className={`px-4 py-3 text-center font-mono text-sm font-bold ${i > 0 ? 'bg-white/[0.015]' : ''}`}
          style={{ color: color ?? 'white' }}>
          {format(split[k])}
        </td>
      ))}
    </tr>
  );
}

// ─── Venue table head ─────────────────────────────────────────────────────────
function VenueTableHead() {
  return (
    <thead>
      <tr className="border-b border-white/10">
        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[#64748B] sticky left-0 bg-[#1C2333]">Metric</th>
        {['Total', 'Home', 'Away', 'Neutral'].map((h, i) => (
          <th key={h} className={`px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'text-white' : 'text-[#64748B]'}`}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ total, page, perPage, onPage, onPerPage }: {
  total: number; page: number; perPage: number;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/8 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#64748B]">Rows per page:</span>
        <Select value={String(perPage)} onValueChange={v => { onPerPage(Number(v)); onPage(1); }}>
          <SelectTrigger className="h-7 w-16 bg-[#151D2E] border-white/10 text-xs font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map(v => (
              <SelectItem key={v} value={String(v)} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[#64748B]">{from}–{to} of {total}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Stat Modal ───────────────────────────────────────────────────────────
function AddStatModal({
  open, onClose, clubId, athletes, firestore, onSaved
}: {
  open: boolean; onClose: () => void;
  clubId: string; athletes: AthleteProfile[];
  firestore: ReturnType<typeof useFirestore>; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [athleteId, setAthleteId] = useState('');
  const [form, setForm] = useState({
    goals: 0, assists: 0, shots: 0, minutes: 90,
    rating: 0, yellowCards: 0, redCards: 0, manOfTheMatch: false
  });

  const set = (k: keyof typeof form) => (v: number | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const reset = () => {
    setAthleteId('');
    setForm({ goals: 0, assists: 0, shots: 0, minutes: 90, rating: 0, yellowCards: 0, redCards: 0, manOfTheMatch: false });
  };

  const handleSave = async () => {
    if (!athleteId) { toast({ title: 'Select a player', variant: 'destructive' }); return; }
    if (!firestore) return;
    setSaving(true);
    try {
      const athlete = athletes.find(a => a.uid === athleteId);
      await addDoc(collection(firestore, 'match_confirmations'), {
        athleteId,
        clubId,
        matchId: 'manual',
        opponent: 'Manual Entry',
        manual: true,
        createdAt: serverTimestamp(),
        stats: {
          goals: form.goals,
          assists: form.assists,
          shots: form.shots,
          minutes: form.minutes,
          rating: form.rating || null,
          yellowCards: form.yellowCards,
          redCards: form.redCards,
          manOfTheMatch: form.manOfTheMatch,
        },
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : athleteId,
      });
      toast({ title: 'Stats saved!', description: 'Player stats added successfully.' });
      reset();
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error saving stats', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const numField = (label: string, key: keyof typeof form, min = 0, max = 999) => (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">{label}</Label>
      <Input
        type="number" min={min} max={max}
        value={form[key] as number}
        onChange={e => set(key)(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="bg-[#151D2E] border-white/10 font-mono text-white h-9"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-[#1C2333] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black">Log Player Stats</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Player</Label>
            <Select value={athleteId} onValueChange={setAthleteId}>
              <SelectTrigger className="bg-[#151D2E] border-white/10 text-white h-9">
                <SelectValue placeholder="Select player…" />
              </SelectTrigger>
              <SelectContent>
                {athletes.map(a => (
                  <SelectItem key={a.uid} value={a.uid}>
                    {a.firstName} {a.lastName} {a.position ? `· ${a.position}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {numField('Goals', 'goals', 0, 20)}
            {numField('Assists', 'assists', 0, 20)}
            {numField('Shots', 'shots', 0, 50)}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numField('Minutes', 'minutes', 0, 120)}
            {numField('Rating (1–10)', 'rating', 0, 10)}
            {numField('Yellow Cards', 'yellowCards', 0, 2)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {numField('Red Cards', 'redCards', 0, 1)}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Man of the Match</Label>
              <div className="flex items-center gap-3 h-9">
                <Switch
                  checked={form.manOfTheMatch}
                  onCheckedChange={v => set('manOfTheMatch')(v)}
                />
                <span className="text-sm text-[#94A3B8]">{form.manOfTheMatch ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-[#64748B]">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#00C853] text-black font-black hover:bg-[#00C853]/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Stats'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Player Profile Drawer ────────────────────────────────────────────────────
function PlayerProfileDrawer({
  open, onClose, athleteId, athleteName, position,
  matchRows, summary
}: {
  open: boolean; onClose: () => void;
  athleteId: string; athleteName: string; position: string;
  matchRows: PlayerMatchRow[];
  summary: PlayerRow;
}) {
  const initials = athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const sorted = [...matchRows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-[#0F1623] border-white/10 text-white overflow-y-auto p-0"
      >
        {/* Header */}
        <div className="bg-[#1C2333] px-6 py-5 border-b border-white/8">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#00C853]/20 border border-[#00C853]/30 flex items-center justify-center">
                <span className="text-sm font-black text-[#00C853]">{initials}</span>
              </div>
              <div>
                <SheetTitle className="text-white font-black text-lg">{athleteName}</SheetTitle>
                <p className="text-[11px] text-[#64748B] font-mono mt-0.5">{position || 'Player'} · {summary.apps} appearances</p>
              </div>
            </div>
          </SheetHeader>

          {/* Quick KPIs */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Goals', value: summary.goals, color: '#22C55E' },
              { label: 'Assists', value: summary.assists, color: '#3B82F6' },
              { label: 'POM', value: summary.pom, color: '#F59E0B' },
              { label: 'Avg Rtg', value: summary.avgRating > 0 ? n(summary.avgRating, 2) : '—', color: summary.avgRating > 0 ? ratingColor(summary.avgRating) : '#64748B' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">{label}</p>
                <p className="text-xl font-black tabular-nums" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Match-by-match table */}
        <div className="px-6 py-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B] mb-3">Match Log</p>

          {sorted.length === 0 ? (
            <div className="py-10 text-center">
              <Target className="h-8 w-8 text-[#334155] mx-auto mb-2" />
              <p className="text-xs text-[#64748B]">No match data recorded.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-[#94A3B8] border-collapse">
                  <thead className="border-b border-white/10 bg-[#151D2E]">
                    <tr>
                      {['Opponent', 'Date', 'G', 'A', 'Sh', 'Mins', 'Rtg', 'YC', 'RC', 'POM'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[#64748B] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={row.confirmId} className={`border-t border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                        <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap max-w-[120px] truncate">
                          {row.opponent}
                          {row.manual && <span className="ml-1 text-[9px] text-[#475569] font-mono">(manual)</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#64748B] whitespace-nowrap">{row.date || '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-center font-black text-[#22C55E]">{row.goals}</td>
                        <td className="px-3 py-2.5 font-mono text-center">{row.assists}</td>
                        <td className="px-3 py-2.5 font-mono text-center text-[#64748B]">{row.shots}</td>
                        <td className="px-3 py-2.5 font-mono text-center text-[#64748B]">{row.mins}'</td>
                        <td className="px-3 py-2.5 font-mono text-center">
                          {row.rating > 0
                            ? <span className="font-black" style={{ color: ratingColor(row.rating) }}>{n(row.rating, 1)}</span>
                            : <span className="text-[#475569]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-center">
                          {row.yellow > 0 ? <span className="font-black text-[#F59E0B]">{row.yellow}</span> : <span className="text-[#475569]">0</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-center">
                          {row.red > 0 ? <span className="font-black text-[#EF4444]">{row.red}</span> : <span className="text-[#475569]">0</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {row.pom ? <Star className="h-3.5 w-3.5 text-[#F59E0B] inline fill-[#F59E0B]" /> : <span className="text-[#475569]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // ── memberships ───────────────────────────────────────────────────────────
  const memberQ = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null,
    [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQ);
  const clubId = memberships?.[0]?.clubId ?? null;

  // ── matches ───────────────────────────────────────────────────────────────
  const matchQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: allMatches, isLoading: matchLoading } = useCollection<MatchDoc>(matchQ);

  // ── confirmations (player stats) ──────────────────────────────────────────
  const confirmQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'match_confirmations'), where('clubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: confirmations } = useCollection<ConfirmDoc>(confirmQ);

  // ── squad athletes ────────────────────────────────────────────────────────
  const athleteQ = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null,
    [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athleteQ);

  const athleteMap = useMemo(() => {
    const m = new Map<string, AthleteProfile>();
    athletes?.forEach(a => m.set(a.uid, a));
    return m;
  }, [athletes]);

  const matchById = useMemo(() => {
    const m = new Map<string, MatchDoc>();
    allMatches?.forEach(match => m.set(match.id, match));
    return m;
  }, [allMatches]);

  // ── filters ───────────────────────────────────────────────────────────────
  const [season, setSeason] = useState<string>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [competition, setCompetition] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

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
    publishedMatches.filter(m => {
      if (season !== 'all' && m.season !== season) return false;
      if (venueFilter !== 'all' && (m.venue ?? 'Home') !== venueFilter) return false;
      if (competition !== 'all' && m.competition !== competition) return false;
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      return true;
    }),
    [publishedMatches, season, venueFilter, competition, dateFrom, dateTo]);

  const filteredMatchIds = useMemo(() => new Set(filtered.map(m => m.id)), [filtered]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [profileAthlete, setProfileAthlete] = useState<string | null>(null);
  const [playerPage, setPlayerPage] = useState(1);
  const [playerPerPage, setPlayerPerPage] = useState(25);
  const playerSort = useSortState('goals');

  // ─── PLAYER STATS aggregation ────────────────────────────────────────────
  const { playerRows, playerMatchMap } = useMemo(() => {
    const byAthlete = new Map<string, {
      goals: number; assists: number; shots: number; pom: number;
      ratingSum: number; ratingCount: number; yellow: number; red: number;
      mins: number; apps: number; won: number; drawn: number; lost: number;
    }>();
    const matchMap = new Map<string, PlayerMatchRow[]>();

    for (const c of confirmations ?? []) {
      const matchDoc = c.matchId && c.matchId !== 'manual' ? matchById.get(c.matchId) : null;

      // If there's a real match, apply the filters; if manual, always include
      if (matchDoc && !filteredMatchIds.has(matchDoc.id)) continue;

      const existing = byAthlete.get(c.athleteId) ?? {
        goals: 0, assists: 0, shots: 0, pom: 0,
        ratingSum: 0, ratingCount: 0, yellow: 0, red: 0,
        mins: 0, apps: 0, won: 0, drawn: 0, lost: 0
      };
      existing.apps++;
      existing.goals += c.stats.goals ?? 0;
      existing.assists += c.stats.assists ?? 0;
      existing.shots += c.stats.shots ?? 0;
      if (c.stats.manOfTheMatch) existing.pom++;
      const rating = c.stats.rating ?? 0;
      if (rating > 0) { existing.ratingSum += rating; existing.ratingCount++; }
      existing.yellow += c.stats.yellowCards ?? 0;
      existing.red += c.stats.redCards ?? 0;
      existing.mins += c.stats.minutes ?? 0;
      if (matchDoc?.result === 'W') existing.won++;
      else if (matchDoc?.result === 'D') existing.drawn++;
      else if (matchDoc?.result === 'L') existing.lost++;
      byAthlete.set(c.athleteId, existing);

      // build match-by-match log
      const matchRowsForAthlete = matchMap.get(c.athleteId) ?? [];
      matchRowsForAthlete.push({
        confirmId: c.id,
        matchId: c.matchId,
        opponent: matchDoc?.opponent ?? c.opponent ?? 'Manual Entry',
        date: matchDoc?.date ?? '',
        goals: c.stats.goals ?? 0,
        assists: c.stats.assists ?? 0,
        shots: c.stats.shots ?? 0,
        mins: c.stats.minutes ?? 0,
        rating: c.stats.rating ?? 0,
        yellow: c.stats.yellowCards ?? 0,
        red: c.stats.redCards ?? 0,
        pom: c.stats.manOfTheMatch ?? false,
        manual: c.manual ?? false,
      });
      matchMap.set(c.athleteId, matchRowsForAthlete);
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
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
      };
    });

    const dir = playerSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = (a as Record<string, unknown>)[playerSort.col] ?? 0;
      const bv = (b as Record<string, unknown>)[playerSort.col] ?? 0;
      if (typeof av === 'string') return dir * (av as string).localeCompare(bv as string);
      return dir * ((av as number) - (bv as number));
    });

    return { playerRows: rows, playerMatchMap: matchMap };
  }, [confirmations, filteredMatchIds, matchById, athleteMap, playerSort.col, playerSort.dir]);

  // ─── TEAM STATS aggregation ───────────────────────────────────────────────
  const teamStats = useMemo(() => {
    const init = (): VenueSplit => ({ total: 0, home: 0, away: 0, neutral: 0 });
    const vKey = (m: MatchDoc): keyof VenueSplit => {
      const v = (m.venue ?? 'Home').toLowerCase();
      return v === 'away' ? 'away' : v === 'neutral' ? 'neutral' : 'home';
    };
    const played = init(), wins = init(), draws = init(), losses = init(),
      gf = init(), ga = init(), cs = init(), att = init(), attCount = init();
    for (const m of filtered) {
      const k = vKey(m);
      played.total++; played[k]++;
      if (m.result === 'W') { wins.total++; wins[k]++; }
      else if (m.result === 'D') { draws.total++; draws[k]++; }
      else if (m.result === 'L') { losses.total++; losses[k]++; }
      gf.total += m.goalsFor ?? 0; gf[k] += m.goalsFor ?? 0;
      ga.total += m.goalsAgainst ?? 0; ga[k] += m.goalsAgainst ?? 0;
      if (m.cleanSheet) { cs.total++; cs[k]++; }
      if (m.attendance) { att.total += m.attendance; att[k] += m.attendance; attCount.total++; attCount[k]++; }
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
    const vKey = (m: MatchDoc): keyof VenueSplit => {
      const v = (m.venue ?? 'Home').toLowerCase();
      return v === 'away' ? 'away' : v === 'neutral' ? 'neutral' : 'home';
    };
    const gf = init(), ga = init(), assists = init();
    const scorers = new Map<string, { name: string; goals: number }>();
    for (const m of filtered) {
      const k = vKey(m);
      gf.total += m.goalsFor ?? 0; gf[k] += m.goalsFor ?? 0;
      ga.total += m.goalsAgainst ?? 0; ga[k] += m.goalsAgainst ?? 0;
      for (const g of m.goals ?? []) {
        if (!g.ownGoal && g.scorerName) {
          const existing = scorers.get(g.scorerName) ?? { name: g.scorerName, goals: 0 };
          existing.goals++;
          scorers.set(g.scorerName, existing);
        }
        if (g.assisterName) { assists.total++; assists[k]++; }
      }
    }
    const topScorers = Array.from(scorers.values()).sort((a, b) => b.goals - a.goals).slice(0, 10);
    const matchCount = filtered.length || 1;
    const homeMatches = filtered.filter(m => (m.venue ?? 'Home') === 'Home').length || 1;
    const awayMatches = filtered.filter(m => m.venue === 'Away').length || 1;
    const neutralMatches = filtered.filter(m => m.venue === 'Neutral').length || 1;
    const avgGf: VenueSplit = {
      total: +(gf.total / matchCount).toFixed(2),
      home: +(gf.home / homeMatches).toFixed(2),
      away: +(gf.away / awayMatches).toFixed(2),
      neutral: +(gf.neutral / neutralMatches).toFixed(2),
    };
    return { gf, ga, assists, avgGf, topScorers };
  }, [filtered]);

  // ─── DISCIPLINE STATS aggregation ────────────────────────────────────────
  const disciplineStats = useMemo(() => {
    const init = (): VenueSplit => ({ total: 0, home: 0, away: 0, neutral: 0 });
    const vKey = (m: MatchDoc): keyof VenueSplit => {
      const v = (m.venue ?? 'Home').toLowerCase();
      return v === 'away' ? 'away' : v === 'neutral' ? 'neutral' : 'home';
    };
    const yellows = init(), reds = init(), fouls = init();
    const byPlayer = new Map<string, { name: string; yellow: number; red: number }>();
    for (const m of filtered) {
      const k = vKey(m);
      yellows.total += m.totalYellowCards ?? 0; yellows[k] += m.totalYellowCards ?? 0;
      reds.total += m.totalRedCards ?? 0; reds[k] += m.totalRedCards ?? 0;
      fouls.total += m.fouls ?? 0; fouls[k] += m.fouls ?? 0;
    }
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

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const playerKpis = useMemo(() => {
    const topPom = [...playerRows].sort((a, b) => b.pom - a.pom)[0];
    const topGoals = [...playerRows].sort((a, b) => b.goals - a.goals)[0];
    const avgRating = playerRows.length
      ? +(playerRows.reduce((s, r) => s + r.avgRating, 0) / playerRows.length).toFixed(2)
      : 0;
    return { total: playerRows.length, avgRating, topPom, topGoals };
  }, [playerRows]);

  // ─── pagination ───────────────────────────────────────────────────────────
  const paginatedPlayers = useMemo(() => {
    const start = (playerPage - 1) * playerPerPage;
    return playerRows.slice(start, start + playerPerPage);
  }, [playerRows, playerPage, playerPerPage]);

  // ─── CSV exports ──────────────────────────────────────────────────────────
  const exportPlayers = () => exportCSV(
    [['Name', 'Position', 'Apps', 'Goals', 'Assists', 'Shots', 'POM', 'Avg Rating', 'Yellow', 'Red', 'Mins', 'Won', 'Drawn', 'Lost'],
      ...playerRows.map(r => [r.name, r.position, r.apps, r.goals, r.assists, r.shots, r.pom, r.avgRating, r.yellow, r.red, r.mins, r.won, r.drawn, r.lost])],
    `player-stats-${season}.csv`
  );

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

  const exportGoals = () => exportCSV(
    [['Metric', 'Total', 'Home', 'Away', 'Neutral'],
      ['Goals Scored', goalStats.gf.total, goalStats.gf.home, goalStats.gf.away, goalStats.gf.neutral],
      ['Goals Conceded', goalStats.ga.total, goalStats.ga.home, goalStats.ga.away, goalStats.ga.neutral],
      ['Assists', goalStats.assists.total, goalStats.assists.home, goalStats.assists.away, goalStats.assists.neutral],
      ['Avg Goals / Match', goalStats.avgGf.total, goalStats.avgGf.home, goalStats.avgGf.away, goalStats.avgGf.neutral],
      [], ['Top Scorers', 'Goals'],
      ...goalStats.topScorers.map(s => [s.name, s.goals])],
    `goal-stats-${season}.csv`
  );

  const exportDiscipline = () => exportCSV(
    [['Metric', 'Total', 'Home', 'Away', 'Neutral'],
      ['Yellow Cards', disciplineStats.yellows.total, disciplineStats.yellows.home, disciplineStats.yellows.away, disciplineStats.yellows.neutral],
      ['Red Cards', disciplineStats.reds.total, disciplineStats.reds.home, disciplineStats.reds.away, disciplineStats.reds.neutral],
      ['Fouls', disciplineStats.fouls.total, disciplineStats.fouls.home, disciplineStats.fouls.away, disciplineStats.fouls.neutral],
      [], ['Player', 'Yellow Cards', 'Red Cards'],
      ...disciplineStats.playerDiscipline.map(p => [p.name, p.yellow, p.red])],
    `discipline-stats-${season}.csv`
  );

  const isLoading = matchLoading && !allMatches;

  // ─── profile drawer data ──────────────────────────────────────────────────
  const profileRow = useMemo(() =>
    playerRows.find(r => r.athleteId === profileAthlete) ?? null,
    [playerRows, profileAthlete]);

  const profileMatchRows = useMemo(() =>
    profileAthlete ? (playerMatchMap.get(profileAthlete) ?? []) : [],
    [playerMatchMap, profileAthlete]);

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
      {/* ── Page header + filters ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Stats</h1>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''} · Aggregated from match records
            </p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={season} onValueChange={v => { setSeason(v); setPlayerPage(1); }}>
            <SelectTrigger className="h-8 w-32 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s === 'all' ? 'All Seasons' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={venueFilter} onValueChange={v => { setVenueFilter(v); setPlayerPage(1); }}>
            <SelectTrigger className="h-8 w-28 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Venue" />
            </SelectTrigger>
            <SelectContent>
              {['all', 'Home', 'Away', 'Neutral'].map(v => (
                <SelectItem key={v} value={v} className="text-xs">{v === 'all' ? 'All Venues' : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={competition} onValueChange={v => { setCompetition(v); setPlayerPage(1); }}>
            <SelectTrigger className="h-8 w-36 bg-[#1C2333] border-white/10 text-xs font-bold">
              <SelectValue placeholder="Competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c === 'all' ? 'All Competitions' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPlayerPage(1); }}
              className="h-8 w-36 bg-[#1C2333] border-white/10 text-xs font-bold text-white [color-scheme:dark]"
              placeholder="From"
            />
            <span className="text-[#475569] text-xs">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPlayerPage(1); }}
              className="h-8 w-36 bg-[#1C2333] border-white/10 text-xs font-bold text-white [color-scheme:dark]"
              placeholder="To"
            />
          </div>

          {(dateFrom || dateTo || season !== 'all' || venueFilter !== 'all' || competition !== 'all') && (
            <Button
              size="sm" variant="ghost"
              className="h-8 text-[11px] text-[#64748B] hover:text-white"
              onClick={() => { setSeason('all'); setVenueFilter('all'); setCompetition('all'); setDateFrom(''); setDateTo(''); setPlayerPage(1); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
        </div>
      ) : (
        <Tabs defaultValue="player" onValueChange={() => setPlayerPage(1)}>
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
              <KpiCard
                label="Avg Team Rating"
                value={playerKpis.avgRating > 0 ? n(playerKpis.avgRating, 2) : '—'}
                color={ratingColor(playerKpis.avgRating)}
              />
              <KpiCard
                label="Top POM"
                value={playerKpis.topPom?.name ?? '—'}
                sub={playerKpis.topPom ? `${playerKpis.topPom.pom} award${playerKpis.topPom.pom !== 1 ? 's' : ''}` : undefined}
                color="#F59E0B"
              />
              <KpiCard
                label="Top Scorer"
                value={playerKpis.topGoals?.name ?? '—'}
                sub={playerKpis.topGoals ? `${playerKpis.topGoals.goals} goal${playerKpis.topGoals.goals !== 1 ? 's' : ''}` : undefined}
                color="#22C55E"
              />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/8 bg-[#1C2333] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">
                  {playerRows.length} player{playerRows.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    className="h-7 gap-1.5 text-[11px] font-black bg-[#00C853] text-black hover:bg-[#00C853]/90"
                  >
                    <Plus className="h-3.5 w-3.5" />Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exportPlayers} className="h-7 gap-1.5 text-[11px] font-black text-[#64748B] hover:text-white">
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
              </div>

              {playerRows.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-10 w-10 text-[#334155] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#64748B]">No stats recorded yet.</p>
                  <p className="text-xs text-[#475569] mt-1">Log matches in Match Entry or click <strong>Add</strong> to log your first player.</p>
                  <Button
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    className="mt-4 h-8 gap-1.5 text-[11px] font-black bg-[#00C853] text-black hover:bg-[#00C853]/90"
                  >
                    <Plus className="h-3.5 w-3.5" />Add Player Stats
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-white border-collapse">
                      <thead className="border-b border-white/10 bg-[#151D2E]">
                        <tr>
                          <Th col="name" label="Name" sort={playerSort} className="min-w-[140px] sticky left-0 bg-[#151D2E]" />
                          <Th col="position" label="Pos" sort={playerSort} />
                          <Th col="apps" label="Apps" sort={playerSort} />
                          <Th col="goals" label="Goals" sort={playerSort} />
                          <Th col="assists" label="Asst" sort={playerSort} />
                          <Th col="shots" label="Shots" sort={playerSort} />
                          <Th col="pom" label="POM" sort={playerSort} />
                          <Th col="avgRating" label="Avg Rtg" sort={playerSort} />
                          <Th col="yellow" label="YC" sort={playerSort} />
                          <Th col="red" label="RC" sort={playerSort} />
                          <Th col="mins" label="Mins" sort={playerSort} />
                          <Th col="won" label="W" sort={playerSort} />
                          <Th col="drawn" label="D" sort={playerSort} />
                          <Th col="lost" label="L" sort={playerSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPlayers.map((row, i) => (
                          <tr
                            key={row.athleteId}
                            className={`border-t border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                          >
                            <td className="px-3 py-3 sticky left-0 bg-inherit">
                              <button
                                className="font-bold text-white hover:text-[#00C853] transition-colors text-left underline-offset-2 hover:underline"
                                onClick={() => setProfileAthlete(row.athleteId)}
                              >
                                {row.name}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-[11px] text-[#94A3B8] font-mono">{row.position}</td>
                            <td className="px-3 py-3 font-mono text-center">{row.apps}</td>
                            <td className="px-3 py-3 font-mono text-center font-black text-[#22C55E]">{row.goals}</td>
                            <td className="px-3 py-3 font-mono text-center">{row.assists}</td>
                            <td className="px-3 py-3 font-mono text-center text-[#94A3B8]">{row.shots}</td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.pom > 0
                                ? <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 text-[10px] font-black px-1.5">{row.pom}×</Badge>
                                : <span className="text-[#475569]">—</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.avgRating > 0
                                ? <span className="font-black text-sm" style={{ color: ratingColor(row.avgRating) }}>{n(row.avgRating, 2)}</span>
                                : <span className="text-[#475569]">—</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.yellow > 0
                                ? <span className="font-black text-[#F59E0B]">{row.yellow}</span>
                                : <span className="text-[#475569]">0</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center">
                              {row.red > 0
                                ? <span className="font-black text-[#EF4444]">{row.red}</span>
                                : <span className="text-[#475569]">0</span>}
                            </td>
                            <td className="px-3 py-3 font-mono text-center text-[#94A3B8]">{n(row.mins)}'</td>
                            <td className="px-3 py-3 font-mono text-center text-[#22C55E] font-bold">{row.won}</td>
                            <td className="px-3 py-3 font-mono text-center text-[#F59E0B] font-bold">{row.drawn}</td>
                            <td className="px-3 py-3 font-mono text-center text-[#EF4444] font-bold">{row.lost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-white/5">
                    {paginatedPlayers.map(row => (
                      <div key={row.athleteId} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <button
                              className="font-black text-white text-sm hover:text-[#00C853] transition-colors text-left"
                              onClick={() => setProfileAthlete(row.athleteId)}
                            >
                              {row.name}
                            </button>
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
                        <div className="flex gap-3 mt-2 justify-center">
                          {[
                            { label: 'W', value: row.won, color: '#22C55E' },
                            { label: 'D', value: row.drawn, color: '#F59E0B' },
                            { label: 'L', value: row.lost, color: '#EF4444' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="text-center">
                              <span className="text-[10px] text-[#64748B] font-black mr-1">{label}</span>
                              <span className="font-black text-sm tabular-nums" style={{ color }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {playerRows.length > 25 && (
                    <Pagination
                      total={playerRows.length}
                      page={playerPage}
                      perPage={playerPerPage}
                      onPage={setPlayerPage}
                      onPerPage={setPlayerPerPage}
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ══════════════ TEAM STATS ══════════════ */}
          <TabsContent value="team" className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Win Rate"
                value={pct(teamStats.wins.total, teamStats.played.total)}
                sub={`${teamStats.wins.total}W ${teamStats.draws.total}D ${teamStats.losses.total}L`}
                color="#22C55E"
              />
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
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <TrendingUp className="h-10 w-10 text-[#334155] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#64748B]">No match data for the selected filters.</p>
                </div>
              ) : (
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
              )}
            </div>
          </TabsContent>

          {/* ══════════════ GOAL STATS ══════════════ */}
          <TabsContent value="goals" className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total Goals" value={n(goalStats.gf.total)} sub="this period" color="#22C55E" />
              <KpiCard label="Avg per Match" value={n(goalStats.avgGf.total, 2)} sub="goals scored" />
              <KpiCard
                label="Top Scorer"
                value={goalStats.topScorers[0]?.name ?? '—'}
                sub={goalStats.topScorers[0] ? `${goalStats.topScorers[0].goals} goal${goalStats.topScorers[0].goals !== 1 ? 's' : ''}` : undefined}
                color="#F59E0B"
              />
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
                {filtered.length === 0 ? (
                  <div className="py-10 text-center">
                    <Target className="h-8 w-8 text-[#334155] mx-auto mb-2" />
                    <p className="text-xs text-[#64748B]">No match data for selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-[#94A3B8] border-collapse">
                      <VenueTableHead />
                      <tbody>
                        <VRow label="Goals Scored" split={goalStats.gf} color="#22C55E" />
                        <VRow label="Goals Conceded" split={goalStats.ga} color="#EF4444" />
                        <VRow label="Assists" split={goalStats.assists} color="#3B82F6" />
                        <VRow label="Avg per Match" split={goalStats.avgGf} color="#F59E0B" fmt={v => v.toFixed(2)} />
                      </tbody>
                    </table>
                  </div>
                )}
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
              <KpiCard label="Foul Rate" value={String(disciplineStats.foulRate)} sub="fouls per match avg" color="#94A3B8" />
              <KpiCard
                label="Worst Offender"
                value={disciplineStats.playerDiscipline[0]?.name ?? '—'}
                sub={disciplineStats.playerDiscipline[0]
                  ? `${disciplineStats.playerDiscipline[0].yellow}Y ${disciplineStats.playerDiscipline[0].red}R`
                  : undefined}
                color="#EF4444"
              />
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
                {filtered.length === 0 ? (
                  <div className="py-10 text-center">
                    <ShieldAlert className="h-8 w-8 text-[#334155] mx-auto mb-2" />
                    <p className="text-xs text-[#64748B]">No match data for selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-[#94A3B8] border-collapse">
                      <VenueTableHead />
                      <tbody>
                        <VRow label="Yellow Cards" split={disciplineStats.yellows} color="#F59E0B" />
                        <VRow label="Red Cards" split={disciplineStats.reds} color="#EF4444" />
                        <VRow label="Total Fouls" split={disciplineStats.fouls} />
                      </tbody>
                    </table>
                  </div>
                )}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white truncate">{player.name}</p>
                              {atRisk && (
                                <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 text-[9px] font-black px-1.5 py-0 h-4 shrink-0">
                                  ⚠ RISK
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
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

      {/* ── Add Stat Modal ── */}
      {clubId && (
        <AddStatModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          clubId={clubId}
          athletes={athletes ?? []}
          firestore={firestore}
          onSaved={() => {}}
        />
      )}

      {/* ── Player Profile Drawer ── */}
      {profileRow && (
        <PlayerProfileDrawer
          open={!!profileAthlete}
          onClose={() => setProfileAthlete(null)}
          athleteId={profileRow.athleteId}
          athleteName={profileRow.name}
          position={profileRow.position}
          matchRows={profileMatchRows}
          summary={profileRow}
        />
      )}
    </div>
  );
}
