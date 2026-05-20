'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, writeBatch, deleteDoc,
  onSnapshot, orderBy, addDoc, getDoc, updateDoc,
} from 'firebase/firestore';
import type { ClubMember, PendingMember, ClubProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, UserPlus, Mail, Phone, MapPin, Shirt, Shield, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MemberRequestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  // Get this user's active club membership to find clubId
  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = memberships?.[0]?.clubId;

  // Pending scout/coach staff requests for this club
  const staffRequestsQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'pending'))
      : null
  ), [firestore, clubId]);
  const { data: staffRequests } = useCollection<ClubMember>(staffRequestsQuery);

  // Pending athlete requests from the club's subcollection
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

  // ── Athlete handlers ──────────────────────────────────────────────────────

  const handleApprove = async (member: PendingMember) => {
    if (!firestore || !clubId) return;
    setProcessingUid(member.uid);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', clubId));
      const resolvedClubName = (clubSnap.data() as ClubProfile | undefined)?.clubName || member.clubName || '';

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
        clubName: resolvedClubName,
        clubStatus: 'active',
        updatedAt: new Date().toISOString(),
      });

      batch.set(doc(firestore, 'club_members', `${member.uid}_${clubId}`), {
        userId: member.uid,
        clubId,
        clubName: resolvedClubName,
        role: 'athlete',
        status: 'active',
        joinedAt: new Date().toISOString(),
      });

      batch.delete(doc(firestore, 'clubs', clubId, 'pendingMembers', member.uid));

      await batch.commit();

      await addDoc(collection(firestore, 'notifications', member.uid, 'items'), {
        type: 'club_approved',
        actorName: resolvedClubName || 'Your Club',
        actorRole: 'club',
        message: `You've been approved and added to ${resolvedClubName || 'the club'}'s squad!`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Member approved', description: `${member.fullName} has been added to the squad.` });
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

      batch.update(doc(firestore, 'athletes', member.uid), {
        clubStatus: 'rejected',
        updatedAt: new Date().toISOString(),
      });

      batch.delete(doc(firestore, 'clubs', clubId, 'pendingMembers', member.uid));

      await batch.commit();

      await addDoc(collection(firestore, 'notifications', member.uid, 'items'), {
        type: 'club_rejected',
        actorName: member.clubName || 'Your Club',
        actorRole: 'club',
        message: `Your request to join ${member.clubName || 'the club'} was not approved at this time.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Request rejected', description: `${member.fullName}'s request has been declined.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not reject member.' });
    } finally {
      setProcessingUid(null);
    }
  };

  // ── Staff (scout/coach) handlers ──────────────────────────────────────────

  const handleApproveStaff = async (staff: ClubMember) => {
    if (!firestore || !clubId) return;
    setProcessingUid(staff.userId);
    try {
      const memberId = `${staff.userId}_${clubId}`;
      await updateDoc(doc(firestore, 'club_members', memberId), {
        status: 'active',
        approvedAt: new Date().toISOString(),
      });

      await addDoc(collection(firestore, 'notifications', staff.userId, 'items'), {
        type: 'club_staff_approved',
        title: 'Request Approved',
        body: `Your request to join the club as a ${staff.role} has been approved!`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Staff approved', description: `${staff.role} has been added to your club.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not approve staff.' });
    } finally {
      setProcessingUid(null);
    }
  };

  const handleRejectStaff = async (staff: ClubMember) => {
    if (!firestore || !clubId) return;
    setProcessingUid(staff.userId);
    try {
      const memberId = `${staff.userId}_${clubId}`;
      await deleteDoc(doc(firestore, 'club_members', memberId));

      await addDoc(collection(firestore, 'notifications', staff.userId, 'items'), {
        type: 'club_staff_rejected',
        title: 'Request Declined',
        body: `Your request to join the club as a ${staff.role} was not approved at this time.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Request declined' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not reject staff.' });
    } finally {
      setProcessingUid(null);
    }
  };

  const isLoading = isLoadingMembers || !clubId;
  const athleteCount = pendingMembers.length;
  const staffCount = staffRequests?.length ?? 0;
  const totalCount = athleteCount + staffCount;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
          Requests
          {totalCount > 0 && (
            <Badge className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5">
              {totalCount}
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage athlete and staff join requests for your club.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="athletes">
          <TabsList className="w-full">
            <TabsTrigger value="athletes" className="flex-1 gap-2">
              <Users className="w-4 h-4" />
              Athletes
              {athleteCount > 0 && (
                <Badge className="bg-primary/20 text-primary font-black text-[10px] px-1.5 h-4">
                  {athleteCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex-1 gap-2">
              <Shield className="w-4 h-4" />
              Staff
              {staffCount > 0 && (
                <Badge className="bg-primary/20 text-primary font-black text-[10px] px-1.5 h-4">
                  {staffCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Athlete Requests ── */}
          <TabsContent value="athletes" className="mt-4 space-y-4">
            {athleteCount === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-lg">No pending athlete requests</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    When an athlete selects your club during registration, they'll appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingMembers.map((member) => (
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
              ))
            )}
          </TabsContent>

          {/* ── Staff Requests ── */}
          <TabsContent value="staff" className="mt-4 space-y-4">
            {staffCount === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Shield className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-lg">No pending staff requests</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    When a scout or coach requests to join your club, they'll appear here for approval.
                  </p>
                </CardContent>
              </Card>
            ) : (
              staffRequests?.map((staff) => (
                <Card key={staff.userId} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-black capitalize">{staff.role}</CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          Requested {new Date(staff.joinedAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase tracking-widest border-amber-400 text-amber-600 bg-amber-50">
                        Pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-xs h-10"
                        onClick={() => handleApproveStaff(staff)}
                        disabled={processingUid === staff.userId}
                      >
                        {processingUid === staff.userId
                          ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          : <CheckCircle2 className="w-4 h-4 mr-2" />
                        }
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-destructive text-destructive hover:bg-destructive/10 font-black uppercase tracking-widest text-xs h-10"
                        onClick={() => handleRejectStaff(staff)}
                        disabled={processingUid === staff.userId}
                      >
                        {processingUid === staff.userId
                          ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          : <XCircle className="w-4 h-4 mr-2" />
                        }
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
