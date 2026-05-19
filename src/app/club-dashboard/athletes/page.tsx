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
import type { ScoutConnection, AthleteProfile, ClubMember } from '@/lib/types';
import { Loader2, ArrowUpDown, ShieldCheck, Clock, ExternalLink, Search } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SquadListPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = userMemberships?.[0]?.clubId;

    const connectionsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
    ), [firestore, clubId]);
    const { data: connections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

    const athleteIds = React.useMemo(() => [...new Set(connections?.map(c => c.athleteId) || [])], [connections]);

    const athletesQuery = useMemoFirebase(() => (
        firestore && athleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', athleteIds)) : null
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

    const columns: ColumnDef<AthleteProfile>[] = [
        {
            accessorKey: 'name',
            header: 'Athlete',
            accessorFn: (row) => `${row.firstName} ${row.lastName}`,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 rounded-lg shrink-0">
                        <AvatarImage src={row.original.photoUrl} alt={`${row.original.firstName} ${row.original.lastName}`} className="object-cover rounded-lg" />
                        <AvatarFallback className="rounded-lg bg-muted font-black text-[10px] text-muted-foreground uppercase">
                            {row.original.firstName[0]}{row.original.lastName[0]}
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
            cell: ({ row }) => <span className="font-black text-primary">{row.original.compositeScoutingIndex || '--'}</span>
        },
        {
            accessorKey: 'isVerified',
            header: 'Status',
            cell: ({ row }) => (
                row.original.isVerified
                    ? <ShieldCheck className="w-4 h-4 text-green-600" />
                    : <Clock className="w-4 h-4 text-orange-500" />
            )
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <Button variant="ghost" size="icon" asChild className="h-9 w-9 min-h-[44px] min-w-[44px]">
                    <Link href={`/${row.original.username}`}>
                        <ExternalLink className="w-4 h-4" />
                    </Link>
                </Button>
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

    const isLoading = connectionsLoading || athletesLoading;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Squad List</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {filteredAthletes.length} player{filteredAthletes.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="pl-9 h-11 w-full sm:w-56 bg-background text-sm"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                    <Loader2 className="animate-spin text-primary" />
                </div>
            ) : filteredAthletes.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-center">
                    <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                        No squad members detected
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile card list */}
                    <div className="md:hidden space-y-3">
                        {filteredAthletes.map((a) => (
                            <div key={a.uid} className="flex items-center gap-3 rounded-xl bg-background border p-3 shadow-sm">
                                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center font-black text-sm text-muted-foreground uppercase shrink-0">
                                    {a.firstName[0]}{a.lastName[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase leading-tight truncate">{a.firstName} {a.lastName}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{a.position}</span>
                                        <span className="text-[10px] text-muted-foreground">•</span>
                                        <span className="text-[10px] font-bold text-muted-foreground">{a.age}y</span>
                                        <span className="text-[10px] font-black text-primary">CSI: {a.compositeScoutingIndex || '--'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {a.isVerified
                                        ? <ShieldCheck className="w-4 h-4 text-green-600" />
                                        : <Clock className="w-4 h-4 text-orange-500" />
                                    }
                                    <Button variant="ghost" size="icon" asChild className="h-10 w-10">
                                        <Link href={`/${a.username}`}>
                                            <ExternalLink className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border bg-background overflow-hidden shadow-xl">
                        <Table>
                            <TableHeader className="bg-neutral-50 dark:bg-neutral-900">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-widest h-12">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/30 border-b last:border-0">
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
                </>
            )}
        </div>
    );
}
