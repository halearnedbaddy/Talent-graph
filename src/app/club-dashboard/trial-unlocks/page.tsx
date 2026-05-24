'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Unlock, Clock, CheckCircle2, XCircle, Plus,
  User, Calendar, TrendingUp, Shield, Search, AlertTriangle, Star
} from 'lucide-react';
import type { ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO, addDays, isPast } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface TrialUnlock {
  id: string;
  clubId: string;
  athleteId: string;
  athleteName: string;
  athletePosition?: string;
  athletePhotoUrl?: string;
  scoutName?: string;
  unlockedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'signed' | 'not_signed';
  outcome?: 'signed' | 'not_signed';
  outcomeNotes?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  amountKes: number;
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-muted/50 text-muted-foreground border-border', icon: Clock },
  signed: { label: 'Signed!', color: 'bg-primary/10 text-primary border-primary/30', icon: Star },
  not_signed: { label: 'Not Signed', color: 'bg-red-500/10 text-red-600 border-red-200', icon: XCircle },
};

export default function TrialUnlocksPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [clubId, setClubId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [outcomingId, setOutcomingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [newUnlock, setNewUnlock] = useState({
    athleteName: '',
    athletePosition: '',
    scoutName: '',
    trialStartDate: '',
    trialEndDate: '',
    notes: '',
  });

  const myMembershipQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: myMemberships } = useCollection<ClubMember>(myMembershipQuery);

  useEffect(() => {
    if (myMemberships?.[0]?.clubId) setClubId(myMemberships[0].clubId);
  }, [myMemberships]);

  const trialsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'trial_unlocks'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: trials, isLoading } = useCollection<TrialUnlock>(trialsQuery);

  const sortedTrials = [...(trials || [])].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));

  const filtered = sortedTrials.filter(t => {
    const matchesSearch = !searchQuery || t.athleteName.toLowerCase().includes(searchQuery.toLowerCase());
    const effectiveStatus = isPast(parseISO(t.expiresAt)) && t.status === 'active' ? 'expired' : t.status;
    const matchesStatus = filterStatus === 'all' || effectiveStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: trials?.length || 0,
    active: trials?.filter(t => t.status === 'active' && !isPast(parseISO(t.expiresAt))).length || 0,
    signed: trials?.filter(t => t.status === 'signed').length || 0,
    totalSpend: (trials?.length || 0) * 3500,
  };

  const handleAddUnlock = async () => {
    if (!firestore || !clubId || !newUnlock.athleteName) return;
    setIsAdding(true);
    try {
      const now = new Date();
      const expires = addDays(now, 14);
      await addDoc(collection(firestore, 'trial_unlocks'), {
        clubId,
        athleteId: '',
        athleteName: newUnlock.athleteName,
        athletePosition: newUnlock.athletePosition,
        scoutName: newUnlock.scoutName,
        trialStartDate: newUnlock.trialStartDate,
        trialEndDate: newUnlock.trialEndDate,
        outcomeNotes: newUnlock.notes,
        unlockedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        status: 'active',
        amountKes: 3500,
      });
      toast({ title: 'Trial unlock recorded', description: '14-day trial period started.' });
      setIsAddOpen(false);
      setNewUnlock({ athleteName: '', athletePosition: '', scoutName: '', trialStartDate: '', trialEndDate: '', notes: '' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to record trial unlock.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetOutcome = async (trialId: string, outcome: 'signed' | 'not_signed') => {
    if (!firestore) return;
    setOutcomingId(trialId);
    try {
      await updateDoc(doc(firestore, 'trial_unlocks', trialId), {
        status: outcome,
        outcome,
        outcomeUpdatedAt: new Date().toISOString(),
      });
      toast({ title: outcome === 'signed' ? 'Great news! Athlete signed.' : 'Outcome logged.', description: outcome === 'signed' ? 'The trial converted to a signing!' : 'Trial outcome recorded as not signed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update outcome.' });
    } finally {
      setOutcomingId(null);
    }
  };

  if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Trial Unlocks</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Athlete trial periods · KES 3,500 per unlock
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="font-black uppercase tracking-widest h-11 min-h-[44px] gap-2">
              <Plus className="h-4 w-4" /> New Trial Unlock
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-widest">Record Trial Unlock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Athlete Name *</Label>
                <Input
                  value={newUnlock.athleteName}
                  onChange={e => setNewUnlock(f => ({ ...f, athleteName: e.target.value }))}
                  placeholder="e.g. James Otieno"
                  className="h-11 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Position</Label>
                  <Select value={newUnlock.athletePosition || 'none'} onValueChange={v => setNewUnlock(f => ({ ...f, athletePosition: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Position" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select</SelectItem>
                      {['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'].map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Scout / Source</Label>
                  <Input
                    value={newUnlock.scoutName}
                    onChange={e => setNewUnlock(f => ({ ...f, scoutName: e.target.value }))}
                    placeholder="Scout name"
                    className="h-11 font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Trial Start</Label>
                  <Input
                    type="date"
                    value={newUnlock.trialStartDate}
                    onChange={e => setNewUnlock(f => ({ ...f, trialStartDate: e.target.value }))}
                    className="h-11 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Trial End</Label>
                  <Input
                    type="date"
                    value={newUnlock.trialEndDate}
                    onChange={e => setNewUnlock(f => ({ ...f, trialEndDate: e.target.value }))}
                    className="h-11 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Notes</Label>
                <Textarea
                  value={newUnlock.notes}
                  onChange={e => setNewUnlock(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes about this trial..."
                  className="font-bold resize-none"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <p className="text-[11px] font-bold text-muted-foreground">
                  Trial unlock fee: <span className="text-primary font-black">KES 3,500</span> · 14-day trial period included
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 font-bold" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 font-black uppercase tracking-widest"
                  onClick={handleAddUnlock}
                  disabled={isAdding || !newUnlock.athleteName}
                >
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                  Record Unlock
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Unlocks', value: stats.total, color: 'text-foreground', sub: 'all time' },
          { label: 'Active Trials', value: stats.active, color: 'text-green-600', sub: 'in progress' },
          { label: 'Signed', value: stats.signed, color: 'text-primary', sub: 'converted' },
          { label: 'Total Spend', value: `KES ${stats.totalSpend.toLocaleString()}`, color: 'text-amber-600', sub: 'KES 3,500 each' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-background">
            <CardContent className="p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-widest">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search athlete..."
            className="h-11 pl-9 font-bold"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-11 font-bold w-full sm:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="not_signed">Not Signed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trial List */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Unlock className="h-4 w-4 text-primary" /> Trial Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Unlock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-black text-muted-foreground uppercase tracking-widest text-sm">No trial unlocks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Record your first trial unlock above.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(trial => {
                const effectiveStatus = isPast(parseISO(trial.expiresAt)) && trial.status === 'active' ? 'expired' : trial.status;
                const config = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.expired;
                const daysLeft = !isPast(parseISO(trial.expiresAt))
                  ? Math.ceil((parseISO(trial.expiresAt).getTime() - Date.now()) / 86400000)
                  : 0;

                return (
                  <div key={trial.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-11 w-11 rounded-xl shrink-0">
                          <AvatarImage src={trial.athletePhotoUrl} />
                          <AvatarFallback className="rounded-xl bg-muted font-black text-sm">
                            {trial.athleteName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-sm">{trial.athleteName}</p>
                            {trial.athletePosition && (
                              <Badge variant="outline" className="font-black text-[9px] h-5">{trial.athletePosition}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <Badge className={`font-black text-[9px] border ${config.color}`}>
                              <config.icon className="h-2.5 w-2.5 mr-1" />
                              {config.label}
                            </Badge>
                            {effectiveStatus === 'active' && daysLeft > 0 && (
                              <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" /> {daysLeft} days left
                              </span>
                            )}
                            {trial.scoutName && (
                              <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                                <User className="h-2.5 w-2.5" /> {trial.scoutName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap text-[9px] text-muted-foreground font-bold">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              Unlocked {formatDistanceToNow(parseISO(trial.unlockedAt), { addSuffix: true })}
                            </span>
                            <span>· KES {trial.amountKes.toLocaleString()}</span>
                          </div>
                          {trial.trialStartDate && trial.trialEndDate && (
                            <p className="text-[9px] font-bold text-muted-foreground mt-0.5">
                              Trial: {trial.trialStartDate} → {trial.trialEndDate}
                            </p>
                          )}
                          {trial.outcomeNotes && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">"{trial.outcomeNotes}"</p>
                          )}
                        </div>
                      </div>
                      {effectiveStatus === 'active' && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="h-9 bg-green-600 hover:bg-green-700 text-white font-black text-xs gap-1"
                            onClick={() => handleSetOutcome(trial.id, 'signed')}
                            disabled={outcomingId === trial.id}
                          >
                            {outcomingId === trial.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                            Signed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 font-black text-xs gap-1 text-muted-foreground"
                            onClick={() => handleSetOutcome(trial.id, 'not_signed')}
                            disabled={outcomingId === trial.id}
                          >
                            <XCircle className="h-3 w-3" /> Not Signed
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-200/50">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-amber-700 dark:text-amber-400">Trial Unlock Terms</p>
          <p className="text-[11px] text-muted-foreground mt-1">Each trial unlock is KES 3,500 and grants a 14-day trial window. Insurance coverage for trial periods is subject to partnership confirmation. Log outcomes to track your conversion rate.</p>
        </div>
      </div>
    </div>
  );
}
