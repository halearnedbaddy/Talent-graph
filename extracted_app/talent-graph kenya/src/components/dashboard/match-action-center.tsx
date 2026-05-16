'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { MatchInvitation, AthleteProfile, MatchEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, ClipboardList, Check, X, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Link from 'next/link';

export function MatchActionCenter({ athleteProfile }: { athleteProfile: AthleteProfile }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    // 1. Fetch Match Invitations
    const invitesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'match_invitations'), where('athleteId', '==', athleteProfile.uid), where('status', '==', 'pending')) : null
    ), [firestore, athleteProfile.uid]);
    const { data: invites, isLoading: invitesLoading } = useCollection<MatchInvitation>(invitesQuery);

    // 2. Fetch matches from history that need stats (statsLogged: false)
    const pendingStats = athleteProfile.matchHistory?.filter(m => m.statsLogged === false) || [];

    const handleInviteAction = async (invite: MatchInvitation, action: 'confirmed' | 'declined') => {
        if (!firestore) return;
        try {
            const inviteRef = doc(firestore, 'match_invitations', invite.id);
            if (action === 'declined') {
                await deleteDoc(inviteRef);
                toast({ title: 'Invitation Declined', description: 'Institutional fixture ignored.' });
                return;
            }

            // If confirmed, add to athlete's match history as a "Pending Stats" entry
            const athleteRef = doc(firestore, 'athletes', athleteProfile.uid);
            const newMatchEntry: MatchEntry = {
                id: invite.matchId, // Use the club's match ID to link them
                competition: invite.matchData.competition,
                apps: 1,
                minutes: 0,
                rating: 0,
                goals: 0,
                assists: 0,
                shots: 0,
                duelsWon: 0,
                fouls: 0,
                saves: 0,
                yellowCards: 0,
                redCards: 0,
                isVerified: false,
                updatedAt: new Date().toISOString(),
                clubMatchId: invite.matchId,
                statsLogged: false
            };

            const updatedHistory = [...(athleteProfile.matchHistory || []), newMatchEntry];
            await updateDoc(athleteRef, { matchHistory: updatedHistory });
            await deleteDoc(inviteRef); // Clear the invitation

            toast({ title: 'Attendance Confirmed', description: 'Match added to your pending stats list.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to process invitation.' });
        }
    };

    if (invitesLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>;

    if (!invites?.length && !pendingStats.length) return null;

    return (
        <Card className="border-primary/20 shadow-lg bg-background overflow-hidden">
            <CardHeader className="bg-primary/5 p-6">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" /> Action Center
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Institutional Match Hub</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y">
                {/* Invitations */}
                {invites?.map(invite => (
                    <div key={invite.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Match Invite &bull; {invite.matchData.competition}</p>
                                <h4 className="text-sm font-black uppercase">vs {invite.matchData.opponent}</h4>
                                <p className="text-[9px] font-bold text-muted-foreground mt-0.5">{format(new Date(invite.matchData.date), 'PPP')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-9 px-4 text-muted-foreground hover:text-destructive" onClick={() => handleInviteAction(invite, 'declined')}>
                                <X className="w-4 h-4 mr-2" /> Decline
                            </Button>
                            <Button size="sm" className="h-9 px-6 font-black uppercase tracking-widest text-[10px]" onClick={() => handleInviteAction(invite, 'confirmed')}>
                                <Check className="w-4 h-4 mr-2" /> Confirm Attendance
                            </Button>
                        </div>
                    </div>
                ))}

                {/* Pending Stats Updates */}
                {pendingStats.map(match => (
                    <div key={match.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-orange-50/10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                <ClipboardList className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-orange-600">Post-Match Action Required</p>
                                <h4 className="text-sm font-black uppercase">Log Stats: {match.competition}</h4>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Finalize your performance data to update your CSI score.</p>
                            </div>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-9 px-6 font-black uppercase tracking-widest text-[10px] border-orange-200 text-orange-700 hover:bg-orange-50">
                            <Link href={`/dashboard/add-match?id=${match.id}`}>
                                Log Stats <ArrowRight className="w-3.5 h-3.5 ml-2" />
                            </Link>
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}