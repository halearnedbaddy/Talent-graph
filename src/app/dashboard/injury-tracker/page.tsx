'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Loader2, Plus, ArrowLeft, Shield, AlertTriangle, CheckCircle2,
  Trash2, Edit3, Activity, Calendar, Clock, Zap
} from 'lucide-react';
import type { AthleteProfile, InjuryRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO, isPast } from 'date-fns';

const BODY_PARTS = [
  'Head/Concussion', 'Neck', 'Shoulder', 'Collarbone', 'Upper Arm', 'Elbow',
  'Forearm', 'Wrist', 'Hand/Fingers', 'Chest/Ribs', 'Back (Upper)',
  'Back (Lower)', 'Abdomen/Core', 'Hip/Groin', 'Thigh (Quad)',
  'Thigh (Hamstring)', 'Knee (Ligament)', 'Knee (Meniscus)', 'Knee (General)',
  'Shin', 'Calf', 'Achilles', 'Ankle', 'Foot', 'Toe'
];

const INJURY_TYPES = [
  'Muscle Strain', 'Muscle Tear', 'Ligament Sprain', 'Ligament Tear (ACL/MCL)',
  'Fracture', 'Dislocation', 'Tendinitis', 'Bruising/Contusion',
  'Cartilage Damage', 'Stress Fracture', 'Concussion', 'Overuse Injury', 'Other'
];

const SEVERITY_CONFIG = {
  minor: { label: 'Minor', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-300', desc: 'Expected recovery: 1–2 weeks' },
  moderate: { label: 'Moderate', color: 'bg-orange-500/10 text-orange-700 border-orange-300', desc: 'Expected recovery: 2–6 weeks' },
  major: { label: 'Major', color: 'bg-red-500/10 text-red-700 border-red-300', desc: 'Expected recovery: 6+ weeks' },
};

const DEFAULT_FORM: Omit<InjuryRecord, 'id'> = {
  type: '',
  bodyPart: '',
  severity: 'minor',
  dateOccurred: '',
  recoveryDate: '',
  notes: '',
};

export default function InjuryTrackerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<InjuryRecord, 'id'>>(DEFAULT_FORM);

  const athleteRef = useMemoFirebase(() => (
    firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null
  ), [firestore, user?.uid]);
  const { data: profile, isLoading } = useDoc<AthleteProfile>(athleteRef);

  const injuries = [...(profile?.injuryHistory || [])].sort((a, b) =>
    b.dateOccurred.localeCompare(a.dateOccurred)
  );

  const activeInjuries = injuries.filter(i => !i.recoveryDate || !isPast(parseISO(i.recoveryDate + 'T23:59:59')));
  const resolvedInjuries = injuries.filter(i => i.recoveryDate && isPast(parseISO(i.recoveryDate + 'T23:59:59')));

  const openAdd = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const openEdit = (injury: InjuryRecord) => {
    setEditingId(injury.id);
    setForm({
      type: injury.type,
      bodyPart: injury.bodyPart,
      severity: injury.severity,
      dateOccurred: injury.dateOccurred,
      recoveryDate: injury.recoveryDate || '',
      notes: injury.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !user || !profile) return;
    if (!form.type || !form.bodyPart || !form.dateOccurred) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in the injury type, body part and date.' });
      return;
    }
    setIsSaving(true);
    try {
      const existing = profile.injuryHistory || [];
      let updated: InjuryRecord[];
      if (editingId) {
        updated = existing.map(i => i.id === editingId ? { ...form, id: editingId } : i);
      } else {
        const newInjury: InjuryRecord = { ...form, id: `injury_${Date.now()}` };
        updated = [...existing, newInjury];
      }
      await updateDoc(doc(firestore, 'athletes', user.uid), {
        injuryHistory: updated,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: editingId ? 'Injury updated' : 'Injury logged', description: 'Your injury history has been saved.' });
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save injury record.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !user || !profile || !deleteId) return;
    setIsDeleting(true);
    try {
      const updated = (profile.injuryHistory || []).filter(i => i.id !== deleteId);
      await updateDoc(doc(firestore, 'athletes', user.uid), {
        injuryHistory: updated,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Injury record removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete record.' });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const InjuryCard = ({ injury }: { injury: InjuryRecord }) => {
    const config = SEVERITY_CONFIG[injury.severity];
    const isActive = !injury.recoveryDate || !isPast(parseISO(injury.recoveryDate + 'T23:59:59'));
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border bg-background hover:bg-muted/20 transition-colors">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${config.color} border`}>
          <Shield className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-black text-sm">{injury.type}</p>
              <p className="text-xs text-muted-foreground">{injury.bodyPart}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={`font-black text-[9px] border capitalize ${config.color}`}>
                {config.label}
              </Badge>
              <Badge variant={isActive ? 'default' : 'secondary'} className="font-black text-[9px]">
                {isActive ? 'Active' : 'Resolved'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-muted-foreground font-bold">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Occurred: {injury.dateOccurred}
            </span>
            {injury.recoveryDate && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                Recovery: {injury.recoveryDate}
              </span>
            )}
          </div>
          {injury.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">"{injury.notes}"</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(injury)}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(injury.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-8">
      <header className="bg-background border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <h1 className="text-sm font-black uppercase tracking-widest truncate">Injury Tracker</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="font-black uppercase tracking-widest gap-1.5 h-9" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" /> Log Injury
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-widest">
                  {editingId ? 'Edit Injury Record' : 'Log New Injury'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Injury Type *</Label>
                    <Select value={form.type || 'none'} onValueChange={v => setForm(f => ({ ...f, type: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select type</SelectItem>
                        {INJURY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Body Part *</Label>
                    <Select value={form.bodyPart || 'none'} onValueChange={v => setForm(f => ({ ...f, bodyPart: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select part" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select part</SelectItem>
                        {BODY_PARTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Severity *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['minor', 'moderate', 'major'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, severity: s }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.severity === s ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
                        }`}
                      >
                        <p className="font-black text-xs capitalize">{s}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{SEVERITY_CONFIG[s].desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Date Occurred *</Label>
                    <Input
                      type="date"
                      value={form.dateOccurred}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm(f => ({ ...f, dateOccurred: e.target.value }))}
                      className="h-11 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Expected Recovery</Label>
                    <Input
                      type="date"
                      value={form.recoveryDate}
                      onChange={e => setForm(f => ({ ...f, recoveryDate: e.target.value }))}
                      className="h-11 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="How did the injury happen? Treatment being received..."
                    className="font-bold resize-none"
                    rows={3}
                    maxLength={300}
                  />
                  <p className="text-[9px] text-muted-foreground text-right">{(form.notes || '').length}/300</p>
                </div>

                {form.severity === 'major' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-700 font-bold">Major injuries will mark you as unavailable in your club's squad readiness board.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 font-bold" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button className="flex-1 font-black uppercase tracking-widest" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingId ? 'Update Record' : 'Log Injury'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-3xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: injuries.length, icon: Shield, color: 'text-foreground' },
            { label: 'Active', value: activeInjuries.length, icon: AlertTriangle, color: activeInjuries.length > 0 ? 'text-red-600' : 'text-muted-foreground' },
            { label: 'Resolved', value: resolvedInjuries.length, icon: CheckCircle2, color: 'text-green-600' },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm bg-background">
              <CardContent className="p-4 text-center">
                <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Impact card */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Activity className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black">How injuries affect your profile</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active injuries influence your Squad Readiness score and risk index. Major injuries mark you as Unavailable. Resolved injuries improve your availability status automatically.</p>
          </div>
        </div>

        {/* Active Injuries */}
        {activeInjuries.length > 0 && (
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-red-500/5 border-b border-red-200/50 py-3 px-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" /> Active Injuries
                <Badge className="bg-red-500 text-white font-black text-[9px]">{activeInjuries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {activeInjuries.map(injury => <InjuryCard key={injury.id} injury={injury} />)}
            </CardContent>
          </Card>
        )}

        {/* No active injuries */}
        {activeInjuries.length === 0 && (
          <Card className="border-none shadow-sm bg-background overflow-hidden">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-black text-green-700 uppercase tracking-widest text-sm">No Active Injuries</p>
              <p className="text-xs text-muted-foreground mt-1">You're fit and available — great for your squad readiness score.</p>
            </CardContent>
          </Card>
        )}

        {/* Injury History */}
        {resolvedInjuries.length > 0 && (
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-muted/50 border-b py-3 px-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Injury History
                <Badge variant="secondary" className="font-black text-[9px]">{resolvedInjuries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {resolvedInjuries.map(injury => <InjuryCard key={injury.id} injury={injury} />)}
            </CardContent>
          </Card>
        )}

        {injuries.length === 0 && (
          <Card className="border-none shadow-sm bg-background">
            <CardContent className="p-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-black text-muted-foreground uppercase tracking-widest text-sm">No injuries logged</p>
              <p className="text-xs text-muted-foreground mt-1">Log injuries to keep your squad readiness score accurate.</p>
              <Button size="sm" className="mt-4 font-black gap-2" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" /> Log First Injury
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Injury Record?</AlertDialogTitle>
            <AlertDialogDescription>This injury record will be permanently deleted from your profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
