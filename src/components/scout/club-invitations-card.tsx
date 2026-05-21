'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import type { ClubMember } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Building2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function ClubInvitationsCard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const invitationsQuery = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(
          collection(firestore, 'club_members'),
          where('userId', '==', user.uid),
          where('status', '==', 'club_invited')
        )
      : null
  ), [firestore, user?.uid]);

  const { data: invitations, isLoading } = useCollection<ClubMember>(invitationsQuery);

  const handleAccept = async (inv: ClubMember) => {
    if (!firestore) return;
    setProcessingId(inv.id);
    try {
      await updateDoc(doc(firestore, 'club_members', inv.id), {
        status: 'active',
        acceptedAt: new Date().toISOString(),
      });

      await addDoc(collection(firestore, 'notifications', inv.clubId, 'items'), {
        type: 'staff_invitation_accepted',
        actorName: inv.displayName || 'A staff member',
        actorRole: inv.role,
        message: `${inv.displayName || 'A staff member'} accepted your club invitation to join as a ${inv.role}.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Invitation accepted', description: `You've joined ${inv.clubName} as a ${inv.role}.` });
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitations || invitations.length === 0) return null;

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
          These clubs have invited you to join. Accept or decline below.
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
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={inv.photoUrl} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {getInitials(inv.clubName || 'Club')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{inv.clubName || 'Unknown Club'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-4 px-1.5">
                      {inv.role}
                    </Badge>
                    {inv.invitedAt && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
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
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  {isProcessing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><X className="h-3.5 w-3.5 mr-1" />Decline</>
                  }
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(inv)}
                  disabled={isProcessing}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-xs"
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
