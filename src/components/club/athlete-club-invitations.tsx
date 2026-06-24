'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, addDoc, writeBatch, getDoc } from 'firebase/firestore';
import type { ClubMember, ClubProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Check, X, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { writeRelationshipAndDM, sendInAppNotification } from '@/lib/relationships';
import { formatDistanceToNow } from 'date-fns';

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
  const [respondedIds, setRespondedIds] = useState<Record<string, 'accepted' | 'declined'>>({});

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
      const clubData = clubSnap.data() as ClubProfile | undefined;
      const resolvedClubName = clubData?.clubName || inv.clubName;
      const clubAdminId = (clubData as any)?.adminUserId || inv.clubId;

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

      // Write relationship document + pre-create DM conversation
      if (firestore) {
        await writeRelationshipAndDM(
          firestore,
          { uid: athleteUid, name: athleteName, role: 'athlete' },
          { uid: clubAdminId, name: resolvedClubName, role: 'club' },
          'club_athlete',
          clubAdminId,
        );
      }

      // Notify the club admin
      await sendInAppNotification(firestore, clubAdminId, {
        type: 'invitation_accepted',
        actorName: athleteName,
        actorRole: 'athlete',
        message: `${athleteName} accepted your squad invitation and is now an official member.`,
        url: '/club-dashboard/squad',
        actionRequired: false,
      });

      setRespondedIds(prev => ({ ...prev, [inv.id]: 'accepted' }));
      toast({ title: 'Invitation accepted!', description: `You've joined ${resolvedClubName}. You can now message the club.` });
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
      await updateDoc(doc(firestore, 'club_members', inv.id), {
        status: 'declined',
        declinedAt: new Date().toISOString(),
      });

      const clubSnap = await getDoc(doc(firestore, 'clubs', inv.clubId));
      const clubData = clubSnap.data() as ClubProfile | undefined;
      const clubAdminId = (clubData as any)?.adminUserId || inv.clubId;

      await sendInAppNotification(firestore, clubAdminId, {
        type: 'invitation_declined',
        actorName: athleteName,
        actorRole: 'athlete',
        message: `${athleteName} declined your squad invitation.`,
        url: '/club-dashboard/squad',
        actionRequired: false,
      });

      setRespondedIds(prev => ({ ...prev, [inv.id]: 'declined' }));
      toast({ title: 'Invitation declined' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not decline invitation.' });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingInvitations = (invitations || []).filter(inv => !respondedIds[inv.id]);
  if (isLoading || pendingInvitations.length === 0) return null;

  return (
    <Card className="border-[#00C853]/30 bg-[#00C853]/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#00C853]" />
          <CardTitle className="text-base font-black uppercase tracking-tight text-white">Club Invitations</CardTitle>
          <Badge className="bg-[#00C853]/20 text-[#00C853] border-none font-black text-[10px] h-4 px-1.5">
            {pendingInvitations.length}
          </Badge>
        </div>
        <CardDescription className="text-[#94A3B8]">
          A club has invited you to join their squad. Accepting also opens direct messaging.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingInvitations.map(inv => {
          const isProcessing = processingId === inv.id;
          const responded = respondedIds[inv.id];
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between p-3 border border-[#1E293B] rounded-xl bg-[#111827] gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-[#00C853]" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-sm text-white truncate">{inv.clubName || 'Unknown Club'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] font-black uppercase h-4 px-1.5 border-[#1E293B] text-[#94A3B8]">
                      Player Invite
                    </Badge>
                    {inv.invitedAt && (
                      <span className="text-[10px] text-[#94A3B8]">
                        {formatDistanceToNow(new Date(inv.invitedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {responded === 'accepted' && (
                <div className="flex items-center gap-1.5 text-[#00C853] shrink-0">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-[11px] font-black uppercase">Joined</span>
                </div>
              )}
              {responded === 'declined' && (
                <span className="text-[11px] font-black uppercase text-red-400 shrink-0">Declined</span>
              )}
              {!responded && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(inv)}
                    disabled={isProcessing}
                    className="h-8 border-red-500/40 text-red-400 hover:bg-red-500/10 font-black uppercase text-[10px]"
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><X className="h-3.5 w-3.5 mr-1" />Decline</>}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(inv)}
                    disabled={isProcessing}
                    className="h-8 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase text-[10px]"
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Accept</>}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
