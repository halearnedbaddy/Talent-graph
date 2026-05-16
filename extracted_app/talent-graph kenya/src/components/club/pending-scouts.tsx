'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { ClubMember, ScoutProfile } from '@/lib/types';
import { Loader2, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export function PendingScouts() {
    const { user } = useUser();
    const firestore = useFirestore();

    // 1. Get current user's club ID
    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin')) : null
    ), [firestore, user]);
    const { data: currentUserMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = currentUserMemberships?.[0]?.clubId;

    // 2. Get pending members for this club
    const pendingMembersQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'pending')) : null
    ), [firestore, clubId]);
    const { data: pendingMembers, isLoading: membersLoading } = useCollection<ClubMember>(pendingMembersQuery);

    const pendingUserIds = React.useMemo(() => pendingMembers?.map(m => m.userId) || [], [pendingMembers]);

    // 3. Get profiles for these pending users
    const profilesQuery = useMemoFirebase(() => (
        firestore && pendingUserIds.length > 0 ? query(collection(firestore, 'scouts'), where('uid', 'in', pendingUserIds)) : null
    ), [firestore, pendingUserIds]);
    const { data: profiles, isLoading: profilesLoading } = useCollection<ScoutProfile>(profilesQuery);

    const handleApprove = (membershipId: string) => {
        if (!firestore) return;
        const memberRef = doc(firestore, 'club_members', membershipId);
        // Non-blocking update: UI will update immediately via useCollection listener
        updateDocumentNonBlocking(memberRef, { status: 'active' });
    };

    const handleDecline = (membershipId: string) => {
        if (!firestore) return;
        const memberRef = doc(firestore, 'club_members', membershipId);
        // Non-blocking delete: UI will update immediately via useCollection listener
        deleteDocumentNonBlocking(memberRef);
    };

    if (membersLoading || (pendingUserIds.length > 0 && profilesLoading)) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (!pendingMembers || pendingMembers.length === 0) {
        return null;
    }

    const profileMap = new Map(profiles?.map(p => [p.uid, p]));

    return (
        <Card className="mb-8 border-yellow-500/20 bg-yellow-50/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    Pending Join Requests
                </CardTitle>
                <CardDescription>
                    These scouts have requested to join your organization. Review them below.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {pendingMembers.map((member) => {
                    const profile = profileMap.get(member.userId);
                    if (!profile) return null;

                    return (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg bg-background">
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${profile.name}`} />
                                    <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{profile.name}</p>
                                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleDecline(member.id)}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Decline
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={() => handleApprove(member.id)}
                                >
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
