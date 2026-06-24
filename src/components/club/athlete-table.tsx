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
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { smsSend } from '@/hooks/useSMS';
import type { ScoutConnection, AthleteProfile, ClubMember, ScoutProfile } from '@/lib/types';
import { Loader2, ArrowUpDown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';


type AthleteData = {
    connection: ScoutConnection;
    athlete: AthleteProfile;
    scout: ScoutProfile;
};

const RecruitmentStageDropdown = ({ connection }: { connection: ScoutConnection }) => {
    const firestore = useFirestore();
    const [stage, setStage] = React.useState(connection.recruitment_stage);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleUpdate = async (newStage: string) => {
        if (!firestore) return;
        setIsUpdating(true);
        const connectionRef = doc(firestore, 'scout_connections', connection.id);

        await updateDoc(connectionRef, {
            recruitment_stage: newStage,
            updatedAt: new Date().toISOString()
        });

        // SMS for important recruitment milestones
        if (['shortlisted', 'offer_extended', 'evaluating', 'signed'].includes(newStage)) {
            try {
                const athleteSnap = await getDoc(doc(firestore, 'athletes', connection.athleteId));
                const a = athleteSnap.data() as AthleteProfile | undefined;
                if (a) {
                    smsSend('recruitment-stage', {
                        athletePhone: (a as any).phone,
                        athleteName: a.firstName,
                        stage: newStage,
                        clubName: undefined,
                    });
                }
            } catch {}
        }

        setStage(newStage as any);
        setIsUpdating(false);
    };

    return (
        <div className="flex items-center gap-2">
            {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
            <Select onValueChange={handleUpdate} value={stage} disabled={isUpdating}>
            <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="evaluating">Evaluating</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="offer_extended">Offer Extended</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
            </Select>
        </div>
    );
};


export const columns: ColumnDef<AthleteData>[] = [
  {
    id: 'athleteName',
    header: 'Athlete Name',
    accessorFn: (row) => `${row.athlete.firstName} ${row.athlete.lastName}`,
    cell: ({ row }) => (
      <div className="flex items-center gap-3 min-w-[160px]">
        <Avatar className="w-8 h-8 rounded-lg shrink-0">
          <AvatarImage src={row.original.athlete.photoUrl} alt={`${row.original.athlete.firstName} ${row.original.athlete.lastName}`} className="object-cover rounded-lg" />
          <AvatarFallback className="rounded-lg bg-muted font-black text-[10px] text-muted-foreground uppercase">
            {row.original.athlete.firstName[0]}{row.original.athlete.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase leading-none truncate">{row.original.athlete.firstName} {row.original.athlete.lastName}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{row.original.athlete.position}</p>
        </div>
      </div>
    ),
  },
  { 
    accessorKey: 'athlete.age', 
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  { 
    id: 'position',
    accessorKey: 'athlete.position', 
    header: 'Position', 
    cell: ({row}) => <span className="capitalize">{row.original.athlete.position}</span> 
  },
  { 
    id: 'talentGraphScore',
    accessorKey: 'athlete.talentGraphScore', 
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Talent Score
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    sortingFn: 'basic',
  },
  { 
    id: 'scoutName',
    accessorKey: 'scout.name', 
    header: 'Assigned Scout' 
  },
  {
    id: 'recruitmentStage',
    accessorKey: 'connection.recruitment_stage',
    header: 'Recruitment Stage',
    cell: ({ row }) => <RecruitmentStageDropdown connection={row.original.connection} />,
  },
  {
    accessorKey: 'connection.createdAt',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date Connected
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => new Date(row.original.connection.createdAt).toLocaleDateString(),
    sortingFn: 'datetime'
  },
];


function useClubData() {
    const { user } = useUser();
    const firestore = useFirestore();

    const currentUserClubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: currentUserMemberships } = useCollection<ClubMember>(currentUserClubMemberQuery);
    const clubId = currentUserMemberships?.[0]?.clubId;

    // Direct query by clubId is much more efficient than filtering by scout list
    const connectionsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
    ), [firestore, clubId]);
    const { data: connections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

    // Still need to get scouts for the filter dropdown
    const clubScoutsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('role', '==', 'scout')) : null
    ), [firestore, clubId]);
    const { data: clubScoutMembers } = useCollection<ClubMember>(clubScoutsQuery);
    
    const scoutIds = React.useMemo(() => clubScoutMembers?.map(s => s.userId) || [], [clubScoutMembers]);

    const allScoutsInClubQuery = useMemoFirebase(() => (
        firestore && scoutIds && scoutIds.length > 0 ? query(collection(firestore, 'scouts'), where('uid', 'in', scoutIds)) : null
    ), [firestore, scoutIds]);
    const { data: allScoutsInClub } = useCollection<ScoutProfile>(allScoutsInClubQuery);


    return { clubId, connections, connectionsLoading, allScoutsInClub };
}

function useHydratedAthleteData(connections: ScoutConnection[] | null): { data: AthleteData[], isLoading: boolean } {
    const firestore = useFirestore();
    const [hydratedData, setHydratedData] = React.useState<AthleteData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const athleteIds = React.useMemo(() => [...new Set(connections?.map(c => c.athleteId) || [])], [connections]);
    const scoutIds = React.useMemo(() => [...new Set(connections?.map(c => c.scoutId) || [])], [connections]);

    const athletesQuery = useMemoFirebase(() => (
        firestore && athleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', athleteIds)) : null
    ), [firestore, athleteIds]);
    const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

    const scoutsQuery = useMemoFirebase(() => (
        firestore && scoutIds.length > 0 ? query(collection(firestore, 'scouts'), where('uid', 'in', scoutIds)) : null
    ), [firestore, scoutIds]);
    const { data: scouts } = useCollection<ScoutProfile>(scoutsQuery);

    React.useEffect(() => {
        if (connections !== null && athletes !== null && scouts !== null) {
            const athleteMap = new Map(athletes.map(a => [a.uid, a]));
            const scoutMap = new Map(scouts.map(s => [s.uid, s]));

            const data = connections.map(conn => {
                const athlete = athleteMap.get(conn.athleteId);
                const scout = scoutMap.get(conn.scoutId);
                if (athlete && scout) {
                    return { connection: conn, athlete, scout };
                }
                return null;
            }).filter(Boolean) as AthleteData[];
            
            setHydratedData(data);
            setIsLoading(false);
        } else if (connections && connections.length === 0) {
            setHydratedData([]);
            setIsLoading(false);
        } else if (connections === null) {
            setIsLoading(true);
        }
    }, [connections, athletes, scouts]);

    return { data: hydratedData, isLoading };
}


export function AthleteTable() {
    const { connections, connectionsLoading, allScoutsInClub } = useClubData();
    const { data: hydratedData, isLoading: hydrationLoading } = useHydratedAthleteData(connections);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const table = useReactTable({
        data: hydratedData,
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

    const isLoading = connectionsLoading || hydrationLoading;

    return (
    <div className="w-full">
        <div className="flex flex-wrap items-center gap-2 py-4">
            <Input
                placeholder="Filter by name..."
                value={(table.getColumn('athleteName')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('athleteName')?.setFilterValue(event.target.value)
                }
                className="max-w-sm h-9"
            />
            <Input
                placeholder="Filter by position..."
                value={(table.getColumn('position')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('position')?.setFilterValue(event.target.value)
                }
                className="w-36 h-9"
            />
            <Select
                value={(table.getColumn('scoutName')?.getFilterValue() as string) ?? ''}
                onValueChange={(value) =>
                    table.getColumn('scoutName')?.setFilterValue(value === 'all' ? '' : value)
                }
            >
                <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Filter by Scout" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Scouts</SelectItem>
                    {allScoutsInClub?.map(scout => (
                        <SelectItem key={scout.uid} value={scout.name}>{scout.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                value={(table.getColumn('recruitmentStage')?.getFilterValue() as string) ?? ''}
                onValueChange={(value) =>
                    table.getColumn('recruitmentStage')?.setFilterValue(value === 'all' ? '' : value)
                }
            >
                <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Filter by Stage" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="evaluating">Evaluating</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="offer_extended">Offer Extended</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
            </Select>
        </div>
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
                  No athletes found in your pool.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    );
}
