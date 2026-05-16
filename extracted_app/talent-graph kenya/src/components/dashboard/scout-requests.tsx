
'use client';
import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, updateDoc, getDoc } from 'firebase/firestore';
import type { ScoutConnection, ScoutProfile, ClubProfile, AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Check, X, ShieldQuestion, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function getInitials(name: string) {
    if (!name) return 'S';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.substring(0, 2);
}


function RequestItem({ request, athleteId }: { request: ScoutConnection, athleteId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const scoutDocRef = useMemoFirebase(() => (firestore ? doc(firestore, 'scouts', request.scoutId) : null), [firestore, request.scoutId]);
    const { data: scoutProfile, isLoading: isScoutLoading } = useDoc<ScoutProfile>(scoutDocRef);

    const handleUpdate = async (status: 'accepted' | 'declined') => {
        if (!firestore || isProcessing) return;
        setIsProcessing(true);
        
        const requestDocRef = doc(firestore, 'scout_connections', request.id);
        
        try {
            await updateDoc(requestDocRef, { 
                status: status,
                updatedAt: new Date().toISOString()
            });

            if (status === 'accepted') {
                // AUTOMATED TEAM MEMBERSHIP:
                // If the scout is part of a club, link the athlete to that club
                if (request.clubId) {
                    const clubDocRef = doc(firestore, 'clubs', request.clubId);
                    const clubDoc = await getDoc(clubDocRef);
                    if (clubDoc.exists()) {
                        const clubData = clubDoc.data() as ClubProfile;
                        const athleteDocRef = doc(firestore, 'athletes', athleteId);
                        await updateDoc(athleteDocRef, {
                            affiliatedClubId: request.clubId,
                            team: clubData.clubName, // Update the display team name
                            updatedAt: new Date().toISOString()
                        });
                    }
                }

                toast({
                    title: 'Connection Accepted',
                    description: `You can now message ${scoutProfile?.name || 'the scout'}.`,
                });
            }
        } catch (error) {
             console.error("Error updating request:", error);
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'There was a problem updating the request. Please try again.',
             });
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
         <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
            <div className="flex items-center gap-4">
                <Avatar>
                    <AvatarImage src={isScoutLoading ? '' : `https://api.dicebear.com/8.x/initials/svg?seed=${scoutProfile?.name}`} />
                    <AvatarFallback>{isScoutLoading ? <Loader2 className="animate-spin" /> : scoutProfile ? getInitials(scoutProfile.name) : 'S'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">
                         {scoutProfile ? (
                            <Link href={`/scout/${scoutProfile.username}`} className="hover:underline">
                                {scoutProfile.name}
                            </Link>
                        ) : (
                            'Loading...'
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground">@{scoutProfile?.username || '...'}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</p>
                </div>
            </div>
            
            {request.status === 'pending' && (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleUpdate('declined')} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin" /> : <X className="h-4 w-4" />}
                         Decline
                    </Button>
                     <Button size="sm" className="bg-green-600 text-white hover:bg-green-600/90" onClick={() => handleUpdate('accepted')} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Check className="h-4 w-4" />}
                        Accept
                    </Button>
                </div>
            )}
             {request.status === 'accepted' && (
                <Button asChild size="sm" variant="outline">
                    <Link href={`/messages/${request.id}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                    </Link>
                </Button>
             )}
              {request.status === 'declined' && (
                 <Badge variant="destructive">Declined</Badge>
              )}
        </div>
    )
}


export function ScoutRequests({ athleteId }: { athleteId: string }) {
  const firestore = useFirestore();
  const requestsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'scout_connections'), where('athleteId', '==', athleteId)) : null), [firestore, athleteId]);
  const { data: requests, isLoading } = useCollection<ScoutConnection>(requestsQuery);

  const pendingCount = useMemo(() => {
    if (!requests) return 0;
    return requests.filter(r => r.status === 'pending').length;
  }, [requests]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <span>Scout Requests</span>
            </div>
            {pendingCount > 0 && <Badge>{pendingCount} New</Badge>}
        </CardTitle>
        <CardDescription>Requests from scouts and coaches to connect for private messaging.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>}
        
        {!isLoading && (!requests || requests.length === 0) && (
             <div className="text-center py-12 text-muted-foreground">
                <ShieldQuestion className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">No Scout Requests Yet</h3>
                <p className="mt-1 text-sm">Keep your metrics up-to-date to attract attention from scouts.</p>
            </div>
        )}

        {!isLoading && requests && requests.length > 0 && (
            <div className="space-y-2">
                {requests.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => (
                    <RequestItem key={req.id} request={req} athleteId={athleteId} />
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
