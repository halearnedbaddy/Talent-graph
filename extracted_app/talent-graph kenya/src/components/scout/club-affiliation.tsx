'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Building, Check, Clock } from 'lucide-react';
import type { ClubProfile, ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export function ClubAffiliation({ currentClubId }: { currentClubId?: string }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [requestingId, setRequestingId] = useState<string | null>(null);

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
        setRequestingId(clubId);
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
            toast({ title: 'Request Sent', description: 'Institutional administrators have been notified.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to send join request.' });
        } finally {
            setRequestingId(null);
        }
    };

    const myMembershipMap = new Map(memberships?.map(m => [m.clubId, m.status]));

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
                        const status = myMembershipMap.get(club.uid);
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
                                    <Badge variant="outline" className="text-orange-500 border-orange-200 font-black text-[10px] h-7 px-3">
                                        <Clock className="w-3 h-3 mr-1" /> PENDING
                                    </Badge>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleJoinRequest(club.uid)}
                                        disabled={requestingId === club.uid}
                                        className="font-black text-[10px] uppercase tracking-widest h-8"
                                    >
                                        {requestingId === club.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Join Club'}
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                    {searchQuery.length > 2 && clubs?.length === 0 && (
                        <p className="text-center py-8 text-sm text-muted-foreground">No clubs found matching "{searchQuery}"</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}