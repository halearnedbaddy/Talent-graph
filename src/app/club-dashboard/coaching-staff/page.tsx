'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Loader2, UserPlus, Shield, Trash2, CheckCircle2, Clock,
  Users, ChevronDown, Search, UserX, Trophy, Dumbbell,
} from 'lucide-react';
import type { ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InviteStaffDialog } from '@/components/club/invite-staff-dialog';
import { AddStaffDirectDialog } from '@/components/club/add-staff-direct-dialog';
import { InviteLinkDialog } from '@/components/club/invite-link-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Club Admin',
  coach: 'Head Coach',
  assistant_coach: 'Assistant Coach',
  analyst: 'Performance Analyst',
  gk_coach: 'GK Coach',
  scout: 'Scout',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/30',
  coach: 'bg-green-500/10 text-green-600 border-green-200',
  assistant_coach: 'bg-blue-500/10 text-blue-600 border-blue-200',
  analyst: 'bg-purple-500/10 text-purple-600 border-purple-200',
  gk_coach: 'bg-amber-500/10 text-amber-600 border-amber-200',
  scout: 'bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30',
};

const STAFF_ROLES = ['coach', 'assistant_coach', 'analyst', 'gk_coach'];

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function CoachingStaffPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [clubId, setClubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addDirectOpen, setAddDirectOpen] = useState(false);
  const [clubName, setClubName] = useState('');

  const myMembershipQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: myMemberships } = useCollection<ClubMember>(myMembershipQuery);

  useEffect(() => {
    if (myMemberships?.[0]?.clubId) {
      setClubId(myMemberships[0].clubId);
      setClubName(myMemberships[0].clubName || '');
    }
  }, [myMemberships]);

  const allMembersQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: allMembers, isLoading } = useCollection<ClubMember>(allMembersQuery);

  const staff = (allMembers || []).filter(m =>
    STAFF_ROLES.includes(m.role) || m.role === 'admin'
  ).filter(m =>
    !searchQuery || (m.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pending = (allMembers || []).filter(m => m.status === 'pending' && STAFF_ROLES.includes(m.role));
  const invited = (allMembers || []).filter(m => m.status === 'club_invited');

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!firestore || !clubId) return;
    setUpdatingId(memberId);
    try {
      await updateDoc(doc(firestore, 'club_members', memberId), { role: newRole });
      toast({ title: 'Role updated', description: 'Staff member role has been changed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update role.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = async (memberId: string) => {
    if (!firestore) return;
    setUpdatingId(memberId);
    try {
      const member = allMembers?.find(m => m.id === memberId);
      await updateDoc(doc(firestore, 'club_members', memberId), {
        status: 'active',
        joinedAt: new Date().toISOString(),
      });
      if (member?.userId) {
        try {
          await addDoc(collection(firestore, 'notifications', member.userId, 'items'), {
            type: 'club_approved',
            title: 'Club Application Approved',
            body: `Your application to join ${clubName || 'the club'} has been approved. You now have full access to the coach dashboard.`,
            clubId,
            clubName: clubName || '',
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        } catch { }
      }
      toast({ title: 'Staff approved', description: 'They now have access to the club dashboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (memberId: string) => {
    if (!firestore) return;
    try {
      const member = allMembers?.find(m => m.id === memberId);
      await updateDoc(doc(firestore, 'club_members', memberId), { status: 'rejected' });
      if (member?.userId) {
        try {
          await addDoc(collection(firestore, 'notifications', member.userId, 'items'), {
            type: 'club_rejected',
            title: 'Club Application Declined',
            body: `Your application to join ${clubName || 'the club'} was not approved. Please contact the club admin for more information.`,
            clubId,
            clubName: clubName || '',
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        } catch { }
      }
      toast({ title: 'Request rejected.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reject.' });
    }
  };

  const handleRemove = async () => {
    if (!firestore || !removeMemberId) return;
    setIsRemoving(true);
    try {
      await deleteDoc(doc(firestore, 'club_members', removeMemberId));
      toast({ title: 'Staff member removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove.' });
    } finally {
      setIsRemoving(false);
      setRemoveMemberId(null);
    }
  };

  const stats = {
    total: staff.filter(m => m.status === 'active').length,
    coaches: staff.filter(m => ['coach', 'assistant_coach', 'gk_coach'].includes(m.role) && m.status === 'active').length,
    analysts: staff.filter(m => m.role === 'analyst' && m.status === 'active').length,
    pending: pending.length,
  };

  if (!clubId || isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Coaching Staff</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Manage coaches, analysts and technical staff
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setAddDirectOpen(true)}
            className="bg-primary hover:bg-primary/90 font-black text-xs uppercase gap-2 h-9"
          >
            <UserPlus className="h-4 w-4" /> Add Directly
          </Button>
          <InviteStaffDialog clubId={clubId} clubName={clubName} />
          <InviteLinkDialog clubId={clubId} clubName={clubName} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: stats.total, icon: Users, color: 'text-foreground' },
          { label: 'Coaches', value: stats.coaches, icon: Trophy, color: 'text-green-600' },
          { label: 'Analysts', value: stats.analysts, icon: Dumbbell, color: 'text-purple-600' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-500' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-amber-500/5 border-b border-amber-200/30 py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Staff Requests
              <Badge className="bg-amber-500 text-white font-black text-[10px] ml-1">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 rounded-xl shrink-0">
                    <AvatarImage src={m.photoUrl} />
                    <AvatarFallback className="rounded-xl bg-muted font-black text-xs">{getInitials(m.displayName || '')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-black text-sm truncate">{m.displayName || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{ROLE_LABELS[m.role] || m.role}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-9 min-h-[44px] font-black bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                    onClick={() => handleApprove(m.id)}
                    disabled={updatingId === m.id}
                  >
                    {updatingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 min-h-[44px] font-black text-destructive border-destructive/30 hover:bg-destructive/5 gap-1 text-xs"
                    onClick={() => handleReject(m.id)}
                  >
                    <UserX className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invited (outgoing) */}
      {invited.length > 0 && (
        <Card className="border-none shadow-sm bg-background overflow-hidden">
          <CardHeader className="bg-muted/40 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Sent Invitations
              <Badge variant="secondary" className="font-black text-[10px] ml-1">{invited.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {invited.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm truncate">{m.displayName || 'Pending acceptance'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{ROLE_LABELS[m.role] || m.role} · Awaiting response</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-black text-[9px] shrink-0">Invited</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Staff */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Active Staff
            </CardTitle>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff..."
                className="h-9 pl-8 font-bold text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {staff.filter(m => m.status === 'active').length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-black text-muted-foreground uppercase tracking-widest text-sm">No staff yet</p>
              <p className="text-xs text-muted-foreground mt-1">Invite coaches and analysts to join your club.</p>
            </div>
          ) : (
            <div className="divide-y">
              {staff.filter(m => m.status === 'active').map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 rounded-xl shrink-0">
                      <AvatarImage src={m.photoUrl} />
                      <AvatarFallback className="rounded-xl bg-muted font-black text-xs">{getInitials(m.displayName || '')}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate">{m.displayName || 'Staff Member'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`font-black text-[9px] border ${ROLE_COLORS[m.role] || 'bg-muted text-muted-foreground border-border'}`}>
                          {ROLE_LABELS[m.role] || m.role}
                        </Badge>
                        {m.joinedAt && (
                          <span className="text-[9px] text-muted-foreground font-bold">
                            Since {new Date(m.joinedAt).getFullYear()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.role !== 'admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 font-bold text-xs gap-1" disabled={updatingId === m.id}>
                            {updatingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Change Role <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STAFF_ROLES.filter(r => r !== m.role).map(r => (
                            <DropdownMenuItem key={r} onClick={() => handleChangeRole(m.id, r)} className="font-bold">
                              {ROLE_LABELS[r]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {m.role !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveMemberId(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddStaffDirectDialog
        open={addDirectOpen}
        onClose={() => setAddDirectOpen(false)}
        clubId={clubId}
        clubName={clubName}
      />

      <AlertDialog open={!!removeMemberId} onOpenChange={open => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this person from your coaching staff. They will lose access to the club dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
