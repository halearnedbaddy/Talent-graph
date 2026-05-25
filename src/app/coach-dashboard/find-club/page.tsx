'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import {
  collection, query, getDocs, getDoc, doc, setDoc, where, orderBy, limit
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search, Building2, MapPin, ShieldCheck, Users, Loader2,
  CheckCircle2, Send, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClubDoc {
  id: string;
  clubName: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  location?: string;
  sportFocus?: string[];
  isVerified?: boolean;
  memberCount?: number;
}

export default function FindClubPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [clubs, setClubs] = useState<ClubDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(firestore, 'clubs'), limit(50)));
        const docs: ClubDoc[] = snap.docs.map(d => ({
          id: d.id,
          clubName: (d.data() as any).clubName || (d.data() as any).name || 'Unknown Club',
          logoUrl: (d.data() as any).logoUrl,
          city: (d.data() as any).city,
          country: (d.data() as any).country,
          location: (d.data() as any).location,
          sportFocus: (d.data() as any).sportFocus,
          isVerified: (d.data() as any).isVerified,
        }));
        setClubs(docs);
      } catch {
        toast({ title: 'Failed to load clubs', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore]);

  useEffect(() => {
    if (!firestore || !user) return;
    (async () => {
      const q = query(
        collection(firestore, 'club_members'),
        where('userId', '==', user.uid),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      if (!snap.empty) setAlreadyMember(true);

      const pendingQ = query(collection(firestore, 'club_members'), where('userId', '==', user.uid));
      const pendingSnap = await getDocs(pendingQ);
      const pendingClubIds = new Set(pendingSnap.docs.map(d => (d.data() as any).clubId as string));
      setJoined(pendingClubIds);
    })();
  }, [firestore, user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clubs;
    const q = search.toLowerCase();
    return clubs.filter(c =>
      c.clubName.toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q) ||
      (c.country ?? '').toLowerCase().includes(q) ||
      (c.location ?? '').toLowerCase().includes(q)
    );
  }, [clubs, search]);

  const handleRequest = async (club: ClubDoc) => {
    if (!firestore || !user) return;
    setSubmitting(club.id);
    try {
      const memberId = `${user.uid}_${club.id}`;
      const memberRef = doc(firestore, 'club_members', memberId);
      const existing = await getDoc(memberRef);
      if (existing.exists()) {
        setJoined(prev => new Set(prev).add(club.id));
        toast({ title: 'Already requested', description: 'You already have a request pending for this club.' });
        return;
      }

      const userSnap = await getDoc(doc(firestore, 'users', user.uid));
      const userData = userSnap.data() as any;
      const displayName = userData
        ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user.displayName || user.email
        : user.displayName || user.email || 'Coach';

      let photoUrl: string | null = null;
      try {
        const scoutSnap = await getDoc(doc(firestore, 'scouts', user.uid));
        photoUrl = (scoutSnap.data() as any)?.photoUrl || null;
      } catch { }

      const now = new Date().toISOString();
      await setDoc(memberRef, {
        userId: user.uid,
        clubId: club.id,
        clubName: club.clubName,
        role: 'coach',
        status: 'pending',
        displayName,
        photoUrl,
        joinedAt: null,
        invitedAt: now,
        createdAt: now,
        source: 'self_apply',
      });

      setJoined(prev => new Set(prev).add(club.id));
      toast({
        title: 'Request Sent ✓',
        description: `Your application to join ${club.clubName} has been sent to the admin.`,
      });
    } catch (err: any) {
      const isPermission = err?.code === 'permission-denied';
      toast({
        variant: 'destructive',
        title: isPermission ? 'Permission denied' : 'Error',
        description: isPermission
          ? 'Your account does not have permission to request membership.'
          : err.message || 'Could not send request.',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">Find a Club</h1>
        <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
          Browse clubs and request to join as a coach
        </p>
      </div>

      {alreadyMember && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#00C853]/5 border border-[#00C853]/20">
          <CheckCircle2 className="h-4 w-4 text-[#00C853] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black text-[#00C853] uppercase tracking-wide">Already a club member</p>
            <p className="text-[11px] text-[#94A3B8]">
              You are already an active member of a club. You can still browse and apply to other clubs.
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
        <Input
          placeholder="Search by club name, city or country..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
          <p className="text-white font-black">No clubs found</p>
          <p className="text-[#94A3B8] text-sm mt-1">
            {search ? 'Try a different search term.' : 'No clubs are registered on the platform yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(club => {
            const hasPending = joined.has(club.id);
            return (
              <Card key={club.id} className="border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 rounded-xl shrink-0">
                      <AvatarImage src={club.logoUrl} className="object-cover" />
                      <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] font-black text-lg">
                        {club.clubName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <p className="text-sm font-black text-white truncate">{club.clubName}</p>
                        {club.isVerified && (
                          <ShieldCheck className="h-3.5 w-3.5 text-[#00C853] shrink-0" />
                        )}
                      </div>
                      {(club.city || club.country || club.location) && (
                        <p className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {club.city && club.country
                            ? `${club.city}, ${club.country}`
                            : club.location || club.city || club.country}
                        </p>
                      )}
                      {club.sportFocus && club.sportFocus.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {club.sportFocus.slice(0, 2).map(s => (
                            <Badge key={s} className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    {hasPending ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1C2333] border border-[#1E293B]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#00C853]" />
                        <span className="text-[10px] font-black text-[#00C853] uppercase tracking-wide">Request Sent</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleRequest(club)}
                        disabled={submitting === club.id}
                        className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2 h-8"
                      >
                        {submitting === club.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Send className="h-3.5 w-3.5" />
                        }
                        Request to Join
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
