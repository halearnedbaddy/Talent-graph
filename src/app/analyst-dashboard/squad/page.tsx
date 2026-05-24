'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import Link from 'next/link';

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

function getRiskColor(risk: number) {
  if (risk < 25) return 'text-green-500';
  if (risk < 50) return 'text-yellow-500';
  if (risk < 75) return 'text-orange-500';
  return 'text-red-500';
}

export default function AnalystSquadPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('All');

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes, isLoading } = useCollection<AthleteProfile>(athletesQuery);

  const filtered = useMemo(() => {
    let list = athletes ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || (a.position ?? '').toLowerCase().includes(q));
    }
    if (positionFilter !== 'All') list = list.filter(a => a.position === positionFilter || a.altPositions?.includes(positionFilter));
    return [...list].sort((a, b) => (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0));
  }, [athletes, search, positionFilter]);

  const stats = useMemo(() => ({
    total: athletes?.length ?? 0,
    verified: athletes?.filter(a => a.isVerified).length ?? 0,
    avgCSI: athletes?.length ? Math.round(athletes.reduce((s, a) => s + (a.compositeScoutingIndex ?? 0), 0) / (athletes.length)) : 0,
  }), [athletes]);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Squad View</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Read-only athlete profiles</p>
        </div>
        <Badge variant="secondary" className="self-start sm:self-auto gap-1.5 px-3 py-1.5 font-black text-[10px] uppercase">
          <Users className="w-3 h-3" /> {stats.total} Athletes
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Verified', value: stats.verified },
          { label: 'Avg CSI', value: stats.avgCSI },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-md bg-background">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes..." className="pl-8 h-10 font-medium" />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-28 h-10 font-bold text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Athlete list */}
      <div className="grid gap-3">
        {filtered.map(athlete => (
          <Card key={athlete.uid} className="border-none shadow-md bg-background overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <Avatar className="h-12 w-12 shrink-0 rounded-xl border-2 border-muted">
                  <AvatarImage src={athlete.photoUrl} className="object-cover" />
                  <AvatarFallback className="rounded-xl font-black text-sm">
                    {athlete.firstName?.[0]}{athlete.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-sm">{athlete.firstName} {athlete.lastName}</p>
                    {athlete.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {athlete.position && <Badge variant="secondary" className="text-[9px] font-black h-5 uppercase px-1.5">{athlete.position}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{athlete.age ? `${athlete.age}y` : ''} {athlete.nationality ?? ''}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg">{athlete.compositeScoutingIndex ?? '—'}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">CSI</p>
                  {(athlete.riskIndex ?? 0) > 0 && (
                    <p className={`text-[9px] font-black ${getRiskColor(athlete.riskIndex ?? 0)}`}>
                      Risk {athlete.riskIndex}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm">No athletes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
