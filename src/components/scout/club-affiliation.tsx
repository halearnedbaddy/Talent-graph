'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, deleteDoc, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Building, Check, Clock, X, AlertCircle } from 'lucide-react';
import type { ClubProfile, ClubMember, UserAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function ClubAffiliation({ currentClubId }: { currentClubId?: string }) {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
    const { data: userAccount } = useDoc<UserAccount>(userDocRef);
    const memberRole: 'scout' | 'coach' = userAccount?.role === 'coach' ? 'coach' : 'scout';
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // 1. Get clubs matching search (prefix search: >= query and <= query + '\uf8ff')
    const clubsQuery = useMemoFirebase(() => (
        firestore && searchQuery.length > 2
            ? query(
                collection(firestore, 'clubs'),
                where('clubName', '>=', searchQuery),
                where('clubName', '<=', searchQuery + '\uf8ff')
              )
            : null
    ), [firestore, searchQuery]);
    const { data: clubs } = useCollection<ClubProfile>(clubsQuery);

    // 2. Get ALL my memberships (so we can detect pending even without searching)
    const myMembershipsQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: memberships } = useCollection<ClubMember>(myMembershipsQuery);

    // 3. Find any pending membership so we can show a banner
    const pendingMembership = memberships?.find(m => m.status === 'pending') ?? null;
    const hasPending = !!pendingMembership;

    // 4. Fetch the pending club's profile to display its name
    const pendingClubRef = useMemoFirebase(() => (
        firestore && pendingMembership?.clubId ? doc(firestore, 'clubs', pendingMembership.clubId) : null
    ), [firestore, pendingMembership?.clubId]);
    const { data: pendingClub } = useDoc<ClubProfile>(pendingClubRef);

    const myMembershipMap = new Map(memberships?.map(m => [m.clubId, m]));

    const handleJoinRequest = async (clubId: string) => {
        if (!user || !firestore) return;
        if (hasPending) {
            toast({ variant: 'destructive', title: 'Request already pending', description: 'Cancel your current request before joining a different club.' });
            return;
        }
        setLoadingId(clubId);
        try {
            const memberId = `${user.uid}_${clubId}`;
            await setDoc(doc(firestore, 'club_members', memberId), {
                id: memberId,
                userId: user.uid,
                clubId: clubId,
                role: memberRole,
                status: 'pending',
                joinedAt: new Date().toISOString()
            });

            // Notify the club admin of the new request
            try {
                const [adminSnap, scoutSnap] = await Promise.all([
                    getDocs(query(
                        collection(firestore, 'club_members'),
                        where('clubId', '==', clubId),
                        where('role', '==', 'admin'),
                        where('status', '==', 'active')
                    )),
                    getDoc(doc(firestore, 'scouts', user.uid)),
                ]);

                if (!adminSnap.empty) {
                    const adminUserId = adminSnap.docs[0].data().userId as string;
                    const scoutName: string = scoutSnap.exists()
                        ? (scoutSnap.data().name ?? 'A scout')
                        : 'A scout';
                    const scoutUsername: string = scoutSnap.exists() && scoutSnap.data().username
                        ? ` (@${scoutSnap.data().username})`
                        : '';
                    const roleLabel = memberRole === 'coach' ? 'coach' : 'scout';

                    await addDoc(collection(firestore, 'notifications', adminUserId, 'items'), {
                        type: 'scout_join_request',
                        title: 'New Staff Request',
                        body: `${scoutName}${scoutUsername} has requested to join your club as a ${roleLabel}.`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    });
                }
            } catch (notifErr) {
                console.warn('[ClubAffiliation] admin notification failed:', notifErr);
            }

            toast({ title: 'Request Sent', description: 'Club administrators have been notified of your request.' });
        } catch (e: any) {
            console.error('[ClubAffiliation] join error:', e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to send join request. Please try again.' });
        } finally {
            setLoadingId(null);
        }
    };

    const handleCancelRequest = async (clubId: string) => {
        if (!user || !firestore) return;
        setLoadingId(clubId);
        try {
            const memberId = `${user.uid}_${clubId}`;
            await deleteDoc(doc(firestore, 'club_members', memberId));

            // Notify the club admin that the scout withdrew their request
            try {
                const [adminSnap, scoutSnap] = await Promise.all([
                    getDocs(query(
                        collection(firestore, 'club_members'),
                        where('clubId', '==', clubId),
                        where('role', '==', 'admin')
                    )),
                    getDoc(doc(firestore, 'scouts', user.uid)),
                ]);

                if (!adminSnap.empty) {
                    const adminUserId = adminSnap.docs[0].data().userId as string;
                    const scoutName: string = scoutSnap.exists()
                        ? (scoutSnap.data().name ?? 'A scout')
                        : 'A scout';
                    const scoutUsername: string = scoutSnap.exists()
                        ? (scoutSnap.data().username ? ` (@${scoutSnap.data().username})` : '')
                        : '';

                    await addDoc(collection(firestore, 'notifications', adminUserId, 'items'), {
                        type: 'scout_request_cancelled',
                        title: 'Join Request Withdrawn',
                        body: `${scoutName}${scoutUsername} has withdrawn their request to join your club. The slot is now available.`,
                        isRead: false,
                        createdAt: new Date().toISOString(),
                    });
                }
            } catch (notifErr) {
                console.warn('[ClubAffiliation] admin notification failed:', notifErr);
            }

            toast({ title: 'Request Cancelled', description: 'Your join request has been withdrawn.' });
        } catch (e: any) {
            console.error('[ClubAffiliation] cancel error:', e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel request. Please try again.' });
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <Card className="border-none shadow-sm bg-background">
            <CardHeader>
                <CardTitle className="text-lg font-bold">Institutional Affiliation</CardTitle>
                <CardDescription>Connect with a club to access their squad data and internal network.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

                {/* Pending Request Banner — always visible regardless of search */}
                {pendingMembership && (
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-800/40">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-orange-700 dark:text-orange-400">Request Pending</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    You applied to join{' '}
                                    <span className="font-bold text-foreground">
                                        {pendingClub?.clubName ?? 'a club'}
                                    </span>
                                    . Cancel to request a different club.
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelRequest(pendingMembership.clubId)}
                            disabled={loadingId === pendingMembership.clubId}
                            className="shrink-0 h-8 border-orange-300 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-700 dark:text-orange-400"
                        >
                            {loadingId === pendingMembership.clubId
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><X className="w-3 h-3 mr-1" />Cancel</>
                            }
                        </Button>
                    </div>
                )}

                {/* Block searching for another club while one is pending */}
                {hasPending ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Cancel your current request above before searching for a different club.
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search for an organization..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            {clubs?.filter(c => c.uid !== currentClubId).map(club => {
                                const membership = myMembershipMap.get(club.uid);
                                const status = membership?.status;
                                const isLoading = loadingId === club.uid;

                                return (
                                    <div key={club.uid} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                <Building className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-bold">{club.clubName}</p>
                                                <p className="text-xs text-muted-foreground">{club.location}</p>
                                            </div>
                                        </div>

                                        {status === 'active' ? (
                                            <Badge className="bg-green-500/10 text-green-600 border-none font-black text-[10px] h-7 px-3">
                                                <Check className="w-3 h-3 mr-1" /> ACTIVE
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleJoinRequest(club.uid)}
                                                disabled={isLoading}
                                                className="font-black text-[10px] uppercase tracking-widest h-8"
                                            >
                                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Join Club'}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            {searchQuery.length > 2 && clubs?.length === 0 && (
                                <p className="text-center py-8 text-sm text-muted-foreground">No clubs found matching "{searchQuery}"</p>
                            )}
                            {searchQuery.length > 0 && searchQuery.length <= 2 && (
                                <p className="text-center py-4 text-xs text-muted-foreground">Type at least 3 characters to search</p>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
