'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck, ShieldX, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Eye, Ruler, Weight, Zap, Clock,
  ChevronDown, ChevronUp, Edit3, Check, RotateCcw, Search, X
} from 'lucide-react';
import type { AthleteProfile } from '@/lib/types';
import { useCoachClub } from '@/app/coach-dashboard/coach-context';
import { useToast } from '@/hooks/use-toast';
import { smsSend } from '@/hooks/useSMS';
import { format, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

interface VerificationRecord {
  id: string;
  athleteId: string;
  athleteName: string;
  coachId: string;
  coachName: string;
  clubId: string;
  statsSnapshot: Record<string, unknown>;
  corrections: Array<{ field: string; oldValue: number; newValue: number }>;
  notes: string;
  verifiedAt: string;
}

type StatCorrections = Record<string, Record<string, number>>;

export default function CoachVerifyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [viewAthlete, setViewAthlete] = useState<AthleteProfile | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  // Per-stat correction state inside the modal
  const [corrections, setCorrections] = useState<StatCorrections>({});
  const [verifyNotes, setVerifyNotes] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const { clubId, membershipsLoaded } = useCoachClub();
  const memberLoading = !membershipsLoaded;

  const allAthletesQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId))
      : null
  ), [firestore, clubId]);
  const { data: allAthletes, isLoading: pendingLoading } = useCollection<AthleteProfile>(allAthletesQuery);

  const pending = useMemo(() => allAthletes?.filter(a => !a.isVerified) ?? [], [allAthletes]);
  const verified = useMemo(() => allAthletes?.filter(a => a.isVerified) ?? [], [allAthletes]);
  const verifiedLoading = pendingLoading;

  const availablePositions = useMemo(() => {
    const positions = pending.map(a => a.position).filter(Boolean) as string[];
    return Array.from(new Set(positions)).sort();
  }, [pending]);

  const filteredPending = useMemo(() => {
    let list = pending;
    if (positionFilter !== 'all') list = list.filter(a => a.position === positionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        (a.position ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [pending, positionFilter, search]);

  const verificationsQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'verifications'), where('coachId', '==', user.uid))
      : null
  ), [firestore, user]);
  const { data: auditTrail } = useCollection<VerificationRecord>(verificationsQuery);

  const handleQuickVerify = async (a: AthleteProfile, approve: boolean) => {
    if (!firestore || !clubId || !user) return;
    setProcessingId(a.uid);
    try {
      const now = new Date().toISOString();
      const coachName = user.displayName || user.email || 'Coach';
      await updateDoc(doc(firestore, 'athletes', a.uid), {
        isVerified: approve,
        attributesVerified: approve,
        verifiedBy: approve ? coachName : null,
        verifiedAt: approve ? now : null,
        updatedAt: now,
      });
      if (approve) {
        await addDoc(collection(firestore, 'verifications'), {
          athleteId: a.uid,
          athleteName: `${a.firstName} ${a.lastName}`,
          coachId: user.uid,
          coachName,
          clubId,
          statsSnapshot: {
            compositeScoutingIndex: a.compositeScoutingIndex,
            performanceIndex: a.performanceIndex,
            consistencyIndex: a.consistencyIndex,
            riskIndex: a.riskIndex,
            heightCm: a.heightCm,
            weightKg: a.weightKg,
          },
          corrections: [],
          notes: 'Quick verification — no stat corrections',
          verifiedAt: now,
        });
        try {
          await addDoc(collection(firestore, 'notifications', a.uid, 'items'), {
            type: 'verification',
            title: 'Profile Verified ✓',
            body: `Your profile has been verified by ${coachName}. Your stats are now institutional truth visible to scouts.`,
            coachId: user.uid,
            coachName,
            isRead: false,
            createdAt: now,
          });
        } catch { }
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
    } catch {
      toast({ title: 'Error', description: 'Could not update verification status.', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!firestore || !clubId || !user || !pending.length) return;
    setBulkVerifying(true);
    const now = new Date().toISOString();
    const coachName = user.displayName || user.email || 'Coach';
    let successCount = 0;
    await Promise.allSettled(
      pending.map(async (a) => {
        try {
          await updateDoc(doc(firestore, 'athletes', a.uid), {
            isVerified: true,
            attributesVerified: true,
            verifiedBy: coachName,
            verifiedAt: now,
            updatedAt: now,
          });
          await addDoc(collection(firestore, 'verifications'), {
            athleteId: a.uid,
            athleteName: `${a.firstName} ${a.lastName}`,
            coachId: user.uid,
            coachName,
            clubId,
            statsSnapshot: {
              compositeScoutingIndex: a.compositeScoutingIndex,
              performanceIndex: a.performanceIndex,
              consistencyIndex: a.consistencyIndex,
              riskIndex: a.riskIndex,
              heightCm: a.heightCm,
              weightKg: a.weightKg,
            },
            corrections: [],
            notes: 'Bulk verification — no stat corrections',
            verifiedAt: now,
          });
          try {
            await addDoc(collection(firestore, 'notifications', a.uid, 'items'), {
              type: 'verification',
              title: 'Profile Verified ✓',
              body: `Your profile has been verified by ${coachName}. Your stats are now institutional truth visible to scouts.`,
              coachId: user.uid,
              coachName,
              isRead: false,
              createdAt: now,
            });
          } catch { }
          smsSend('match-verified', {
            athletePhone: a.phone,
            athleteName: a.firstName,
            clubName: undefined,
          });
          successCount++;
        } catch { }
      })
    );
    setBulkVerifying(false);
    toast({
      title: `${successCount} Athlete${successCount !== 1 ? 's' : ''} Verified ✓`,
      description: 'All profiles are now institutional truth visible to scouts.',
    });
  };

  const handleOpenModal = (a: AthleteProfile) => {
    setViewAthlete(a);
    // Pre-populate corrections with current attribute values
    const initial: StatCorrections = {};
    if (a.detailedAttributes) {
      for (const [cat, attrs] of Object.entries(a.detailedAttributes)) {
        initial[cat] = { ...(attrs as Record<string, number>) };
      }
    }
    setCorrections(initial);
    setVerifyNotes('');
  };

  const handleConfirmVerification = async () => {
    if (!firestore || !viewAthlete || !clubId || !user) return;
    setConfirmLoading(true);
    try {
      const original = viewAthlete.detailedAttributes;
      const correctionList: Array<{ field: string; oldValue: number; newValue: number }> = [];

      // Find changed values
      for (const [cat, attrs] of Object.entries(corrections)) {
        for (const [stat, newVal] of Object.entries(attrs)) {
          const oldVal = (original?.[cat as keyof typeof original] as Record<string, number>)?.[stat];
          if (oldVal !== undefined && oldVal !== newVal) {
            correctionList.push({ field: `${cat}.${stat}`, oldValue: oldVal, newValue: newVal });
          }
        }
      }

      // Build updated detailedAttributes
      const updatedAttributes = {
        ...(viewAthlete.detailedAttributes ?? {}),
        ...Object.fromEntries(
          Object.entries(corrections).map(([cat, attrs]) => [cat, attrs])
        ),
      };

      // Update athlete document
      await updateDoc(doc(firestore, 'athletes', viewAthlete.uid), {
        isVerified: true,
        attributesVerified: true,
        detailedAttributes: updatedAttributes,
        verifiedBy: user.displayName || user.email || 'Coach',
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Write audit record to verifications/ collection
      await addDoc(collection(firestore, 'verifications'), {
        athleteId: viewAthlete.uid,
        athleteName: `${viewAthlete.firstName} ${viewAthlete.lastName}`,
        coachId: user.uid,
        coachName: user.displayName || user.email || 'Coach',
        clubId,
        statsSnapshot: {
          compositeScoutingIndex: viewAthlete.compositeScoutingIndex,
          performanceIndex: viewAthlete.performanceIndex,
          consistencyIndex: viewAthlete.consistencyIndex,
          riskIndex: viewAthlete.riskIndex,
          heightCm: viewAthlete.heightCm,
          weightKg: viewAthlete.weightKg,
          detailedAttributes: viewAthlete.detailedAttributes,
        },
        corrections: correctionList,
        notes: verifyNotes,
        verifiedAt: new Date().toISOString(),
      });

      const coachNameFull = user.displayName || user.email || 'Coach';
      try {
        await addDoc(collection(firestore, 'notifications', viewAthlete.uid, 'items'), {
          type: 'verification',
          title: 'Profile Verified ✓',
          body: `Your profile has been verified by ${coachNameFull}${correctionList.length > 0 ? ` with ${correctionList.length} correction${correctionList.length !== 1 ? 's' : ''}` : ''}. Your stats are now institutional truth visible to scouts.`,
          coachId: user.uid,
          coachName: coachNameFull,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      } catch { }

      smsSend('match-verified', {
        athletePhone: viewAthlete.phone,
        athleteName: viewAthlete.firstName,
        clubName: undefined,
      });

      toast({
        title: 'Verification Complete ✓',
        description: `${viewAthlete.firstName} ${viewAthlete.lastName} verified. ${correctionList.length} correction${correctionList.length !== 1 ? 's' : ''} applied.`,
      });
      setViewAthlete(null);
    } catch {
      toast({ title: 'Error', description: 'Verification failed. Please try again.', variant: 'destructive' });
    } finally {
      setConfirmLoading(false);
    }
  };

  const updateCorrection = (category: string, stat: string, value: number) => {
    setCorrections(prev => ({
      ...prev,
      [category]: { ...(prev[category] ?? {}), [stat]: value },
    }));
  };

  const resetCorrection = (category: string, stat: string) => {
    const original = viewAthlete?.detailedAttributes?.[category as keyof typeof viewAthlete.detailedAttributes] as Record<string, number> | undefined;
    if (original?.[stat] !== undefined) {
      updateCorrection(category, stat, original[stat]);
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
            Review each athlete's self-reported stats, make corrections where needed, then confirm. Verified profiles are locked as institutional truth visible to scouts. Athletes receive instant SMS confirmation.
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
          <TabsTrigger value="audit" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase tracking-wide gap-2">
            <ShieldCheck className="h-3 w-3" />
            Audit ({auditTrail?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* PENDING */}
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
            <>
              {/* Search + Filter bar */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                  <Input
                    placeholder="Search by name or position…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-9 h-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] text-sm font-medium focus-visible:ring-[#00C853] focus-visible:border-[#00C853]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {availablePositions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setPositionFilter('all')}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-colors',
                        positionFilter === 'all'
                          ? 'bg-[#00C853] text-black border-[#00C853]'
                          : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#00C853]/40 hover:text-white'
                      )}
                    >
                      All
                    </button>
                    {availablePositions.map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPositionFilter(pos === positionFilter ? 'all' : pos)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-colors',
                          positionFilter === pos
                            ? 'bg-[#00C853] text-black border-[#00C853]'
                            : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#00C853]/40 hover:text-white'
                        )}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Header row */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">
                  {filteredPending.length === pending.length
                    ? `${pending.length} athlete${pending.length !== 1 ? 's' : ''} awaiting review`
                    : `${filteredPending.length} of ${pending.length} shown`}
                </p>
                <Button
                  size="sm"
                  onClick={handleVerifyAll}
                  disabled={bulkVerifying || !!processingId || filteredPending.length === 0}
                  className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase tracking-wide h-8 gap-2"
                >
                  {bulkVerifying ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Verifying…</>
                  ) : (
                    <><ShieldCheck className="h-3 w-3" /> Verify All ({filteredPending.length})</>
                  )}
                </Button>
              </div>

              {/* List */}
              {filteredPending.length === 0 ? (
                <div className="text-center py-10">
                  <Search className="h-8 w-8 text-[#94A3B8] mx-auto mb-2 opacity-40" />
                  <p className="text-[#94A3B8] font-bold text-sm">No athletes match your search</p>
                  <button onClick={() => { setSearch(''); setPositionFilter('all'); }} className="mt-2 text-[10px] font-black text-[#00C853] uppercase hover:underline">
                    Clear filters
                  </button>
                </div>
              ) : (
                filteredPending.map(a => (
                  <AthleteVerifyCard
                    key={a.uid}
                    athlete={a}
                    loading={processingId === a.uid || bulkVerifying}
                    onVerify={() => handleQuickVerify(a, true)}
                    onDecline={() => handleQuickVerify(a, false)}
                    onView={() => handleOpenModal(a)}
                  />
                ))
              )}
            </>
          )}
        </TabsContent>

        {/* VERIFIED */}
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
                  onClick={() => handleQuickVerify(a, false)}
                  disabled={processingId === a.uid}
                  className="text-red-400 hover:bg-red-400/10 font-black text-[10px] uppercase h-7"
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        {/* AUDIT TRAIL */}
        <TabsContent value="audit" className="space-y-3">
          {!auditTrail?.length ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-[#94A3B8] font-bold">No verification records yet</p>
              <p className="text-[#94A3B8] text-sm mt-1">Verifications you perform will appear here as an audit trail.</p>
            </div>
          ) : (
            auditTrail
              .slice()
              .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))
              .map(v => (
                <Card key={v.id} className="border border-[#1E293B] bg-[#111827]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white">{v.athleteName}</p>
                        <p className="text-[9px] font-bold text-[#94A3B8] uppercase mt-0.5">
                          Verified by {v.coachName} ·{' '}
                          {(() => { try { return format(parseISO(v.verifiedAt), 'dd MMM yyyy, HH:mm'); } catch { return v.verifiedAt; } })()}
                        </p>
                      </div>
                      <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[9px] shrink-0">
                        {v.corrections.length} correction{v.corrections.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {v.corrections.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Corrections Applied</p>
                        {v.corrections.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="text-[#94A3B8] font-bold">{c.field}</span>
                            <span className="text-red-400 line-through">{c.oldValue}</span>
                            <span className="text-[#94A3B8]">→</span>
                            <span className="text-[#00C853] font-black">{c.newValue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {v.notes && v.notes !== 'Quick verification — no stat corrections' && (
                      <p className="text-[11px] text-[#94A3B8] mt-2 italic">"{v.notes}"</p>
                    )}
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>

      {/* Verification Detail Modal with Per-Stat Correction Table */}
      {viewAthlete && (
        <Dialog open onOpenChange={() => setViewAthlete(null)}>
          <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-wide text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#00C853]" />
                Verify — {viewAthlete.firstName} {viewAthlete.lastName}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-5 pb-2">
                {/* Athlete Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-2xl shrink-0">
                    <AvatarImage src={viewAthlete.photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-2xl bg-[#1C2333] text-[#94A3B8] text-xl font-black">
                      {viewAthlete.firstName[0]}{viewAthlete.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-black text-white">{viewAthlete.firstName} {viewAthlete.lastName}</p>
                    <p className="text-[#94A3B8] text-sm font-bold uppercase">{viewAthlete.position} · {viewAthlete.sport}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/30 font-black text-[9px] gap-1">
                        <Clock className="h-2.5 w-2.5" /> Self-Reported — Awaiting Review
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Bio Stats */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Age', value: `${viewAthlete.age}y`, icon: Zap },
                    { label: 'Height', value: viewAthlete.heightCm ? `${viewAthlete.heightCm}cm` : '--', icon: Ruler },
                    { label: 'Weight', value: viewAthlete.weightKg ? `${viewAthlete.weightKg}kg` : '--', icon: Weight },
                    { label: 'Foot', value: viewAthlete.dominantFoot ?? '--', icon: Zap },
                  ].map(s => (
                    <div key={s.label} className="p-2 rounded-xl bg-[#1C2333] text-center">
                      <p className="text-sm font-black text-white">{s.value}</p>
                      <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Index Scores */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'CSI', value: viewAthlete.compositeScoutingIndex ?? '--', color: 'text-[#00C853]' },
                    { label: 'Risk Index', value: viewAthlete.riskIndex ?? '--', color: (viewAthlete.riskIndex ?? 0) >= 60 ? 'text-red-400' : 'text-white' },
                    { label: 'Performance', value: viewAthlete.performanceIndex ?? '--', color: 'text-white' },
                    { label: 'Consistency', value: viewAthlete.consistencyIndex ?? '--', color: 'text-white' },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-[#1C2333]">
                      <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">{s.label}</p>
                      <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Per-Stat Correction Table */}
                {viewAthlete.detailedAttributes && Object.keys(viewAthlete.detailedAttributes).length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-[#FF6D00]" />
                      <p className="text-[11px] font-black text-[#FF6D00] uppercase tracking-widest">
                        Per-Stat Review — Correct any inaccurate values below
                      </p>
                    </div>

                    {(['Technical', 'Mental', 'Physical'] as const).map(cat => {
                      const attrs = viewAthlete.detailedAttributes?.[cat] as Record<string, number> | undefined;
                      if (!attrs || Object.keys(attrs).length === 0) return null;
                      return (
                        <div key={cat} className="space-y-2">
                          <p className={cn(
                            'text-[10px] font-black uppercase tracking-widest',
                            cat === 'Technical' ? 'text-blue-400' : cat === 'Mental' ? 'text-purple-400' : 'text-[#FF6D00]'
                          )}>
                            {cat}
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(attrs).map(([stat, originalVal]) => {
                              const currentVal = corrections[cat]?.[stat] ?? originalVal;
                              const isChanged = currentVal !== originalVal;
                              return (
                                <div key={stat} className={cn(
                                  'grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center p-2 rounded-lg border transition-colors',
                                  isChanged ? 'bg-[#FF6D00]/5 border-[#FF6D00]/30' : 'bg-[#1C2333] border-[#1E293B]'
                                )}>
                                  <div>
                                    <p className="text-xs font-bold text-white capitalize">{stat.replace(/([A-Z])/g, ' $1').trim()}</p>
                                    {isChanged && (
                                      <p className="text-[9px] text-[#94A3B8]">
                                        Original: <span className="text-red-400 line-through">{originalVal}</span>
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateCorrection(cat, stat, Math.max(0, currentVal - 1))}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-[#0A0E1A] text-[#94A3B8] hover:text-white font-black text-sm"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={currentVal}
                                      onChange={e => updateCorrection(cat, stat, Math.min(100, Math.max(0, Number(e.target.value))))}
                                      className={cn(
                                        'w-14 h-6 text-center text-xs font-black border p-0',
                                        isChanged ? 'text-[#FF6D00] border-[#FF6D00]/50 bg-[#0A0E1A]' : 'text-white border-[#1E293B] bg-[#0A0E1A]'
                                      )}
                                    />
                                    <button
                                      onClick={() => updateCorrection(cat, stat, Math.min(100, currentVal + 1))}
                                      className="w-6 h-6 flex items-center justify-center rounded bg-[#0A0E1A] text-[#94A3B8] hover:text-white font-black text-sm"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                                    {isChanged ? (
                                      <span className="text-[#FF6D00] font-black text-[9px] uppercase">Edited</span>
                                    ) : (
                                      <Check className="h-3 w-3 text-[#00C853]" />
                                    )}
                                  </div>
                                  <button
                                    onClick={() => resetCorrection(cat, stat)}
                                    disabled={!isChanged}
                                    className="w-6 h-6 flex items-center justify-center rounded text-[#94A3B8] hover:text-[#FF6D00] disabled:opacity-30"
                                    title="Reset to original"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#1C2333] border border-[#1E293B]">
                    <p className="text-[11px] text-[#94A3B8] text-center">
                      No detailed attribute data available. You can still verify the athlete's profile and core metrics.
                    </p>
                  </div>
                )}

                {/* Verification Notes */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Coach Notes (Optional)</p>
                  <Textarea
                    placeholder="Add any notes about this verification (e.g. verified during training, tested in-person)..."
                    value={verifyNotes}
                    onChange={e => setVerifyNotes(e.target.value)}
                    rows={2}
                    className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none text-sm"
                  />
                </div>

                {/* Correction Summary */}
                {(() => {
                  const changedCount = Object.entries(corrections).reduce((total, [cat, attrs]) => {
                    const original = viewAthlete.detailedAttributes?.[cat as keyof typeof viewAthlete.detailedAttributes] as Record<string, number> | undefined;
                    return total + Object.entries(attrs).filter(([stat, val]) => original?.[stat] !== val).length;
                  }, 0);
                  return changedCount > 0 ? (
                    <div className="p-3 rounded-xl bg-[#FF6D00]/5 border border-[#FF6D00]/20">
                      <p className="text-[11px] font-black text-[#FF6D00]">
                        {changedCount} stat correction{changedCount !== 1 ? 's' : ''} will be applied and recorded in the audit trail.
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 flex-col sm:flex-row pt-4 border-t border-[#1E293B]">
              <Button
                variant="outline"
                onClick={() => handleQuickVerify(viewAthlete, false)}
                disabled={confirmLoading || processingId === viewAthlete.uid}
                className="border-red-500/30 text-red-400 hover:bg-red-400/10 font-black uppercase text-[10px] flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" /> Decline
              </Button>
              <Button
                onClick={handleConfirmVerification}
                disabled={confirmLoading}
                className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase text-[10px] flex-1 gap-2"
              >
                {confirmLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Confirm & Verify
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
  const hasAttributes = a.detailedAttributes && Object.values(a.detailedAttributes).some(
    cat => Object.keys(cat as Record<string, number>).length > 0
  );

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
              {hasAttributes && (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-black text-[8px]">
                  <Edit3 className="h-2.5 w-2.5 mr-1" /> Has detailed stats
                </Badge>
              )}
            </div>
          </div>

          <Button
            size="sm" variant="ghost"
            onClick={onView}
            className="border border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1C2333] font-black text-[10px] uppercase h-8 gap-1 shrink-0"
          >
            <Eye className="h-3 w-3" /> Review Stats
          </Button>
        </div>

        {/* Metrics preview */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'CSI', value: a.compositeScoutingIndex ?? '--' },
            { label: 'Risk', value: a.riskIndex ?? '--' },
            { label: 'Perf', value: a.performanceIndex ?? '--' },
            { label: 'Cons', value: a.consistencyIndex ?? '--' },
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
            onClick={onView}
            className="flex-1 bg-[#FF6D00] hover:bg-[#FF6D00]/90 text-white font-black text-[10px] uppercase h-8 gap-1"
          >
            <Edit3 className="h-3 w-3" /> Review & Verify
          </Button>
          <Button
            size="sm"
            onClick={onVerify}
            disabled={loading}
            className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase h-8 gap-1 px-3"
            title="Quick verify without reviewing stats"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
