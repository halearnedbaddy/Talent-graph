'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, updateDoc, writeBatch, addDoc, getDoc,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Shield, Check, X, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { ClubProfile } from '@/lib/types';

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

interface Props {
  athleteUid: string;
  athleteName: string;
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function SquadInviteCard({ athleteUid, athleteName }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const invitesQuery = useMemoFirebase(() => (
    firestore && athleteUid
      ? query(
          collection(firestore, 'squad_invites'),
          where('athleteId', '==', athleteUid),
          where('status', '==', 'pending'),
        )
      : null
  ), [firestore, athleteUid]);

  const { data: invites, isLoading } = useCollection<SquadInvite>(invitesQuery);

  const handleAccept = async (invite: SquadInvite) => {
    if (!firestore) return;
    setProcessingId(invite.id);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', invite.clubId));
      const clubData = clubSnap.data() as ClubProfile | undefined;
      const resolvedClubName = clubData?.clubName || invite.clubName;

      const batch = writeBatch(firestore);

      // Mark invite as accepted
      batch.update(doc(firestore, 'squad_invites', invite.id), {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      });

      // Create active club_members record
      const memberDocId = `${athleteUid}_${invite.clubId}`;
      batch.set(doc(firestore, 'club_members', memberDocId), {
        userId: athleteUid,
        clubId: invite.clubId,
        clubName: resolvedClubName,
        role: 'athlete',
        status: 'active',
        joinedAt: new Date().toISOString(),
        invitedBy: invite.coachId,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // Add to club squad subcollection
      batch.set(doc(firestore, 'clubs', invite.clubId, 'squad', athleteUid), {
        uid: athleteUid,
        fullName: athleteName,
        status: 'active',
        joinedAt: new Date().toISOString(),
        invitedByCoach: invite.coachName,
      });

      // Update athlete profile with club affiliation
      batch.update(doc(firestore, 'athletes', athleteUid), {
        affiliatedClubId: invite.clubId,
        clubName: resolvedClubName,
        clubStatus: 'active',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      // Notify the coach
      await addDoc(collection(firestore, 'notifications', invite.coachId, 'items'), {
        type: 'squad_invite_accepted',
        actorName: athleteName,
        actorRole: 'athlete',
        message: `${athleteName} accepted your squad invite and has joined ${resolvedClubName}.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      }).catch(() => {});

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
    if (!firestore) return;
    setProcessingId(invite.id);
    try {
      await updateDoc(doc(firestore, 'squad_invites', invite.id), {
        status: 'declined',
        declinedAt: new Date().toISOString(),
      });
      toast({ title: 'Invite declined' });
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

  if (isLoading || !invites || invites.length === 0) return null;

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-green-600" />
          <CardTitle className="text-base font-black uppercase tracking-tight">
            Squad Invites
          </CardTitle>
          <Badge className="bg-green-600/20 text-green-700 border-none font-black text-[10px] h-4 px-1.5">
            {invites.length}
          </Badge>
        </div>
        <CardDescription>
          A coach has invited you to join their squad. Accept or decline below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map(invite => {
          const isProcessing = processingId === invite.id;
          return (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 border border-green-500/20 rounded-lg bg-background gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-green-500/10 text-green-700 font-black text-xs">
                    {getInitials(invite.coachName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-black text-sm truncate">{invite.clubName || 'Unknown Club'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-green-600" />
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {invite.coachName}
                      </span>
                    </div>
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
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(invite)}
                  disabled={isProcessing}
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 font-black uppercase text-[10px]"
                >
                  {isProcessing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><X className="h-3.5 w-3.5 mr-1" />Decline</>
                  }
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(invite)}
                  disabled={isProcessing}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px]"
                >
                  {isProcessing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Check className="h-3.5 w-3.5 mr-1" />Accept</>
                  }
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
