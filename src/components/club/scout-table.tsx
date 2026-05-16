
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
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
import type { ClubMember, ScoutProfile, ScoutConnection, AthleteProfile } from '@/lib/types';
import { Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type ScoutData = {
  scoutProfile: ScoutProfile;
  activeAthletes: number;
  avgAthleteScore: number | string;
};

// Hook to fetch and process all data needed for the scouts table
function useClubScoutsData(): { data: ScoutData[], isLoading: boolean } {
  const { user } = useUser();
  const firestore = useFirestore();
  const [data, setData] = React.useState<ScoutData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // 1. Get current user's club ID
  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: clubMemberships, isLoading: clubMembershipsLoading } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = clubMemberships?.[0]?.clubId;

  // 2. Get all scout members for the club who are ACTIVE
  const clubScoutsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(
        collection(firestore, 'club_members'), 
        where('clubId', '==', clubId), 
        where('role', '==', 'scout'),
        where('status', '==', 'active')
    ) : null
  ), [firestore, clubId]);
  const { data: clubScoutMembers, isLoading: clubScoutsLoading } = useCollection<ClubMember>(clubScoutsQuery);
  const scoutIds = React.useMemo(() => clubScoutMembers?.map(s => s.userId) || [], [clubScoutMembers]);

  // 3. Get all scout profiles
  const scoutProfilesQuery = useMemoFirebase(() => (
    firestore && scoutIds.length > 0 ? query(collection(firestore, 'scouts'), where('uid', 'in', scoutIds)) : null
  ), [firestore, scoutIds]);
  const { data: scoutProfiles, isLoading: profilesLoading } = useCollection<ScoutProfile>(scoutProfilesQuery);

  // 4. Get all accepted connections for the club
  const connectionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
  ), [firestore, clubId]);
  const { data: connections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const connectedAthleteIds = React.useMemo(() => [...new Set(connections?.map(c => c.athleteId) || [])], [connections]);

  // 5. Get all athlete profiles for score calculation
  const athletesQuery = useMemoFirebase(() => (
    firestore && connectedAthleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', connectedAthleteIds)) : null
  ), [firestore, connectedAthleteIds]);
  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  // 6. Combine all data once loaded
  React.useEffect(() => {
    const pageIsLoading = clubMembershipsLoading || clubScoutsLoading || profilesLoading || connectionsLoading || athletesLoading;

    if (pageIsLoading) {
      if (!isLoading) setIsLoading(true);
      return;
    }

    if (!scoutProfiles || scoutProfiles.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }

    const athleteMap = new Map(athletes?.map(a => [a.uid, a]));

    const processedData = scoutProfiles.map(scout => {
      const scoutConnections = connections?.filter(c => c.scoutId === scout.uid) || [];
      const activeAthletes = scoutConnections.length;

      const scoutAthletes = scoutConnections.map(c => athleteMap.get(c.athleteId)).filter((a): a is AthleteProfile => !!a);
      const totalScore = scoutAthletes.reduce((acc, a) => acc + (a.talentGraphScore || 0), 0);
      const avgAthleteScore = activeAthletes > 0 ? Math.round(totalScore / activeAthletes) : 'N/A';

      return {
        scoutProfile: scout,
        activeAthletes,
        avgAthleteScore,
      };
    });

    setData(processedData);
    setIsLoading(false);

  }, [clubMembershipsLoading, clubScoutsLoading, profilesLoading, connectionsLoading, athletesLoading, scoutProfiles, connections, athletes, isLoading]);

  return { data, isLoading };
}

export const columns: ColumnDef<ScoutData>[] = [
    {
        accessorKey: 'scoutProfile.name',
        header: 'Scout Name',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <span className="font-medium">{row.original.scoutProfile.name}</span>
                <span className="text-xs text-muted-foreground">@{row.original.scoutProfile.username}</span>
            </div>
        )
    },
    {
        accessorKey: 'activeAthletes',
        header: 'Active Athletes',
    },
    {
        accessorKey: 'avgAthleteScore',
        header: 'Avg. Athlete Score',
    },
    {
        id: 'actions',
        header: 'Profile',
        cell: ({ row }) => (
            <Button variant="ghost" size="sm" asChild className="h-8">
                <Link href={`/scout/${row.original.scoutProfile.username}`}>
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View
                </Link>
            </Button>
        )
    }
];

export function ScoutTable() {
    const { data, isLoading } = useClubScoutsData();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
        },
    });

    return (
        <div className="w-full">
            <div className="rounded-md border bg-background">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                        return (
                            <TableHead key={header.id}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}
                            </TableHead>
                        );
                        })}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                            </TableCell>
                        </TableRow>
                    ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                        No active scouts found in this club.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
        </div>
    );
}
