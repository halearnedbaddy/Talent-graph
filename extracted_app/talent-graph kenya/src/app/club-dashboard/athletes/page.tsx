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
import { Loader2, ArrowUpDown, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

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

    const columns: ColumnDef<AthleteProfile>[] = [
        {
            accessorKey: 'name',
            header: 'Athlete',
            accessorFn: (row) => `${row.firstName} ${row.lastName}`,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-black text-[10px] text-muted-foreground uppercase">
                        {row.original.firstName[0]}{row.original.lastName[0]}
                    </div>
                    <div>
                        <p className="text-sm font-black uppercase leading-none">{row.original.firstName} {row.original.lastName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">@{row.original.username}</p>
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'position',
            header: 'Position',
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
                    CSI <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <span className="font-black text-primary">{row.original.compositeScoutingIndex || '--'}</span>
        },
        {
            accessorKey: 'performanceIndex',
            header: 'Performance',
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.performanceIndex || '--'}</span>
        },
        {
            accessorKey: 'efficiencyIndex',
            header: 'Efficiency',
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.efficiencyIndex || '--'}</span>
        },
        {
            accessorKey: 'consistencyIndex',
            header: 'Consistency',
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.consistencyIndex || '--'}</span>
        },
        {
            accessorKey: 'riskIndex',
            header: 'Risk',
            cell: ({ row }) => (
                <Badge variant={row.original.riskIndex && row.original.riskIndex > 70 ? 'destructive' : 'outline'} className="text-[9px] font-black h-5">
                    {row.original.riskIndex || '--'}
                </Badge>
            )
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
                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                    <Link href={`/${row.original.username}`}>
                        <ExternalLink className="w-4 h-4" />
                    </Link>
                </Button>
            )
        }
    ];

    const table = useReactTable({
        data: athletes || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    });

    const isLoading = connectionsLoading || athletesLoading;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">SQUAD LIST</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Complete roster management</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search athlete name..."
                        value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                        onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
                        className="w-64 h-9 bg-background"
                    />
                </div>
            </div>

            <div className="rounded-xl border bg-background overflow-hidden shadow-xl">
                <Table>
                    <TableHeader className="bg-neutral-50">
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
                        {isLoading ? (
                            <TableRow><TableCell colSpan={columns.length} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/30 border-b last:border-0">
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest">No squad members detected</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
