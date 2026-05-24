'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck, ShieldX, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Eye, Ruler, Weight, Zap, Clock
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { smsSend } from '@/hooks/useSMS';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

export default function CoachVerifyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewAthlete, setViewAthlete] = useState<AthleteProfile | null>(null);

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const pendingQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId), where('isVerified', '==', false))
      : null
  ), [firestore, clubId]);
  const { data: pending, isLoading: pendingLoading } = useCollection<AthleteProfile>(pendingQuery);

  const verifiedQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId), where('isVerified', '==', true))
      : null
  ), [firestore, clubId]);
  const { data: verified, isLoading: verifiedLoading } = useCollection<AthleteProfile>(verifiedQuery);

  const handleVerify = async (a: AthleteProfile, approve: boolean) => {
    if (!firestore) return;
    setProcessingId(a.uid);
    try {
      await updateDoc(doc(firestore, 'athletes', a.uid), {
        isVerified: approve,
        attributesVerified: approve,
        updatedAt: new Date().toISOString(),
      });
      if (approve) {
        smsSend('match-verified', {
          athletePhone: a.phone,
          athleteName: a.firstName,
          clubName: undefined,
        });
      }
      toast({
        title: approve ? 'Profile Verified ✓' : 'Verification Declined',
        description: approve
          ? `${a.firstName} ${a.lastName}'s data is now institutional truth.`
          : `${a.firstName} ${a.lastName} has been asked to resubmit.`,
      });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update verification status.', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const isLoading = memberLoading || pendingLoading;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">Verify Athletes</h1>
        <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
          Confirm athlete data as institutional truth
        </p>
      </div>

      {/* Info strip */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FF6D00]/5 border border-[#FF6D00]/20">
        <Zap className="h-4 w-4 text-[#FF6D00] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[11px] font-black text-[#FF6D00] uppercase tracking-wide">Automated Verification Flow</p>
          <p className="text-[11px] text-[#94A3B8]">
            When you verify an athlete, their profile data is locked as institutional truth visible to scouts.
            Athletes receive instant SMS confirmation. Unverified athletes remain hidden from the scout marketplace.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-[#1C2333] border border-[#1E293B] p-1">
          <TabsTrigger value="pending" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase tracking-wide gap-2">
            <AlertTriangle className="h-3 w-3" />
            Pending ({pending?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="verified" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase tracking-wide gap-2">
            <CheckCircle2 className="h-3 w-3" />
            Verified ({verified?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
          ) : !pending?.length ? (
            <div className="text-center py-16">
              <CheckCircle2 className="h-12 w-12 text-[#00C853] mx-auto mb-3" />
              <p className="text-white font-black text-lg">All caught up!</p>
              <p className="text-[#94A3B8] text-sm mt-1">No athletes pending verification.</p>
            </div>
          ) : (
            pending.map(a => (
              <AthleteVerifyCard
                key={a.uid}
                athlete={a}
                loading={processingId === a.uid}
                onVerify={() => handleVerify(a, true)}
                onDecline={() => handleVerify(a, false)}
                onView={() => setViewAthlete(a)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="verified" className="space-y-3">
          {verifiedLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#00C853]" /></div>
          ) : !verified?.length ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-[#94A3B8] font-bold">No verified athletes yet</p>
            </div>
          ) : (
            verified.map(a => (
              <div key={a.uid} className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-[#00C853]/20">
                <Avatar className="h-10 w-10 rounded-xl shrink-0">
                  <AvatarImage src={a.photoUrl} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                    {a.firstName[0]}{a.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position} · {a.age}y</p>
                </div>
                <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[9px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </Badge>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => handleVerify(a, false)}
                  disabled={processingId === a.uid}
                  className="text-red-400 hover:bg-red-400/10 font-black text-[10px] uppercase h-7"
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Athlete Detail Dialog */}
      {viewAthlete && (
        <Dialog open onOpenChange={() => setViewAthlete(null)}>
          <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-wide text-white">
                {viewAthlete.firstName} {viewAthlete.lastName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-2xl">
                  <AvatarImage src={viewAthlete.photoUrl} className="object-cover" />
                  <AvatarFallback className="rounded-2xl bg-[#1C2333] text-[#94A3B8] text-xl font-black">
                    {viewAthlete.firstName[0]}{viewAthlete.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-black text-white">{viewAthlete.firstName} {viewAthlete.lastName}</p>
                  <p className="text-[#94A3B8] text-sm font-bold uppercase">{viewAthlete.position}</p>
                  <p className="text-[#94A3B8] text-xs">{viewAthlete.sport} · {viewAthlete.age} years</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Height', value: viewAthlete.heightCm ? `${viewAthlete.heightCm}cm` : '--', icon: Ruler },
                  { label: 'Weight', value: viewAthlete.weightKg ? `${viewAthlete.weightKg}kg` : '--', icon: Weight },
                  { label: 'Foot', value: viewAthlete.dominantFoot ?? '--', icon: Zap },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-[#1C2333] text-center">
                    <s.icon className="h-4 w-4 text-[#94A3B8] mx-auto mb-1" />
                    <p className="text-sm font-black text-white">{s.value}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{s.label}</p>
                  </div>
                ))}
              </div>

              {viewAthlete.bio && (
                <div className="p-3 rounded-xl bg-[#1C2333]">
                  <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Bio</p>
                  <p className="text-sm text-white">{viewAthlete.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'CSI', value: viewAthlete.compositeScoutingIndex ?? '--' },
                  { label: 'Risk Index', value: viewAthlete.riskIndex ?? '--' },
                  { label: 'Performance', value: viewAthlete.performanceIndex ?? '--' },
                  { label: 'Consistency', value: viewAthlete.consistencyIndex ?? '--' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-[#1C2333]">
                    <p className="text-xs font-black text-[#94A3B8] uppercase tracking-widest">{s.label}</p>
                    <p className="text-xl font-black text-[#00C853] mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => handleVerify(viewAthlete, false)}
                disabled={processingId === viewAthlete.uid}
                className="border-red-500/30 text-red-400 hover:bg-red-400/10 font-black uppercase text-[10px] flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" /> Decline
              </Button>
              <Button
                onClick={() => { handleVerify(viewAthlete, true); setViewAthlete(null); }}
                disabled={processingId === viewAthlete.uid}
                className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase text-[10px] flex-1 gap-2"
              >
                {processingId === viewAthlete.uid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Verify & Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AthleteVerifyCard({
  athlete: a, loading, onVerify, onDecline, onView
}: {
  athlete: AthleteProfile;
  loading: boolean;
  onVerify: () => void;
  onDecline: () => void;
  onView: () => void;
}) {
  return (
    <Card className="border border-[#1E293B] bg-[#111827] hover:border-[#FF6D00]/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 rounded-xl shrink-0">
            <AvatarImage src={a.photoUrl} className="object-cover" />
            <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-sm font-black">
              {a.firstName[0]}{a.lastName[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">{a.firstName} {a.lastName}</p>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position} · {a.sport} · {a.age}y</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">
                {a.heightCm}cm / {a.weightKg}kg
              </Badge>
              <Badge className="bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/20 font-black text-[8px]">
                <Clock className="h-2.5 w-2.5 mr-1" /> Pending
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              size="sm" variant="ghost"
              onClick={onView}
              className="border border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase h-7 gap-1"
            >
              <Eye className="h-3 w-3" /> View
            </Button>
          </div>
        </div>

        {/* Metrics preview */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'CSI', value: a.compositeScoutingIndex ?? '--' },
            { label: 'Risk', value: a.riskIndex ?? '--' },
            { label: 'Perf', value: a.performanceIndex ?? '--' },
            { label: 'CSI-C', value: a.consistencyIndex ?? '--' },
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-lg bg-[#1C2333]">
              <p className="text-sm font-black text-white">{s.value}</p>
              <p className="text-[8px] font-bold text-[#94A3B8]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            size="sm" variant="outline"
            onClick={onDecline}
            disabled={loading}
            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-400/10 font-black text-[10px] uppercase h-8 gap-1"
          >
            <XCircle className="h-3 w-3" /> Decline
          </Button>
          <Button
            size="sm"
            onClick={onVerify}
            disabled={loading}
            className="flex-1 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase h-8 gap-1"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            Verify
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
