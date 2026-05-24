'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Search, Filter, ShieldCheck, TrendingUp, ChevronRight,
  Loader2, AlertTriangle, Star, Activity, Download
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import Link from 'next/link';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];
const SORT_OPTIONS = [
  { value: 'csi', label: 'CSI Score' },
  { value: 'name', label: 'Name' },
  { value: 'age', label: 'Age' },
  { value: 'risk', label: 'Risk Index' },
];

export default function CoachSquadPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');
  const [sortBy, setSortBy] = useState('csi');
  const [verifyFilter, setVerifyFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const filtered = useMemo(() => {
    let list = athletes ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        (a.position ?? '').toLowerCase().includes(q)
      );
    }
    if (positionFilter !== 'All') {
      list = list.filter(a => a.position === positionFilter || a.altPositions?.includes(positionFilter));
    }
    if (verifyFilter === 'verified') list = list.filter(a => a.isVerified);
    if (verifyFilter === 'unverified') list = list.filter(a => !a.isVerified);

    list = [...list].sort((a, b) => {
      if (sortBy === 'csi') return (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0);
      if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === 'age') return (a.age ?? 0) - (b.age ?? 0);
      if (sortBy === 'risk') return (b.riskIndex ?? 0) - (a.riskIndex ?? 0);
      return 0;
    });
    return list;
  }, [athletes, search, positionFilter, sortBy, verifyFilter]);

  const squadStats = useMemo(() => {
    const list = athletes ?? [];
    return {
      total: list.length,
      verified: list.filter(a => a.isVerified).length,
      avgCSI: list.length ? Math.round(list.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / list.length) : 0,
      avgAge: list.length ? Math.round(list.reduce((s, a) => s + (a.age ?? 0), 0) / list.length) : 0,
    };
  }, [athletes]);

  const isLoading = memberLoading || athletesLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">My Squad</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Full roster management
          </p>
        </div>
        <Button variant="outline" size="sm" className="border-[#1E293B] text-[#94A3B8] hover:text-white gap-2 font-black text-[10px] uppercase">
          <Download className="h-3 w-3" /> Export
        </Button>
      </div>

      {/* Squad KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: squadStats.total, color: 'text-white' },
          { label: 'Verified', value: squadStats.verified, color: 'text-[#00C853]' },
          { label: 'Avg CSI', value: squadStats.avgCSI || '--', color: 'text-white' },
          { label: 'Avg Age', value: squadStats.avgAge ? `${squadStats.avgAge}y` : '--', color: 'text-white' },
        ].map(s => (
          <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <Input
              placeholder="Search by name or position..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[120px] bg-[#1C2333] border-[#1E293B] text-white text-xs font-bold h-8">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                {POSITIONS.map(p => (
                  <SelectItem key={p} value={p} className="text-white text-xs font-bold">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[130px] bg-[#1C2333] border-[#1E293B] text-white text-xs font-bold h-8">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-[#1C2333] border-[#1E293B]">
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-white text-xs font-bold">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(['all', 'verified', 'unverified'] as const).map(v => (
              <Button
                key={v} size="sm"
                variant={verifyFilter === v ? 'default' : 'outline'}
                onClick={() => setVerifyFilter(v)}
                className={cn(
                  'h-8 font-black text-[10px] uppercase tracking-wide',
                  verifyFilter === v
                    ? 'bg-[#00C853] text-black hover:bg-[#00C853]/90'
                    : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333]'
                )}
              >
                {v}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">
            {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-white font-bold">No athletes found</p>
              <p className="text-[#94A3B8] text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map(a => <AthleteRow key={a.uid} athlete={a} />)
          )}
        </div>
      )}
    </div>
  );
}

function AthleteRow({ athlete: a }: { athlete: AthleteProfile }) {
  const csi = a.compositeScoutingIndex ?? 0;
  const risk = a.riskIndex ?? 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-[#1E293B] hover:border-[#00C853]/30 transition-colors">
      <Avatar className="h-10 w-10 rounded-xl shrink-0">
        <AvatarImage src={a.photoUrl} className="object-cover" />
        <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-sm font-black">
          {a.firstName[0]}{a.lastName[0]}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
          {a.jerseyNumber && (
            <span className="text-[9px] font-black text-[#94A3B8] bg-[#1C2333] px-1.5 py-0.5 rounded">#{a.jerseyNumber}</span>
          )}
          {a.isVerified && (
            <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px] h-4">✓</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position ?? 'N/A'}</span>
          <span className="text-[#1E293B]">·</span>
          <span className="text-[9px] font-bold text-[#94A3B8]">{a.age}y</span>
          {a.dominantFoot && (
            <>
              <span className="text-[#1E293B]">·</span>
              <span className="text-[9px] font-bold text-[#94A3B8]">{a.dominantFoot} foot</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* CSI */}
        <div className="text-center hidden sm:block">
          <p className={cn('text-lg font-black', csi >= 70 ? 'text-[#00C853]' : csi >= 50 ? 'text-white' : 'text-[#94A3B8]')}>
            {csi || '--'}
          </p>
          <p className="text-[8px] font-bold text-[#94A3B8]">CSI</p>
        </div>

        {/* Risk */}
        <div className="text-center hidden md:block">
          <p className={cn('text-lg font-black', risk >= 60 ? 'text-red-400' : risk >= 40 ? 'text-[#FF6D00]' : 'text-[#94A3B8]')}>
            {risk || '--'}
          </p>
          <p className="text-[8px] font-bold text-[#94A3B8]">Risk</p>
        </div>

        {/* Status badges */}
        <div className="flex flex-col gap-1">
          {a.readinessTier && (
            <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">
              {a.readinessTier}
            </Badge>
          )}
          {a.activelyLooking && (
            <Badge className="bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30 font-black text-[8px]">
              Seeking
            </Badge>
          )}
        </div>

        <Link href={`/coach-dashboard/analytics?athlete=${a.uid}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94A3B8] hover:text-[#00C853] hover:bg-[#1C2333]">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
