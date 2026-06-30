'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import {
  collection, query, where, orderBy, addDoc, updateDoc, doc,
  getDocs, Timestamp,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, X, Loader2, Target, Users, Calendar, MapPin, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, isPast } from 'date-fns';

const POSITIONS = [
  'Goalkeeper', 'Centre-back', 'Left-back', 'Right-back',
  'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
  'Left Winger', 'Right Winger', 'Striker', 'Any Position',
];

interface Trial {
  id: string;
  clubId: string;
  clubName: string;
  position: string;
  ageMin: number;
  ageMax: number;
  trialDate: string;
  location: string;
  description: string;
  status: 'open' | 'closed';
  applicantCount: number;
  createdAt: string;
  createdBy: string;
}

interface Application {
  id: string;
  athleteId: string;
  athleteName: string;
  athletePosition: string;
  athleteAge?: number;
  appliedAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

function PostTrialForm({ clubId, clubName, onClose }: { clubId: string; clubName: string; onClose: () => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    position: '',
    ageMin: '15',
    ageMax: '35',
    trialDate: '',
    location: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !form.position || !form.trialDate || !form.location) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'club_trials'), {
        clubId,
        clubName,
        position: form.position,
        ageMin: Number(form.ageMin),
        ageMax: Number(form.ageMax),
        trialDate: form.trialDate,
        location: form.location,
        description: form.description.trim(),
        status: 'open',
        applicantCount: 0,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });
      toast({ title: 'Trial posted!', description: `${form.position} trial on ${format(new Date(form.trialDate), 'MMM d, yyyy')} is now visible to all athletes.` });
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to post trial', description: err?.message ?? 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-black">Post an Open Trial</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Position Needed *</label>
                <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Min Age</label>
                <Input type="number" min={13} max={50} value={form.ageMin} onChange={e => setForm(f => ({ ...f, ageMin: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Max Age</label>
                <Input type="number" min={13} max={50} value={form.ageMax} onChange={e => setForm(f => ({ ...f, ageMax: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Trial Date *</label>
                <Input type="datetime-local" value={form.trialDate} onChange={e => setForm(f => ({ ...f, trialDate: e.target.value }))} required />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Location *</label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Kasarani Stadium, Nairobi" required />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What are you looking for? Any requirements, skills, details about the trial format..." rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.position || !form.trialDate || !form.location}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                Post Trial
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ApplicantsModal({ trial, onClose }: { trial: Trial; onClose: () => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;
    getDocs(collection(firestore, 'club_trials', trial.id, 'applications')).then(snap => {
      setApps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Application)));
      setLoading(false);
    });
  }, [firestore, trial.id]);

  const updateStatus = async (appId: string, status: 'accepted' | 'declined') => {
    if (!firestore) return;
    setUpdating(appId);
    try {
      await updateDoc(doc(firestore, 'club_trials', trial.id, 'applications', appId), { status });
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      toast({ title: status === 'accepted' ? 'Application accepted' : 'Application declined' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update', description: 'Please try again.' });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
          <div>
            <CardTitle className="text-base font-black">{trial.position} Applicants</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{trial.clubName} · {format(new Date(trial.trialDate), 'MMM d, yyyy')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : apps.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-10" />
              <p className="text-sm font-bold">No applicants yet</p>
              <p className="text-xs text-muted-foreground mt-1">Athletes will appear here once they apply.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{app.athleteName}</p>
                    <p className="text-[11px] text-muted-foreground">{app.athletePosition}{app.athleteAge ? ` · Age ${app.athleteAge}` : ''}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(app.appliedAt), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {app.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => updateStatus(app.id, 'accepted')} disabled={updating === app.id}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => updateStatus(app.id, 'declined')} disabled={updating === app.id}>
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Badge className={cn('text-[10px]',
                        app.status === 'accepted' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-600 border-red-200'
                      )}>
                        {app.status === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrialsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [viewingTrial, setViewingTrial] = useState<Trial | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const memberQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: memberships } = useCollection<{ clubId: string; id: string }>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const clubRef = useMemoFirebase(() =>
    firestore && clubId ? doc(firestore, 'clubs', clubId) : null,
    [firestore, clubId]
  );

  const trialsQuery = useMemoFirebase(() =>
    firestore && clubId ? query(collection(firestore, 'club_trials'), where('clubId', '==', clubId), orderBy('createdAt', 'desc')) : null,
    [firestore, clubId]
  );
  const { data: trials, isLoading } = useCollection<Trial>(trialsQuery);

  const openTrials = trials?.filter(t => t.status === 'open') ?? [];
  const closedTrials = trials?.filter(t => t.status === 'closed') ?? [];

  const closeTrial = async (trialId: string) => {
    if (!firestore) return;
    setClosing(trialId);
    try {
      await updateDoc(doc(firestore, 'club_trials', trialId), { status: 'closed' });
      toast({ title: 'Trial closed', description: 'Athletes can no longer apply to this trial.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to close trial' });
    } finally {
      setClosing(null);
    }
  };

  const clubName = (memberships as any)?.[0]?.clubName ?? 'Your Club';

  if (!clubId) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="animate-spin mr-2 w-4 h-4" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {showForm && <PostTrialForm clubId={clubId} clubName={clubName} onClose={() => setShowForm(false)} />}
      {viewingTrial && <ApplicantsModal trial={viewingTrial} onClose={() => setViewingTrial(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Open Trials
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Post trial dates so athletes across the platform can discover and apply.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Post Trial
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open Trials', value: openTrials.length, color: 'text-green-500' },
          { label: 'Total Applicants', value: trials?.reduce((s, t) => s + (t.applicantCount ?? 0), 0) ?? 0, color: 'text-primary' },
          { label: 'Closed', value: closedTrials.length, color: 'text-muted-foreground' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className={cn('text-3xl font-black mt-1', stat.color)}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Open trials */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Active Trials</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : openTrials.length === 0 ? (
          <Card className="p-10 text-center">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-10" />
            <p className="font-bold text-sm">No open trials</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Post a trial to start receiving applications from athletes.</p>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Post Your First Trial</Button>
          </Card>
        ) : openTrials.map(trial => {
          const trialDateObj = new Date(trial.trialDate);
          const expired = isPast(trialDateObj);
          return (
            <Card key={trial.id} className={cn('p-4 hover:shadow-md transition-shadow', expired && 'opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-black text-sm">{trial.position}</p>
                    <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200">● Open</Badge>
                    {expired && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">Date passed</Badge>}
                    <Badge variant="outline" className="text-[9px]">Age {trial.ageMin}–{trial.ageMax}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(trialDateObj, 'EEE, MMM d yyyy · h:mm a')}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trial.location}</span>
                  </div>
                  {trial.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{trial.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-col sm:flex-row">
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs gap-1"
                    onClick={() => setViewingTrial(trial)}
                  >
                    <Users className="w-3 h-3" />
                    {trial.applicantCount ?? 0} applicants
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => closeTrial(trial.id)}
                    disabled={closing === trial.id}
                  >
                    {closing === trial.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Close'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Closed trials */}
      {closedTrials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Closed Trials</h2>
          {closedTrials.map(trial => (
            <Card key={trial.id} className="p-4 opacity-60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm">{trial.position}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(trial.trialDate), 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trial.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setViewingTrial(trial)}>
                    <Eye className="w-3 h-3" />{trial.applicantCount ?? 0}
                  </Button>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Closed</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
