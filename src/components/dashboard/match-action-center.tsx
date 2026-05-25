'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { MatchInvitation, AthleteProfile, MatchEntry, MatchConfirmation } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Calendar, ClipboardList, Check, X, ArrowRight,
  CheckCircle2, AlertTriangle, Star, ShieldCheck, Target, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function StatPill({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center px-2 py-1.5 rounded-lg', highlight ? 'bg-primary/10' : 'bg-muted/40')}>
      <span className={cn('text-sm font-black', highlight ? 'text-primary' : '')}>{value}</span>
      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">{label}</span>
    </div>
  );
}

export function MatchActionCenter({ athleteProfile }: { athleteProfile: AthleteProfile }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Inline dispute state: confirmationId → note text
  const [disputeOpen, setDisputeOpen] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  // 1. Match Invitations
  const invitesQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'match_invitations'), where('athleteId', '==', athleteProfile.uid), where('status', '==', 'pending')) : null
  ), [firestore, athleteProfile.uid]);
  const { data: invites, isLoading: invitesLoading } = useCollection<MatchInvitation>(invitesQuery);

  // 2. Club match confirmations (stats logged by coach/analyst — awaiting athlete sign-off)
  const confirmQuery = useMemoFirebase(() => (
    firestore ? query(
      collection(firestore, 'match_confirmations'),
      where('athleteId', '==', athleteProfile.uid),
      where('status', '==', 'pending')
    ) : null
  ), [firestore, athleteProfile.uid]);
  const { data: pendingConfirmations } = useCollection<MatchConfirmation>(confirmQuery);

  // 3. Matches in history that need stats (statsLogged: false)
  const pendingStats = athleteProfile.matchHistory?.filter(m => m.statsLogged === false) || [];

  const handleInviteAction = async (invite: MatchInvitation, action: 'confirmed' | 'declined') => {
    if (!firestore) return;
    try {
      const inviteRef = doc(firestore, 'match_invitations', invite.id);
      if (action === 'declined') {
        await deleteDoc(inviteRef);
        toast({ title: 'Invitation Declined', description: 'Institutional fixture ignored.' });
        return;
      }
      const athleteRef = doc(firestore, 'athletes', athleteProfile.uid);
      const newMatchEntry: MatchEntry = {
        id: invite.matchId,
        competition: invite.matchData.competition,
        apps: 1,
        minutes: 0,
        rating: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        duelsWon: 0,
        fouls: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        isVerified: false,
        updatedAt: new Date().toISOString(),
        clubMatchId: invite.matchId,
        statsLogged: false,
      };
      const updatedHistory = [...(athleteProfile.matchHistory || []), newMatchEntry];
      await updateDoc(athleteRef, { matchHistory: updatedHistory });
      await deleteDoc(inviteRef);
      toast({ title: 'Attendance Confirmed', description: 'Match added to your pending stats list.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to process invitation.' });
    }
  };

  const handleConfirm = async (confirmation: MatchConfirmation) => {
    if (!firestore) return;
    setProcessing(confirmation.id);
    try {
      await updateDoc(doc(firestore, 'match_confirmations', confirmation.id), {
        status: 'confirmed',
        resolvedAt: new Date().toISOString(),
      });
      toast({
        title: 'Stats Confirmed ✓',
        description: `Your stats for the match vs ${confirmation.opponent} have been verified.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not confirm stats.' });
    } finally {
      setProcessing(null);
    }
  };

  const handleFlag = async (confirmation: MatchConfirmation) => {
    if (!firestore || !disputeNote.trim()) return;
    setProcessing(confirmation.id);
    try {
      await updateDoc(doc(firestore, 'match_confirmations', confirmation.id), {
        status: 'flagged',
        disputeNote: disputeNote.trim(),
        resolvedAt: new Date().toISOString(),
      });
      toast({
        title: 'Discrepancy Flagged',
        description: 'Your note has been submitted. Your coach/analyst will review it.',
      });
      setDisputeOpen(null);
      setDisputeNote('');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not flag discrepancy.' });
    } finally {
      setProcessing(null);
    }
  };

  if (invitesLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const hasItems = (invites?.length ?? 0) > 0 || (pendingConfirmations?.length ?? 0) > 0 || pendingStats.length > 0;
  if (!hasItems) return null;

  const totalPending = (pendingConfirmations?.length ?? 0);

  return (
    <Card className="border-primary/20 shadow-lg bg-background overflow-hidden">
      <CardHeader className="bg-primary/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Action Centre
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight mt-0.5">
              Institutional Match Hub
            </CardDescription>
          </div>
          {totalPending > 0 && (
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-400/30 font-black text-[10px]">
              {totalPending} pending review
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 divide-y">

        {/* ── Match Invitations ── */}
        {invites?.map(invite => (
          <div key={invite.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-primary">Match Invite &bull; {invite.matchData.competition}</p>
                <h4 className="text-sm font-black uppercase">vs {invite.matchData.opponent}</h4>
                <p className="text-[9px] font-bold text-muted-foreground mt-0.5">{format(new Date(invite.matchData.date), 'PPP')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 px-4 text-muted-foreground hover:text-destructive" onClick={() => handleInviteAction(invite, 'declined')}>
                <X className="w-4 h-4 mr-2" /> Decline
              </Button>
              <Button size="sm" className="h-9 px-6 font-black uppercase tracking-widest text-[10px]" onClick={() => handleInviteAction(invite, 'confirmed')}>
                <Check className="w-4 h-4 mr-2" /> Confirm Attendance
              </Button>
            </div>
          </div>
        ))}

        {/* ── Club Match Confirmations ── */}
        {pendingConfirmations?.map(conf => {
          const isDisputing = disputeOpen === conf.id;
          const isProcessing = processing === conf.id;
          const s = conf.stats;

          return (
            <div key={conf.id} className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                      Stats Verification Required &bull; {conf.enteredByRole === 'analyst' ? 'Analyst' : 'Coach'} Entry
                    </p>
                    {s.manOfTheMatch && (
                      <Badge className="bg-amber-400/15 text-amber-500 border-amber-400/30 gap-1 text-[9px] font-black h-4">
                        <Star className="w-2.5 h-2.5" /> MOTM
                      </Badge>
                    )}
                    {s.cleanSheet && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-400/30 text-[9px] font-black h-4">
                        Clean Sheet
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-black uppercase mt-0.5">vs {conf.opponent}</h4>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {conf.date}
                    </span>
                    <Badge variant="secondary" className="text-[8px] h-4 font-bold px-1.5 capitalize">{conf.category}</Badge>
                    <span className="text-[10px] text-muted-foreground">{conf.competition}</span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                <StatPill label="Goals" value={s.goals} highlight={s.goals > 0} />
                <StatPill label="Assists" value={s.assists} highlight={s.assists > 0} />
                <StatPill label="Mins" value={s.minutes} />
                <StatPill label="Rating" value={s.rating.toFixed(1)} highlight={s.rating >= 8} />
                {s.shots > 0 && <StatPill label="Shots" value={s.shots} />}
                {s.duelsWon > 0 && <StatPill label="Duels Won" value={s.duelsWon} />}
                {s.fouls > 0 && <StatPill label="Fouls" value={s.fouls} />}
                {s.saves > 0 && <StatPill label="Saves" value={s.saves} />}
                {s.yellowCards > 0 && (
                  <div className="flex flex-col items-center px-2 py-1.5 rounded-lg bg-yellow-400/10">
                    <span className="text-sm font-black text-yellow-600">{s.yellowCards}</span>
                    <span className="text-[9px] text-yellow-500 font-bold uppercase tracking-wide">Yellows</span>
                  </div>
                )}
                {s.redCards > 0 && (
                  <div className="flex flex-col items-center px-2 py-1.5 rounded-lg bg-red-400/10">
                    <span className="text-sm font-black text-red-600">{s.redCards}</span>
                    <span className="text-[9px] text-red-500 font-bold uppercase tracking-wide">Reds</span>
                  </div>
                )}
              </div>

              {/* Inline dispute field */}
              {isDisputing && (
                <div className="space-y-2 p-3 rounded-xl bg-orange-500/5 border border-orange-400/20">
                  <p className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Describe the discrepancy
                  </p>
                  <Textarea
                    value={disputeNote}
                    onChange={e => setDisputeNote(e.target.value)}
                    placeholder="e.g. I scored 2 goals not 1, I was subbed off at 72 mins not 90…"
                    className="text-sm resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground"
                      onClick={() => { setDisputeOpen(null); setDisputeNote(''); }}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 font-black text-[10px] uppercase border-orange-400/30 text-orange-700 hover:bg-orange-50 gap-1.5"
                      disabled={!disputeNote.trim() || isProcessing}
                      onClick={() => handleFlag(conf)}
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                      Submit Flag
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isDisputing && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="h-9 px-5 font-black uppercase tracking-widest text-[10px] gap-1.5 flex-1 sm:flex-none"
                    onClick={() => handleConfirm(conf)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Looks Correct
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-5 font-black text-[10px] uppercase tracking-widest border-orange-300/40 text-orange-700 hover:bg-orange-50 gap-1.5 flex-1 sm:flex-none"
                    onClick={() => { setDisputeOpen(conf.id); setDisputeNote(''); }}
                    disabled={isProcessing}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Flag Discrepancy
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Pending Stats (unlogged match entries) ── */}
        {pendingStats.map(match => (
          <div key={match.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-orange-50/10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-600">Post-Match Action Required</p>
                <h4 className="text-sm font-black uppercase">Log Stats: {match.competition}</h4>
                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Finalize your performance data to update your CSI score.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="h-9 px-6 font-black uppercase tracking-widest text-[10px] border-orange-200 text-orange-700 hover:bg-orange-50 shrink-0">
              <Link href={`/dashboard/add-match?id=${match.id}`}>
                Log Stats <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Link>
            </Button>
          </div>
        ))}

      </CardContent>
    </Card>
  );
}
