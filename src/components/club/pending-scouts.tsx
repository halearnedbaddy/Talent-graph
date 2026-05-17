'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, addDoc } from 'firebase/firestore';
import type { ClubMember, ScoutProfile } from '@/lib/types';
import { Loader2, Check, X, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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
    const [processingId, setProcessingId] = React.useState<string | null>(null);

    // 1. Get current user's club ID (must be admin role)
    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin')) : null
    ), [firestore, user]);
    const { data: currentUserMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = currentUserMemberships?.[0]?.clubId;

    // 2. Get pending scout join requests for this club
    const pendingMembersQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'pending'), where('role', '==', 'scout')) : null
    ), [firestore, clubId]);
    const { data: pendingMembers, isLoading: membersLoading } = useCollection<ClubMember>(pendingMembersQuery);

    const pendingUserIds = React.useMemo(() => pendingMembers?.map(m => m.userId) || [], [pendingMembers]);

    // 3. Fetch scout profiles for these pending users
    const profilesQuery = useMemoFirebase(() => (
        firestore && pendingUserIds.length > 0 ? query(collection(firestore, 'scouts'), where('uid', 'in', pendingUserIds)) : null
    ), [firestore, pendingUserIds]);
    const { data: profiles, isLoading: profilesLoading } = useCollection<ScoutProfile>(profilesQuery);

    const sendNotification = async (toUserId: string, title: string, body: string) => {
        if (!firestore) return;
        try {
            await addDoc(collection(firestore, 'notifications', toUserId, 'items'), {
                type: 'club_join_response',
                title,
                body,
                isRead: false,
                createdAt: new Date().toISOString(),
            });
        } catch (e) {
            console.error('[PendingScouts] notification error:', e);
        }
    };

    const handleApprove = async (member: ClubMember) => {
        if (!firestore) return;
        setProcessingId(member.id);
        try {
            const memberRef = doc(firestore, 'club_members', member.id);
            updateDocumentNonBlocking(memberRef, { status: 'active' });
            await sendNotification(
                member.userId,
                'Join Request Approved',
                'Your request to join the club has been approved. You now have access to squad data and the internal network.'
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleDecline = async (member: ClubMember) => {
        if (!firestore) return;
        setProcessingId(member.id);
        try {
            const memberRef = doc(firestore, 'club_members', member.id);
            deleteDocumentNonBlocking(memberRef);
            await sendNotification(
                member.userId,
                'Join Request Declined',
                'Your request to join the club has been reviewed and was not approved at this time.'
            );
        } finally {
            setProcessingId(null);
        }
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-yellow-500" />
                        <CardTitle>Pending Join Requests</CardTitle>
                        <Badge className="bg-yellow-500/20 text-yellow-600 border-none font-black text-[10px] h-5 px-2">
                            {pendingMembers.length}
                        </Badge>
                    </div>
                </div>
                <CardDescription>
                    These scouts have requested to join your organization. Review and approve or decline each request.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {pendingMembers.map((member) => {
                    const profile = profileMap.get(member.userId);
                    const isProcessing = processingId === member.id;

                    return (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg bg-background gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                                <Avatar className="shrink-0">
                                    <AvatarImage src={profile?.photoUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${profile?.name}`} />
                                    <AvatarFallback>{getInitials(profile?.name || '??')}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold truncate">
                                            {profile?.name || 'Unknown Scout'}
                                        </p>
                                        {profile?.isVerified && (
                                            <Badge className="bg-green-500/10 text-green-600 border-none font-black text-[9px] h-4 px-1.5 shrink-0">
                                                VERIFIED
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {profile?.username && (
                                            <p className="text-sm text-muted-foreground">@{profile.username}</p>
                                        )}
                                        {profile?.sports && profile.sports.length > 0 && (
                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                                • {profile.sports.slice(0, 2).join(', ')}
                                            </span>
                                        )}
                                        {profile?.entityType && (
                                            <Badge variant="outline" className="font-bold text-[9px] h-4 px-1.5 shrink-0">
                                                {profile.entityType === 'organization' ? 'Org' : 'Individual'}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest font-bold">
                                        Requested {new Date(member.joinedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {profile && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-muted-foreground"
                                        title="View scout profile"
                                        onClick={() => window.open(`/scout-dashboard/profile?uid=${profile.uid}`, '_blank')}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDecline(member)}
                                    disabled={isProcessing}
                                    className="h-8"
                                >
                                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><X className="h-3.5 w-3.5 mr-1" />Decline</>}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleApprove(member)}
                                    disabled={isProcessing}
                                    className="h-8"
                                >
                                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Approve</>}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
