'use client';

import { useState } from 'react';
import { AthleteProfile, InjuryRecord, PreviousTeam } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, AlertTriangle, Building2, MapPin, Calendar, Activity, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  moderate: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  major: 'bg-red-500/10 text-red-700 border-red-500/20',
};

interface CareerHistoryCardProps {
  profile: AthleteProfile;
}

export function CareerHistoryCard({ profile }: CareerHistoryCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [injuryDialog, setInjuryDialog] = useState(false);
  const [teamDialog, setTeamDialog] = useState(false);
  const [editingInjury, setEditingInjury] = useState<InjuryRecord | null>(null);
  const [editingTeam, setEditingTeam] = useState<PreviousTeam | null>(null);

  const [injuryForm, setInjuryForm] = useState<Omit<InjuryRecord, 'id'>>({
    type: '',
    bodyPart: '',
    severity: 'minor',
    dateOccurred: new Date().toISOString().split('T')[0],
    recoveryDate: '',
    notes: '',
  });

  const [teamForm, setTeamForm] = useState<Omit<PreviousTeam, 'id'>>({
    teamName: '',
    country: '',
    league: '',
    role: '',
    from: '',
    to: '',
    appearances: 0,
    goals: 0,
    assists: 0,
  });

  const athleteRef = useMemoFirebase(
    () => (firestore && profile.uid ? doc(firestore, 'athletes', profile.uid) : null),
    [firestore, profile.uid]
  );

  const openAddInjury = () => {
    setEditingInjury(null);
    setInjuryForm({ type: '', bodyPart: '', severity: 'minor', dateOccurred: new Date().toISOString().split('T')[0], recoveryDate: '', notes: '' });
    setInjuryDialog(true);
  };

  const openEditInjury = (inj: InjuryRecord) => {
    setEditingInjury(inj);
    setInjuryForm({ type: inj.type, bodyPart: inj.bodyPart, severity: inj.severity, dateOccurred: inj.dateOccurred, recoveryDate: inj.recoveryDate || '', notes: inj.notes || '' });
    setInjuryDialog(true);
  };

  const openAddTeam = () => {
    setEditingTeam(null);
    setTeamForm({ teamName: '', country: '', league: '', role: '', from: '', to: '', appearances: 0, goals: 0, assists: 0 });
    setTeamDialog(true);
  };

  const openEditTeam = (team: PreviousTeam) => {
    setEditingTeam(team);
    setTeamForm({ teamName: team.teamName, country: team.country, league: team.league || '', role: team.role, from: team.from, to: team.to || '', appearances: team.appearances || 0, goals: team.goals || 0, assists: team.assists || 0 });
    setTeamDialog(true);
  };

  const saveInjury = async () => {
    if (!athleteRef || !injuryForm.type || !injuryForm.bodyPart) return;
    setIsSaving(true);
    try {
      const existing = profile.injuryHistory || [];
      let updated: InjuryRecord[];
      if (editingInjury) {
        updated = existing.map(i => i.id === editingInjury.id ? { ...editingInjury, ...injuryForm } : i);
      } else {
        updated = [...existing, { id: crypto.randomUUID(), ...injuryForm }];
      }
      await updateDoc(athleteRef, { injuryHistory: updated, updatedAt: new Date().toISOString() });
      toast({ title: 'Injury record saved' });
      setInjuryDialog(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteInjury = async (id: string) => {
    if (!athleteRef) return;
    const updated = (profile.injuryHistory || []).filter(i => i.id !== id);
    await updateDoc(athleteRef, { injuryHistory: updated, updatedAt: new Date().toISOString() });
    toast({ title: 'Record removed' });
  };

  const saveTeam = async () => {
    if (!athleteRef || !teamForm.teamName || !teamForm.from) return;
    setIsSaving(true);
    try {
      const existing = profile.previousTeams || [];
      let updated: PreviousTeam[];
      if (editingTeam) {
        updated = existing.map(t => t.id === editingTeam.id ? { ...editingTeam, ...teamForm } : t);
      } else {
        updated = [...existing, { id: crypto.randomUUID(), ...teamForm }];
      }
      await updateDoc(athleteRef, { previousTeams: updated, updatedAt: new Date().toISOString() });
      toast({ title: 'Team record saved' });
      setTeamDialog(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTeam = async (id: string) => {
    if (!athleteRef) return;
    const updated = (profile.previousTeams || []).filter(t => t.id !== id);
    await updateDoc(athleteRef, { previousTeams: updated, updatedAt: new Date().toISOString() });
    toast({ title: 'Record removed' });
  };

  return (
    <>
      <Card className="shadow-lg border-none">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase tracking-widest">Career History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="injuries">
            <TabsList className="bg-muted/50 p-1 mb-6">
              <TabsTrigger value="injuries" className="text-[10px] font-black uppercase tracking-widest gap-2">
                <AlertTriangle className="w-3 h-3" /> Injury History
              </TabsTrigger>
              <TabsTrigger value="teams" className="text-[10px] font-black uppercase tracking-widest gap-2">
                <Building2 className="w-3 h-3" /> Previous Teams
              </TabsTrigger>
            </TabsList>

            <TabsContent value="injuries" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={openAddInjury} className="h-8 text-[10px] font-black uppercase tracking-widest gap-2">
                  <Plus className="w-3 h-3" /> Log Injury
                </Button>
              </div>
              {(profile.injuryHistory || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Activity className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">No injury records</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(profile.injuryHistory || []).sort((a, b) => b.dateOccurred.localeCompare(a.dateOccurred)).map(inj => (
                    <div key={inj.id} className="flex items-start justify-between p-4 bg-muted/30 rounded-xl border">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm uppercase">{inj.type}</p>
                          <Badge className={`text-[9px] font-black uppercase border ${SEVERITY_COLORS[inj.severity]}`}>{inj.severity}</Badge>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{inj.bodyPart}</p>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {inj.dateOccurred}</span>
                          {inj.recoveryDate && <span>Recovery: {inj.recoveryDate}</span>}
                        </div>
                        {inj.notes && <p className="text-xs text-muted-foreground italic mt-1">{inj.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditInjury(inj)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteInjury(inj.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="teams" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={openAddTeam} className="h-8 text-[10px] font-black uppercase tracking-widest gap-2">
                  <Plus className="w-3 h-3" /> Add Club
                </Button>
              </div>
              {(profile.previousTeams || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Building2 className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">No previous clubs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(profile.previousTeams || []).sort((a, b) => b.from.localeCompare(a.from)).map(team => (
                    <div key={team.id} className="flex items-start justify-between p-4 bg-muted/30 rounded-xl border">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-sm uppercase">{team.teamName}</p>
                          <Badge variant="outline" className="text-[9px] font-black uppercase">{team.role}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {team.country}</span>
                          {team.league && <span>{team.league}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {team.from} – {team.to || 'Present'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black mt-1">
                          {team.appearances !== undefined && <span className="text-muted-foreground">{team.appearances} Apps</span>}
                          {team.goals !== undefined && <span className="text-primary">{team.goals} Goals</span>}
                          {team.assists !== undefined && <span className="text-muted-foreground">{team.assists} Assists</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTeam(team)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTeam(team.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={injuryDialog} onOpenChange={setInjuryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest">{editingInjury ? 'Edit' : 'Log'} Injury</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Injury Type</Label>
                <Input value={injuryForm.type} onChange={e => setInjuryForm({ ...injuryForm, type: e.target.value })} placeholder="e.g. Hamstring Strain" className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Body Part</Label>
                <Input value={injuryForm.bodyPart} onChange={e => setInjuryForm({ ...injuryForm, bodyPart: e.target.value })} placeholder="e.g. Left Hamstring" className="font-bold h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Severity</Label>
              <Select value={injuryForm.severity} onValueChange={(v: any) => setInjuryForm({ ...injuryForm, severity: v })}>
                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date Occurred</Label>
                <Input type="date" value={injuryForm.dateOccurred} onChange={e => setInjuryForm({ ...injuryForm, dateOccurred: e.target.value })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recovery Date</Label>
                <Input type="date" value={injuryForm.recoveryDate || ''} onChange={e => setInjuryForm({ ...injuryForm, recoveryDate: e.target.value })} className="font-bold h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea value={injuryForm.notes || ''} onChange={e => setInjuryForm({ ...injuryForm, notes: e.target.value })} placeholder="Additional details..." className="font-bold resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInjuryDialog(false)}>Cancel</Button>
            <Button onClick={saveInjury} disabled={isSaving || !injuryForm.type} className="font-black uppercase tracking-widest">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest">{editingTeam ? 'Edit' : 'Add'} Previous Club</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Club / Team Name</Label>
                <Input value={teamForm.teamName} onChange={e => setTeamForm({ ...teamForm, teamName: e.target.value })} placeholder="e.g. Nairobi City Stars" className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Country</Label>
                <Input value={teamForm.country} onChange={e => setTeamForm({ ...teamForm, country: e.target.value })} placeholder="Kenya" className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">League</Label>
                <Input value={teamForm.league || ''} onChange={e => setTeamForm({ ...teamForm, league: e.target.value })} placeholder="Premier League" className="font-bold h-9" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role / Position</Label>
                <Input value={teamForm.role} onChange={e => setTeamForm({ ...teamForm, role: e.target.value })} placeholder="e.g. Starting Forward" className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From</Label>
                <Input type="month" value={teamForm.from} onChange={e => setTeamForm({ ...teamForm, from: e.target.value })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To (leave blank if current)</Label>
                <Input type="month" value={teamForm.to || ''} onChange={e => setTeamForm({ ...teamForm, to: e.target.value })} className="font-bold h-9" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Appearances</Label>
                <Input type="number" value={teamForm.appearances || 0} onChange={e => setTeamForm({ ...teamForm, appearances: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goals</Label>
                <Input type="number" value={teamForm.goals || 0} onChange={e => setTeamForm({ ...teamForm, goals: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assists</Label>
                <Input type="number" value={teamForm.assists || 0} onChange={e => setTeamForm({ ...teamForm, assists: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialog(false)}>Cancel</Button>
            <Button onClick={saveTeam} disabled={isSaving || !teamForm.teamName} className="font-black uppercase tracking-widest">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Club'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
