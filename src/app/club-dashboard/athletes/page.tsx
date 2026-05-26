'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { AthleteProfile, ClubMember } from '@/lib/types';
import {
  Loader2, ArrowUpDown, ShieldCheck, Clock, ExternalLink,
  Search, MessageSquare, Users, UserCheck
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STAFF_ROLES = new Set(['coach', 'assistant_coach', 'gk_coach', 'fitness_coach', 'scout', 'analyst', 'video_analyst', 'physio', 'doctor', 'kit_manager', 'staff']);

const ROLE_COLORS: Record<string, string> = {
  coach: 'bg-blue-500/15 text-blue-400 border-none',
  assistant_coach: 'bg-blue-400/15 text-blue-300 border-none',
  gk_coach: 'bg-cyan-500/15 text-cyan-400 border-none',
  fitness_coach: 'bg-teal-500/15 text-teal-400 border-none',
  scout: 'bg-purple-500/15 text-purple-400 border-none',
  analyst: 'bg-amber-500/15 text-amber-400 border-none',
  video_analyst: 'bg-orange-500/15 text-orange-400 border-none',
  physio: 'bg-red-500/15 text-red-400 border-none',
  doctor: 'bg-rose-500/15 text-rose-400 border-none',
  staff: 'bg-[#94A3B8]/15 text-[#94A3B8] border-none',
};

function dmConvId(a: string, b: string) {
  return [a, b].sort().join('_dm_');
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export default function SquadListPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  const squadMembersQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active'))
      : null
  ), [firestore, clubId]);
  const { data: squadMembers, isLoading: squadLoading } = useCollection<ClubMember>(squadMembersQuery);

  const { staffMembers, athleteIds } = React.useMemo(() => {
    const staff: ClubMember[] = [];
    const ids: string[] = [];
    for (const m of (squadMembers || [])) {
      if (m.role && STAFF_ROLES.has(m.role)) {
        staff.push(m);
      } else {
        if (m.userId) ids.push(m.userId);
      }
    }
    return { staffMembers: staff, athleteIds: [...new Set(ids)] };
  }, [squadMembers]);

  const athletesQuery = useMemoFirebase(() => (
    firestore && athleteIds.length > 0
      ? query(collection(firestore, 'athletes'), where('uid', 'in', athleteIds))
      : null
  ), [firestore, athleteIds]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const [searchValue, setSearchValue] = React.useState('');

  const filteredAthletes = React.useMemo(() => {
    if (!athletes) return [];
    if (!searchValue) return athletes;
    return athletes.filter(a =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchValue.toLowerCase()) ||
      a.username?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [athletes, searchValue]);

  const filteredStaff = React.useMemo(() => {
    if (!staffMembers) return [];
    if (!searchValue) return staffMembers;
    return staffMembers.filter(m =>
      (m.displayName || '').toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [staffMembers, searchValue]);

  const openDM = React.useCallback((targetId: string) => {
    if (!user?.uid) return;
    const convId = dmConvId(user.uid, targetId);
    router.push(`/club-dashboard/messages?conv=${convId}`);
  }, [user, router]);

  const columns: ColumnDef<AthleteProfile>[] = [
    {
      accessorKey: 'name',
      header: 'Athlete',
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 rounded-lg shrink-0">
            <AvatarImage src={row.original.photoUrl} alt={`${row.original.firstName} ${row.original.lastName}`} className="object-cover rounded-lg" />
            <AvatarFallback className="rounded-lg bg-[#1E293B] font-black text-[10px] text-[#94A3B8] uppercase">
              {row.original.firstName?.[0]}{row.original.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-black uppercase leading-none">{row.original.firstName} {row.original.lastName}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">@{row.original.username}</p>
          </div>
        </div>
      )
    },
    {
      accessorKey: 'position',
      header: 'Pos',
      cell: ({ row }) => <span className="capitalize font-bold text-xs">{row.original.position}</span>
    },
    {
      accessorKey: 'age',
      header: 'Age',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.age}</span>
    },
    {
      accessorKey: 'compositeScoutingIndex',
      header: ({ column }) => (
        <Button variant="ghost" className="p-0 text-[10px] font-black uppercase tracking-widest hover:bg-transparent" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          CSI <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-black text-[#00C853]">{row.original.compositeScoutingIndex || '--'}</span>
    },
    {
      accessorKey: 'isVerified',
      header: 'Status',
      cell: ({ row }) => (
        row.original.isVerified
          ? <ShieldCheck className="w-4 h-4 text-green-500" />
          : <Clock className="w-4 h-4 text-orange-500" />
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 min-h-[44px] min-w-[44px] text-[#94A3B8] hover:text-[#00C853]"
            title={`Message ${row.original.firstName}`}
            onClick={() => openDM(row.original.uid)}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 min-h-[44px] min-w-[44px]">
            <Link href={`/${row.original.username}`}>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      )
    }
  ];

  const table = useReactTable({
    data: filteredAthletes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  const isLoading = squadLoading || athletesLoading;
  const totalCount = filteredAthletes.length + filteredStaff.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Squad</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {totalCount} member{totalCount !== 1 ? 's' : ''}
            {filteredStaff.length > 0 && ` · ${filteredStaff.length} staff`}
            {filteredAthletes.length > 0 && ` · ${filteredAthletes.length} athlete${filteredAthletes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search squad..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-11 w-full sm:w-56 bg-background text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-[#00C853]" />
        </div>
      ) : totalCount === 0 ? (
        <div className="flex h-32 items-center justify-center text-center">
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
            No squad members yet — invite athletes and staff to join your club
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredStaff.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-4 w-4 text-[#00C853]" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-[#94A3B8]">
                  Coaching Staff ({filteredStaff.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredStaff.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl bg-[#111827] border border-[#1E293B] p-3"
                  >
                    <Avatar className="h-11 w-11 rounded-xl shrink-0">
                      <AvatarImage src={member.photoUrl || undefined} className="object-cover rounded-xl" />
                      <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                        {getInitials(member.displayName || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate leading-tight">
                        {member.displayName || 'Staff Member'}
                      </p>
                      <Badge className={`mt-1 text-[9px] h-4 px-1.5 font-black uppercase tracking-wide ${ROLE_COLORS[member.role || 'staff'] || ROLE_COLORS.staff}`}>
                        {(member.role || 'staff').replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-[#94A3B8] hover:text-[#00C853]"
                      title={`Message ${member.displayName}`}
                      onClick={() => openDM(member.userId)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredAthletes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[#00C853]" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-[#94A3B8]">
                  Players ({filteredAthletes.length})
                </h2>
              </div>

              <div className="md:hidden space-y-3">
                {filteredAthletes.map((a) => (
                  <div key={a.uid} className="flex items-center gap-3 rounded-xl bg-[#111827] border border-[#1E293B] p-3">
                    <Avatar className="h-11 w-11 rounded-xl shrink-0">
                      <AvatarImage src={a.photoUrl} className="object-cover rounded-xl" />
                      <AvatarFallback className="rounded-xl bg-[#1C2333] font-black text-xs text-[#94A3B8] uppercase">
                        {a.firstName?.[0]}{a.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase leading-tight truncate text-white">{a.firstName} {a.lastName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase">{a.position}</span>
                        <span className="text-[10px] text-[#94A3B8]">·</span>
                        <span className="text-[10px] font-bold text-[#94A3B8]">{a.age}y</span>
                        <span className="text-[10px] font-black text-[#00C853]">CSI: {a.compositeScoutingIndex || '--'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {a.isVerified
                        ? <ShieldCheck className="w-4 h-4 text-green-500" />
                        : <Clock className="w-4 h-4 text-orange-500" />
                      }
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-[#94A3B8] hover:text-[#00C853]"
                        onClick={() => openDM(a.uid)}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild className="h-10 w-10">
                        <Link href={`/${a.username}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block rounded-xl border border-[#1E293B] bg-[#111827] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#0A0E1A]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-[#1E293B]">
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-widest h-12 text-[#94A3B8]">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#1C2333]/50 border-b border-[#1E293B] last:border-0">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
