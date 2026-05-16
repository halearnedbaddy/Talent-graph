'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Building, Search } from 'lucide-react';
import type { ClubProfile, ClubConversation, ClubMember } from '@/lib/types';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

export default function ClubNetworkingPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin')) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const myClubId = userMemberships?.[0]?.clubId;

    const conversationsQuery = useMemoFirebase(() => (
        firestore && myClubId ? query(collection(firestore, 'club_conversations'), where('participants', 'array-contains', myClubId), orderBy('updatedAt', 'desc')) : null
    ), [firestore, myClubId]);
    const { data: conversations, isLoading: convLoading } = useCollection<ClubConversation>(conversationsQuery);

    const allClubsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'clubs') : null), [firestore]);
    const { data: allClubs, isLoading: clubsLoading } = useCollection<ClubProfile>(allClubsQuery);

    const filteredClubs = allClubs?.filter(c => 
        c.uid !== myClubId && 
        c.clubName.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

    const handleStartConversation = async (otherClubId: string) => {
        if (!firestore || !myClubId) return;
        const convId = [myClubId, otherClubId].sort().join('_');
        const convRef = doc(firestore, 'club_conversations', convId);
        
        await setDoc(convRef, {
            participants: [myClubId, otherClubId],
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        router.push(`/club-dashboard/messages/${convId}`);
    };

    if (convLoading || clubsLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Network Chats</CardTitle>
                        <CardDescription>Private communication channel between club administrators.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {conversations && conversations.length > 0 ? (
                            conversations.map(conv => {
                                const otherId = conv.participants.find(p => p !== myClubId);
                                const otherClub = allClubs?.find(c => c.uid === otherId);
                                return (
                                    <div key={conv.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/club-dashboard/messages/${conv.id}`)}>
                                        <div className="flex items-center gap-4">
                                            <Avatar>
                                                <AvatarImage src={otherClub?.logoUrl} />
                                                <AvatarFallback>{getInitials(otherClub?.clubName || '??')}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-bold">{otherClub?.clubName || 'Unknown Club'}</p>
                                                <p className="text-sm text-muted-foreground truncate max-w-xs">{conv.lastMessage || 'No messages yet'}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm"><MessageSquare className="w-4 h-4" /></Button>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No active conversations. Start one from the directory.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Club Directory</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search clubs..." 
                                className="pl-9" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            {filteredClubs?.map(club => (
                                <div key={club.uid} className="flex items-center justify-between p-3 border rounded-md">
                                    <div className="flex items-center gap-3">
                                        <Building className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-semibold">{club.clubName}</span>
                                    </div>
                                    <Button size="xs" variant="outline" onClick={() => handleStartConversation(club.uid)}>Chat</Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}