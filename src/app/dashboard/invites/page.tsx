'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import {
  collection, query, where, doc, updateDoc, writeBatch, addDoc, getDoc,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2, ArrowLeft, UserPlus, Shield, Check, X, Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { AthleteProfile, ClubProfile } from '@/lib/types';

interface SquadInvite {
  id: string;
  athleteId: string;
  athleteName: string;
  clubId: string;
  clubName: string;
  coachId: string;
  coachName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export default function InvitesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const athleteRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null),
    [firestore, user?.uid],
  );
  const { data: profile, isLoading: profileLoading } = useDoc<AthleteProfile>(athleteRef);

  const invitesQuery = useMemoFirebase(
    () => (firestore && user?.uid
      ? query(
          collection(firestore, 'squad_invites'),
          where('athleteId', '==', user.uid),
          where('status', '==', 'pending'),
        )
      : null),
    [firestore, user?.uid],
  );
  const { data: invites, isLoading: invitesLoading } = useCollection<SquadInvite>(invitesQuery);

  const isLoading = profileLoading || invitesLoading;

  const handleAccept = async (invite: SquadInvite) => {
    if (!firestore || !user?.uid) return;
    setProcessingId(invite.id);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', invite.clubId));
      const clubData = clubSnap.data() as ClubProfile | undefined;
      const resolvedClubName = clubData?.clubName || invite.clubName;
      const athleteName = profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : invite.athleteName;

      const batch = writeBatch(firestore);

      batch.update(doc(firestore, 'squad_invites', invite.id), {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      });

      const memberDocId = `${user.uid}_${invite.clubId}`;
      batch.set(doc(firestore, 'club_members', memberDocId), {
        userId: user.uid,
        clubId: invite.clubId,
        clubName: resolvedClubName,
        role: 'athlete',
        status: 'active',
        joinedAt: new Date().toISOString(),
        invitedBy: invite.coachId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      batch.set(doc(firestore, 'clubs', invite.clubId, 'squad', user.uid), {
        uid: user.uid,
        fullName: athleteName,
        status: 'active',
        joinedAt: new Date().toISOString(),
        invitedByCoach: invite.coachName,
      });

      batch.update(doc(firestore, 'athletes', user.uid), {
        affiliatedClubId: invite.clubId,
        clubName: resolvedClubName,
        clubStatus: 'active',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await Promise.allSettled([
        addDoc(collection(firestore, 'notifications', invite.coachId, 'items'), {
          type: 'squad_invite_accepted',
          actorName: athleteName,
          actorRole: 'athlete',
          message: `${athleteName} accepted your squad invite and has joined ${resolvedClubName}.`,
          isRead: false,
          createdAt: new Date().toISOString(),
        }),
        addDoc(collection(firestore, 'notifications', user.uid, 'items'), {
          type: 'squad_invite_confirmed',
          actorName: resolvedClubName,
          actorRole: 'club',
          message: `You've successfully joined ${resolvedClubName}. Welcome to the squad!`,
          isRead: false,
          createdAt: new Date().toISOString(),
        }),
      ]);

      toast({
        title: 'Squad invite accepted!',
        description: `You've joined ${resolvedClubName}. Welcome to the squad.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Could not accept squad invite.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invite: SquadInvite) => {
    if (!firestore || !user?.uid) return;
    setProcessingId(invite.id);
    try {
      await updateDoc(doc(firestore, 'squad_invites', invite.id), {
        status: 'declined',
        declinedAt: new Date().toISOString(),
      });

      await addDoc(collection(firestore, 'notifications', user.uid, 'items'), {
        type: 'squad_invite_declined',
        actorName: invite.clubName,
        actorRole: 'club',
        message: `You declined the squad invite from ${invite.clubName}.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      toast({ title: 'Invite declined', description: `You declined the invite from ${invite.clubName}.` });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Could not decline invite.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="font-black uppercase text-[10px] tracking-wide"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <UserPlus className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Squad Invites</h1>
            <p className="text-sm text-muted-foreground">Coaches who want you on their squad</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (!invites || invites.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-black text-base uppercase tracking-tight">No pending invites</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When a coach invites you to their squad, it will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && invites && invites.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              {invites.length} pending {invites.length === 1 ? 'invite' : 'invites'}
            </p>
            {invites.map(invite => {
              const isProcessing = processingId === invite.id;
              return (
                <Card key={invite.id} className="border-green-500/30 bg-green-500/5">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className="bg-green-500/15 text-green-700 font-black text-sm">
                            {getInitials(invite.clubName || invite.coachName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base font-black truncate">
                            {invite.clubName || 'Unknown Club'}
                          </CardTitle>
                          <CardDescription className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <Shield className="h-3 w-3 text-green-600 shrink-0" />
                            <span className="font-semibold">{invite.coachName}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-black uppercase h-4 px-1.5 border-green-500/30 text-green-700"
                            >
                              Coach Invite
                            </Badge>
                            {invite.createdAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(parseISO(invite.createdAt), { addSuffix: true })}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      <span className="font-semibold text-foreground">{invite.coachName}</span> has invited you to join{' '}
                      <span className="font-semibold text-foreground">{invite.clubName || 'their squad'}</span>. Accept to become part of the squad.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDecline(invite)}
                        disabled={isProcessing}
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 font-black uppercase text-[10px] tracking-wide"
                      >
                        {isProcessing
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><X className="h-4 w-4 mr-1.5" />Decline</>
                        }
                      </Button>
                      <Button
                        onClick={() => handleAccept(invite)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px] tracking-wide"
                      >
                        {isProcessing
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Check className="h-4 w-4 mr-1.5" />Accept Invite</>
                        }
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
