'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2, Users, Trophy, ShieldCheck, MapPin, Mail,
  Phone, Globe, Loader2, Star, Calendar
} from 'lucide-react';
import type { ClubMember, ClubProfile, AthleteProfile, ClubMatch } from '@/lib/types';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

export default function CoachClubViewPage() {
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
  const { data: club, isLoading: clubLoading } = useDoc<ClubProfile>(clubRef);

  const allMembersQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active')) : null
  ), [firestore, clubId]);
  const { data: allMembers } = useCollection<ClubMember>(allMembersQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches } = useCollection<ClubMatch>(matchesQuery);

  const stats = useMemo(() => {
    const wins = matches?.filter(m => m.result === 'W').length ?? 0;
    const losses = matches?.filter(m => m.result === 'L').length ?? 0;
    const draws = matches?.filter(m => m.result === 'D').length ?? 0;
    const total = wins + losses + draws;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, draws, total, winRate };
  }, [matches]);

  const recentMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [matches]);

  const coaches = allMembers?.filter(m => m.role === 'coach') ?? [];
  const admins = allMembers?.filter(m => m.role === 'admin') ?? [];

  const isLoading = memberLoading || clubLoading;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>;
  }

  if (!club) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building2 className="h-12 w-12 text-[#94A3B8]" />
        <p className="text-white font-black">Club profile not found</p>
        <p className="text-[#94A3B8] text-sm">Contact your club admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">Club Dashboard</h1>
        <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
          Club-level overview view
        </p>
      </div>

      {/* Club Header */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-[#1C2333] flex items-center justify-center shrink-0 overflow-hidden border border-[#1E293B]">
              {club.logoUrl ? (
                <img src={club.logoUrl} alt={club.clubName} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-[#94A3B8]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-black text-white">{club.clubName}</h2>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {club.sportFocus.map(s => (
                      <Badge key={s} className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[9px]">{s}</Badge>
                    ))}
                    {club.isVerified && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-black text-[9px]">
                        <ShieldCheck className="h-3 w-3 mr-1" />Verified Club
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {club.location && (
                  <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    <MapPin className="h-3 w-3" /> {club.location}
                  </div>
                )}
                {club.contactEmail && (
                  <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    <Mail className="h-3 w-3" /> {club.contactEmail}
                  </div>
                )}
                {club.contactPhone && (
                  <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    <Phone className="h-3 w-3" /> {club.contactPhone}
                  </div>
                )}
                {club.venue && (
                  <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                    <Building2 className="h-3 w-3" /> {club.venue}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Squad Size', value: athletes?.length ?? 0, color: 'text-white' },
          { label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-[#00C853]' },
          { label: 'Total Matches', value: stats.total, color: 'text-white' },
          { label: 'Staff Members', value: allMembers?.length ?? 0, color: 'text-white' },
        ].map(s => (
          <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Match record */}
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#00C853]" /> Match Record
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3">
              {[
                { label: 'W', value: stats.wins, color: 'bg-[#00C853]/10 border-[#00C853]/30 text-[#00C853]' },
                { label: 'D', value: stats.draws, color: 'bg-[#94A3B8]/10 border-[#94A3B8]/30 text-[#94A3B8]' },
                { label: 'L', value: stats.losses, color: 'bg-red-500/10 border-red-500/30 text-red-400' },
              ].map(s => (
                <div key={s.label} className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${s.color}`}>
                  <span className="text-2xl font-black">{s.value}</span>
                  <span className="text-[9px] font-black uppercase">{s.label}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Recent Results</p>
            {recentMatches.length > 0 ? recentMatches.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#1C2333]">
                <div className={cn(
                  'h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0',
                  m.result === 'W' ? 'bg-[#00C853]/20 text-[#00C853]' :
                    m.result === 'L' ? 'bg-red-500/20 text-red-400' :
                      m.result === 'D' ? 'bg-[#94A3B8]/20 text-[#94A3B8]' : 'bg-[#1E293B] text-[#94A3B8]'
                )}>
                  {m.result ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">vs {m.opponent}</p>
                  <p className="text-[9px] text-[#94A3B8] font-bold">{m.competition}</p>
                </div>
                <div className="text-right shrink-0">
                  {m.score && <p className="text-[10px] font-black text-white">{m.score}</p>}
                  <p className="text-[8px] text-[#94A3B8] font-bold">
                    {(() => { try { return format(parseISO(m.date), 'dd/MM'); } catch { return m.date; } })()}
                  </p>
                </div>
              </div>
            )) : <p className="text-[#94A3B8] text-sm text-center py-2">No matches logged yet</p>}
          </CardContent>
        </Card>

        {/* Staff */}
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4 text-[#00C853]" /> Club Staff
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {admins.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Admins</p>
                {admins.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#1C2333]">
                    <Avatar className="h-7 w-7 rounded-lg shrink-0">
                      <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                        {(m.displayName ?? '?')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-bold text-white flex-1 truncate">{m.displayName ?? 'Admin'}</p>
                    <Badge className="bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30 font-black text-[8px]">Admin</Badge>
                  </div>
                ))}
              </div>
            )}
            {coaches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Coaches</p>
                {coaches.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#1C2333]">
                    <Avatar className="h-7 w-7 rounded-lg shrink-0">
                      <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-xs font-black">
                        {(m.displayName ?? '?')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-bold text-white flex-1 truncate">{m.displayName ?? 'Coach'}</p>
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-black text-[8px]">Coach</Badge>
                  </div>
                ))}
              </div>
            )}
            {allMembers?.length === 0 && (
              <p className="text-[#94A3B8] text-sm text-center py-4">No staff members found</p>
            )}

            {/* Club settings preview */}
            {club.settings && (
              <div className="pt-3 border-t border-[#1E293B] space-y-2">
                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Active Seasons</p>
                <div className="flex flex-wrap gap-1">
                  {club.settings.seasons?.map(s => (
                    <Badge key={s} className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-bold text-[8px]">{s}</Badge>
                  ))}
                </div>
                <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest pt-1">Competitions</p>
                <div className="flex flex-wrap gap-1">
                  {club.settings.competitions?.slice(0, 4).map(c => (
                    <Badge key={c} className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-bold text-[8px]">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
