
'use client';

import { useMemo } from 'react';
import type { AthleteProfile, ScoutConnection } from '@/lib/types';
import { Loader2, SearchX, UserCheck, Compass } from 'lucide-react';
import { AthleteCard } from './athlete-card';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ResultsListProps {
  athletes: AthleteProfile[] | null;
  isLoading: boolean;
}

export function ResultsList({ athletes, isLoading }: ResultsListProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const scoutConnectionsQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', user.uid), where('status', '==', 'accepted')) : null
  ), [firestore, user]);
  
  const { data: myConnections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(scoutConnectionsQuery);

  const myScoutedIds = useMemo(() => new Set(myConnections?.map(c => c.athleteId) || []), [myConnections]);

  const segmentedAthletes = useMemo(() => {
    if (!athletes) return { scouted: [], others: [] };
    return {
      scouted: athletes.filter(a => myScoutedIds.has(a.uid)),
      others: athletes.filter(a => !myScoutedIds.has(a.uid)),
    };
  }, [athletes, myScoutedIds]);

  if (isLoading || connectionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!athletes || athletes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <SearchX className="mx-auto h-12 w-12" />
        <h3 className="mt-4 text-lg font-semibold">No Athletes Found</h3>
        <p className="mt-1 text-sm">No athletes match your current filter criteria.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="discovery" className="w-full">
      <TabsList className="mb-8">
        <TabsTrigger value="discovery" className="flex items-center gap-2">
          <Compass className="w-4 h-4" />
          Discovery ({segmentedAthletes.others.length})
        </TabsTrigger>
        <TabsTrigger value="my-pool" className="flex items-center gap-2">
          <UserCheck className="w-4 h-4" />
          My Scouted Athletes ({segmentedAthletes.scouted.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="discovery">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {segmentedAthletes.others.map(athlete => (
            <AthleteCard key={athlete.uid} athlete={athlete} />
          ))}
          {segmentedAthletes.others.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              No new athletes found in this category.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="my-pool">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {segmentedAthletes.scouted.map(athlete => (
            <AthleteCard key={athlete.uid} athlete={athlete} />
          ))}
          {segmentedAthletes.scouted.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
              You haven't formally scouted any athletes matching these filters yet.
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
