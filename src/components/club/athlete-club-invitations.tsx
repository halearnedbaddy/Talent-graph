'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, addDoc, writeBatch, getDoc } from 'firebase/firestore';
import type { ClubMember, ClubProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Building2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  athleteUid: string;
  athleteName: string;
  onAccepted?: () => void;
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function AthleteClubInvitations({ athleteUid, athleteName, onAccepted }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const invitationsQuery = useMemoFirebase(() => (
    firestore && athleteUid
      ? query(
          collection(firestore, 'club_members'),
          where('userId', '==', athleteUid),
          where('status', '==', 'club_invited')
        )
      : null
  ), [firestore, athleteUid]);

  const { data: invitations, isLoading } = useCollection<ClubMember>(invitationsQuery);

  const handleAccept = async (inv: ClubMember) => {
    if (!firestore) return;
    setProcessingId(inv.id);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', inv.clubId));
      const resolvedClubName = (clubSnap.data() as ClubProfile | undefined)?.clubName || inv.clubName;

      const batch = writeBatch(firestore);

      batch.update(doc(firestore, 'club_members', inv.id), {
        status: 'active',
        acceptedAt: new Date().toISOString(),
      });

      batch.set(doc(firestore, 'clubs', inv.clubId, 'squad', athleteUid), {
        uid: athleteUid,
        fullName: athleteName,
        status: 'active',
        joinedAt: new Date().toISOString(),
      });

      batch.update(doc(firestore, 'athletes', athleteUid), {
        affiliatedClubId: inv.clubId,
        clubName: resolvedClubName,
        clubStatus: 'active',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await addDoc(collection(firestore, 'notifications', inv.clubId, 'items'), {
        type: 'athlete_invitation_accepted',
        actorName: athleteName,
        actorRole: 'athlete',
        message: `${athleteName} accepted your squad invitation and is now an official member.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Invitation accepted!', description: `You've joined ${resolvedClubName}.` });
      onAccepted?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not accept invitation.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (inv: ClubMember) => {
    if (!firestore) return;
    setProcessingId(inv.id);
    try {
      await deleteDoc(doc(firestore, 'club_members', inv.id));
      toast({ title: 'Invitation declined' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not decline invitation.' });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading || !invitations || invitations.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-black uppercase tracking-tight">Club Invitations</CardTitle>
          <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] h-4 px-1.5">
            {invitations.length}
          </Badge>
        </div>
        <CardDescription>
          A club has invited you to join their squad. Accept or decline below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map(inv => {
          const isProcessing = processingId === inv.id;
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-background gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-sm truncate">{inv.clubName || 'Unknown Club'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[9px] font-black uppercase h-4 px-1.5">
                      Player Invite
                    </Badge>
                    {inv.invitedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(inv.invitedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(inv)}
                  disabled={isProcessing}
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 font-black uppercase text-[10px]"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><X className="h-3.5 w-3.5 mr-1" />Decline</>}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(inv)}
                  disabled={isProcessing}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px]"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Accept</>}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
