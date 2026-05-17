'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Building, Check, Clock, X } from 'lucide-react';
import type { ClubProfile, ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function ClubAffiliation({ currentClubId }: { currentClubId?: string }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // 1. Get clubs matching search
    const clubsQuery = useMemoFirebase(() => (
        firestore && searchQuery.length > 2 ? query(collection(firestore, 'clubs'), where('clubName', '>=', searchQuery)) : null
    ), [firestore, searchQuery]);
    const { data: clubs } = useCollection<ClubProfile>(clubsQuery);

    // 2. Get my memberships
    const myMembershipsQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: memberships } = useCollection<ClubMember>(myMembershipsQuery);

    const handleJoinRequest = async (clubId: string) => {
        if (!user || !firestore) return;
        setLoadingId(clubId);
        try {
            const memberId = `${user.uid}_${clubId}`;
            await setDoc(doc(firestore, 'club_members', memberId), {
                id: memberId,
                userId: user.uid,
                clubId: clubId,
                role: 'scout',
                status: 'pending',
                joinedAt: new Date().toISOString()
            });
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
            toast({ title: 'Request Cancelled', description: 'Your join request has been withdrawn.' });
        } catch (e: any) {
            console.error('[ClubAffiliation] cancel error:', e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel request. Please try again.' });
        } finally {
            setLoadingId(null);
        }
    };

    const myMembershipMap = new Map(memberships?.map(m => [m.clubId, m]));

    return (
        <Card className="border-none shadow-sm bg-background">
            <CardHeader>
                <CardTitle className="text-lg font-bold">Institutional Affiliation</CardTitle>
                <CardDescription>Connect with a club to access their squad data and internal network.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                                ) : status === 'pending' ? (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-orange-500 border-orange-200 font-black text-[10px] h-7 px-3">
                                            <Clock className="w-3 h-3 mr-1" /> PENDING
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleCancelRequest(club.uid)}
                                            disabled={isLoading}
                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                            title="Cancel request"
                                        >
                                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                        </Button>
                                    </div>
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
            </CardContent>
        </Card>
    );
}
