'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import {
  doc, getDoc, collection, query, where, getDocs, setDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, Users, ArrowLeft, CheckCircle2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const ROLE_OPTIONS = [
  { value: 'scout', label: 'Scout' },
  { value: 'coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'analyst', label: 'Performance Analyst' },
  { value: 'gk_coach', label: 'GK Coach' },
];

export default function JoinClubPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = decodeURIComponent(params.clubId as string);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [clubData, setClubData] = useState<{
    clubName: string; logoUrl?: string; city?: string; country?: string; isVerified?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [selectedRole, setSelectedRole] = useState('scout');
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!firestore || !clubId) return;
    (async () => {
      setLoading(true);
      try {
        // Try clubs/{clubId} first (club docs use club_ prefix in their ID)
        const clubRef = doc(firestore, 'clubs', clubId);
        const clubSnap = await getDoc(clubRef);
        if (clubSnap.exists()) {
          const d = clubSnap.data() as any;
          setClubData({
            clubName: d.clubName || d.name || 'Unknown Club',
            logoUrl: d.logoUrl,
            city: d.city,
            country: d.country,
            isVerified: d.isVerified,
          });
        } else {
          setClubData(null);
        }
      } catch {
        setClubData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore, clubId]);

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(firestore, 'users', user.uid));
        const data = userSnap.data() as any;
        setUserRole(data?.role || '');
        if (data?.role && data.role !== 'athlete' && data.role !== 'club') {
          setSelectedRole(data.role === 'gk_coach' ? 'gk_coach' : data.role === 'assistant_coach' ? 'assistant_coach' : data.role === 'analyst' ? 'analyst' : data.role === 'coach' ? 'coach' : 'scout');
        }
        // Check if already a member
        const memberId = `${user.uid}_${clubId}`;
        const memberSnap = await getDoc(doc(firestore, 'club_members', memberId));
        if (memberSnap.exists()) {
          setAlreadyMember(true);
        }
      } catch {
        // ignore
      }
    })();
  }, [firestore, user, clubId]);

  const handleRequest = async () => {
    if (!firestore || !user || !clubData) return;
    setIsSubmitting(true);
    try {
      const memberId = `${user.uid}_${clubId}`;
      const memberRef = doc(firestore, 'club_members', memberId);

      // Check if already exists
      const existing = await getDoc(memberRef);
      if (existing.exists()) {
        setAlreadyMember(true);
        toast({ title: 'Already submitted', description: 'You have already requested to join this club.' });
        return;
      }

      const now = new Date().toISOString();

      // Get user display name
      const userSnap = await getDoc(doc(firestore, 'users', user.uid));
      const userData = userSnap.data() as any;
      const displayName = userData
        ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user.displayName || user.email
        : user.displayName || user.email || 'User';

      // Get photo
      let photoUrl: string | null = null;
      try {
        if (selectedRole === 'scout' || selectedRole === 'coach' || selectedRole === 'assistant_coach' || selectedRole === 'gk_coach') {
          const scoutSnap = await getDoc(doc(firestore, 'scouts', user.uid));
          photoUrl = (scoutSnap.data() as any)?.photoUrl || null;
        } else if (selectedRole === 'analyst') {
          const analystSnap = await getDoc(doc(firestore, 'scouts', user.uid));
          photoUrl = (analystSnap.data() as any)?.photoUrl || null;
        }
      } catch { /* ignore */ }

      await setDoc(memberRef, {
        userId: user.uid,
        clubId,
        clubName: clubData.clubName,
        role: selectedRole,
        status: 'pending',
        displayName,
        photoUrl,
        joinedAt: null,
        invitedAt: now,
        createdAt: now,
        source: 'invite_link',
      });

      setSuccess(true);
      toast({ title: 'Request sent!', description: `Your request to join ${clubData.clubName} has been sent.` });
    } catch (err: any) {
      const isPermission = err?.code === 'permission-denied' || (err?.message || '').includes('permission');
      toast({
        variant: 'destructive',
        title: isPermission ? 'Permission denied' : 'Error',
        description: isPermission
          ? 'Your account type may not have permission to request club membership.'
          : err.message || 'Could not send request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-black uppercase">Join this Club</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          You need to sign in to request club membership.
        </p>
        <Button asChild className="font-black uppercase gap-2">
          <Link href={`/login?redirect=/join/club/${encodeURIComponent(clubId)}`}>
            Sign In to Continue
          </Link>
        </Button>
      </div>
    );
  }

  if (!clubData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-bold text-lg">Club not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const isAthleteOrClub = userRole === 'athlete' || userRole === 'club';

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-background rounded-2xl border shadow-xl p-6 space-y-6">
        <Button variant="ghost" size="sm" className="gap-2 text-xs -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Club card */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="h-20 w-20 rounded-2xl border-4 border-primary/20">
            <AvatarImage src={clubData.logoUrl} className="object-cover" />
            <AvatarFallback className="rounded-2xl text-2xl font-black bg-primary/10 text-primary">
              {clubData.clubName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-black uppercase tracking-tight">{clubData.clubName}</h1>
              {clubData.isVerified && <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />}
            </div>
            {(clubData.city || clubData.country) && (
              <p className="text-xs text-muted-foreground mt-0.5 font-bold">
                {[clubData.city, clubData.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="font-black text-green-700 dark:text-green-400 text-lg">Request Sent!</p>
            <p className="text-sm text-muted-foreground">
              Your request has been sent to <strong>{clubData.clubName}</strong>. They will review and approve your application.
            </p>
            <Button asChild className="w-full font-black mt-2">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        ) : alreadyMember ? (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <p className="font-black text-lg">Already a Member</p>
            <p className="text-sm text-muted-foreground">
              You have already submitted a request or are already part of <strong>{clubData.clubName}</strong>.
            </p>
            <Button asChild variant="outline" className="w-full font-bold mt-2">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        ) : isAthleteOrClub ? (
          <div className="rounded-xl border bg-amber-500/5 border-amber-200 p-4 text-center space-y-2">
            <p className="font-black text-sm text-amber-700">Not available for your role</p>
            <p className="text-xs text-muted-foreground">
              This invite link is for scouts, coaches, and analysts. Athletes join clubs through the squad management flow.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2 font-bold">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                You've been invited to join <strong>{clubData.clubName}</strong>. Select your role below and send a request.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Your Role
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="font-bold">
                  <SelectValue placeholder="Select your role..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="font-bold">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRequest}
              disabled={isSubmitting}
              className="w-full font-black gap-2 uppercase tracking-widest text-xs"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Request to Join
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              The club admin will review and approve your request.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
