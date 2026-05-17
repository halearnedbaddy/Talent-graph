'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, writeBatch, deleteDoc,
  onSnapshot, orderBy,
} from 'firebase/firestore';
import type { ClubMember, PendingMember } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, UserPlus, Mail, Phone, MapPin, Shirt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function MemberRequestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = memberships?.[0]?.clubId;

  useEffect(() => {
    if (!firestore || !clubId) return;

    const q = query(
      collection(firestore, 'clubs', clubId, 'pendingMembers'),
      orderBy('requestedAt', 'desc')
    );

    setIsLoadingMembers(true);
    const unsub = onSnapshot(q, (snap) => {
      setPendingMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as PendingMember)));
      setIsLoadingMembers(false);
    }, () => setIsLoadingMembers(false));

    return () => unsub();
  }, [firestore, clubId]);

  const handleApprove = async (member: PendingMember) => {
    if (!firestore || !clubId) return;
    setProcessingUid(member.uid);
    try {
      const batch = writeBatch(firestore);

      batch.set(doc(firestore, 'clubs', clubId, 'squad', member.uid), {
        uid: member.uid,
        fullName: member.fullName,
        email: member.email,
        phone: member.phone || null,
        position: member.position || null,
        jerseyNumber: member.jerseyNumber || null,
        status: 'active',
        joinedAt: new Date().toISOString(),
      });

      batch.update(doc(firestore, 'users', member.uid), {
        status: 'active',
        affiliatedClubId: clubId,
        updatedAt: new Date().toISOString(),
      });

      batch.update(doc(firestore, 'athletes', member.uid), {
        affiliatedClubId: clubId,
        clubName: member.clubName || '',
        updatedAt: new Date().toISOString(),
      });

      batch.delete(doc(firestore, 'clubs', clubId, 'pendingMembers', member.uid));

      await batch.commit();

      toast({
        title: 'Member approved',
        description: `${member.fullName} has been added to the squad.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not approve member.' });
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (member: PendingMember) => {
    if (!firestore || !clubId) return;
    setProcessingUid(member.uid);
    try {
      const batch = writeBatch(firestore);

      batch.update(doc(firestore, 'users', member.uid), {
        status: 'rejected',
        updatedAt: new Date().toISOString(),
      });

      batch.delete(doc(firestore, 'clubs', clubId, 'pendingMembers', member.uid));

      await batch.commit();

      toast({
        title: 'Request rejected',
        description: `${member.fullName}'s request has been declined.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not reject request.' });
    } finally {
      setProcessingUid(null);
    }
  };

  const isLoading = isLoadingMembers || !clubId;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
          Member Requests
          {pendingMembers.length > 0 && (
            <Badge className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5">
              {pendingMembers.length}
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Athletes who registered and selected your club during onboarding.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : pendingMembers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-bold text-lg">No pending requests</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              When an athlete selects your club during registration, they'll appear here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingMembers.map((member) => (
            <Card key={member.uid} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-black truncate">{member.fullName}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Mail className="w-3.5 h-3.5" /> {member.email}
                      </span>
                      {member.phone && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3.5 h-3.5" /> {member.phone}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase tracking-widest border-amber-400 text-amber-600 bg-amber-50">
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {member.position && (
                    <div className="flex items-center gap-1.5 text-xs bg-muted/60 px-3 py-1.5 rounded-full">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold capitalize">{member.position}</span>
                    </div>
                  )}
                  {member.jerseyNumber && (
                    <div className="flex items-center gap-1.5 text-xs bg-muted/60 px-3 py-1.5 rounded-full">
                      <Shirt className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-bold">#{member.jerseyNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs bg-muted/60 px-3 py-1.5 rounded-full text-muted-foreground">
                    Requested {new Date(member.requestedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-xs h-10"
                    onClick={() => handleApprove(member)}
                    disabled={processingUid === member.uid}
                  >
                    {processingUid === member.uid
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <CheckCircle2 className="w-4 h-4 mr-2" />
                    }
                    Approve & Add to Squad
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-destructive text-destructive hover:bg-destructive/10 font-black uppercase tracking-widest text-xs h-10"
                    onClick={() => handleReject(member)}
                    disabled={processingUid === member.uid}
                  >
                    {processingUid === member.uid
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <XCircle className="w-4 h-4 mr-2" />
                    }
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
