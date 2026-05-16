'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Mail, Users } from 'lucide-react';
import { format } from 'date-fns';
import { WaitingListEntry } from '@/lib/types';

export function WaitingListViewer() {
  const firestore = useFirestore();

  const waitingListQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'waiting_list'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);

  const { data: entries, isLoading } = useCollection<WaitingListEntry>(waitingListQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          Expansion Waitlist
        </CardTitle>
        <CardDescription>Users who signed up for sports not yet fully integrated into Talent Graph.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Primary Sport</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : entries?.length ? (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{format(new Date(entry.createdAt), 'PPP')}</TableCell>
                  <TableCell className="font-bold">{entry.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {entry.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[10px] font-black tracking-widest">
                        {entry.primarySport}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.position || 'N/A'} • {entry.age}yrs
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">The waiting list is empty.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}