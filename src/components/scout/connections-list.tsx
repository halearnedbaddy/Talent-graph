'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { ScoutConnection, AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare, UserSearch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

function getInitials(name: string) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0]) {
      return name.substring(0, 2).toUpperCase();
    }
    return '?';
}

function ConnectionItem({ connection }: { connection: ScoutConnection }) {
    const firestore = useFirestore();

    const athleteDocRef = useMemoFirebase(() => (firestore ? doc(firestore, 'athletes', connection.athleteId) : null), [firestore, connection.athleteId]);
    const { data: athleteProfile, isLoading: isAthleteLoading } = useDoc<AthleteProfile>(athleteDocRef);

    if (isAthleteLoading) {
        return (
            <div className="flex items-center gap-3 p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
        )
    }

    if (!athleteProfile) return null;

    const athleteName = `${athleteProfile.firstName} ${athleteProfile.lastName}`;

    return (
         <Link href={`/messages/${connection.id}`} className="block w-full text-left">
            <div className="flex items-center justify-between p-2 hover:bg-sidebar-accent rounded-lg transition-colors cursor-pointer w-full">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${athleteName}`} />
                        <AvatarFallback>{getInitials(athleteName)}</AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                        <p className="font-semibold text-sm truncate">{athleteName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{athleteProfile.username}</p>
                    </div>
                </div>
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
            </div>
         </Link>
    );
}


export function ConnectionsList({ scoutId }: { scoutId: string }) {
  const firestore = useFirestore();
  const connectionsQuery = useMemoFirebase(() => (
      firestore ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', scoutId), where('status', '==', 'accepted')) : null
    ), [firestore, scoutId]);
  const { data: connections, isLoading } = useCollection<ScoutConnection>(connectionsQuery);

  return (
    <Card className="border-sidebar-border bg-transparent shadow-none">
      <CardHeader className="p-2">
        <CardTitle className="text-base flex items-center justify-between">
            Messages
            {isLoading && connections === null && <Loader2 className="w-4 h-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {isLoading && !connections && (
             <div className="space-y-1">
                 <div className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
            </div>
        )}
        
        {!isLoading && (!connections || connections.length === 0) && (
             <div className="text-center py-4 text-muted-foreground text-sm px-2">
                <UserSearch className="mx-auto h-8 w-8 mb-2" />
                <p className="font-semibold">No Connections</p>
                <p>Athletes who accept your request will appear here.</p>
            </div>
        )}

        {!isLoading && connections && connections.length > 0 && (
            <div className="space-y-1">
                {connections.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(conn => (
                    <ConnectionItem key={conn.id} connection={conn} />
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
