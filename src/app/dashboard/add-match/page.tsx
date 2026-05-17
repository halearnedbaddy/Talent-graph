'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft, Trophy, Save, Star, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AthleteProfile, MatchEntry, UserAccount } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';

export default function AddMatchPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingMatchId = searchParams.get('id');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const athleteDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null), [firestore, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<AthleteProfile>(athleteDocRef);

  const existingMatch = pendingMatchId && profile
    ? profile.matchHistory?.find(m => m.id === pendingMatchId) ?? null
    : null;

  const [formData, setFormData] = useState({
    competition: '',
    category: 'league' as MatchEntry['category'],
    opponent: '',
    apps: 1,
    minutes: 90,
    rating: 7.0,
    goals: 0,
    assists: 0,
    shots: 0,
    duelsWon: 0,
    fouls: 0,
    saves: 0,
    yellowCards: 0,
    redCards: 0,
    cleanSheet: false,
    manOfTheMatch: false,
  });

  useEffect(() => {
    if (profile && pendingMatchId) {
      const existing = profile.matchHistory?.find(m => m.id === pendingMatchId);
      if (existing) {
        setFormData({
          competition: existing.competition,
          category: existing.category || 'league',
          opponent: existing.opponent || '',
          apps: existing.apps || 1,
          minutes: existing.minutes || 90,
          rating: existing.rating || 7.0,
          goals: existing.goals || 0,
          assists: existing.assists || 0,
          shots: existing.shots || 0,
          duelsWon: existing.duelsWon || 0,
          fouls: existing.fouls || 0,
          saves: existing.saves || 0,
          yellowCards: existing.yellowCards || 0,
          redCards: existing.redCards || 0,
          cleanSheet: existing.cleanSheet || false,
          manOfTheMatch: existing.manOfTheMatch || false,
        });
      }
    }
  }, [profile, pendingMatchId]);

  const handleSave = async () => {
    if (!athleteDocRef || !profile) return;
    setIsSaving(true);
    try {
      let updatedHistory = [...(profile.matchHistory || [])];

      if (pendingMatchId) {
        updatedHistory = updatedHistory.map(m => m.id === pendingMatchId ? {
          ...m,
          ...formData,
          statsLogged: true,
          updatedAt: new Date().toISOString()
        } : m);
      } else {
        const newMatch: MatchEntry = {
          id: crypto.randomUUID(),
          ...formData,
          isVerified: false,
          updatedAt: new Date().toISOString(),
          statsLogged: true
        };
        updatedHistory.push(newMatch);
      }

      const userDoc = await getDoc(doc(firestore, 'users', user!.uid));
      const newScores = calculateTalentGraphScore({ ...profile, matchHistory: updatedHistory }, userDoc.data() as UserAccount);

      updateDocumentNonBlocking(athleteDocRef, {
        matchHistory: updatedHistory,
        ...newScores,
        updatedAt: new Date().toISOString()
      });

      toast({ title: 'Match Logged', description: 'Your institutional indices have been updated.' });
      router.push('/');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save stats.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isProfileLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>

        <Card className="shadow-2xl border-none">
          <CardHeader className="bg-neutral-900 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>
                  {existingMatch?.clubMatchId
                    ? 'Finalise Club Match Stats'
                    : pendingMatchId
                    ? 'Edit Match Performance'
                    : 'Log Independent Match'}
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  {existingMatch?.clubMatchId
                    ? 'Record your stats for this institutional fixture to update your Talent Graph.'
                    : pendingMatchId
                    ? 'Update your stats for this match. Changes will recalculate your indices.'
                    : 'Record your performance data to update your institutional Talent Graph.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Competition Name</Label>
                <Input
                  placeholder="e.g. National Premier League"
                  value={formData.competition}
                  onChange={e => setFormData({ ...formData, competition: e.target.value })}
                  disabled={!!(existingMatch?.clubMatchId)}
                  className="font-bold h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                <Select value={formData.category || 'league'} onValueChange={(v: any) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="league">League</SelectItem>
                    <SelectItem value="cup">Cup</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opponent</Label>
                <Input
                  placeholder="e.g. Arsenal FC"
                  value={formData.opponent}
                  onChange={e => setFormData({ ...formData, opponent: e.target.value })}
                  className="font-bold h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minutes Played</Label>
                <Input type="number" value={formData.minutes} onChange={e => setFormData({ ...formData, minutes: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Match Rating (1–10)</Label>
                <Input type="number" step="0.1" min="1" max="10" value={formData.rating} onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })} className="font-bold h-10" />
              </div>

              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goals</Label>
                  <Input type="number" value={formData.goals} onChange={e => setFormData({ ...formData, goals: Number(e.target.value) })} className="font-bold h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assists</Label>
                  <Input type="number" value={formData.assists} onChange={e => setFormData({ ...formData, assists: Number(e.target.value) })} className="font-bold h-10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shots</Label>
                <Input type="number" value={formData.shots} onChange={e => setFormData({ ...formData, shots: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duels Won</Label>
                <Input type="number" value={formData.duelsWon} onChange={e => setFormData({ ...formData, duelsWon: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fouls Committed</Label>
                <Input type="number" value={formData.fouls} onChange={e => setFormData({ ...formData, fouls: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saves</Label>
                <Input type="number" value={formData.saves} onChange={e => setFormData({ ...formData, saves: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-orange-600">Yellow Cards</Label>
                <Input type="number" value={formData.yellowCards} onChange={e => setFormData({ ...formData, yellowCards: Number(e.target.value) })} className="font-bold h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-red-600">Red Cards</Label>
                <Input type="number" value={formData.redCards} onChange={e => setFormData({ ...formData, redCards: Number(e.target.value) })} className="font-bold h-10" />
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-6 p-4 bg-muted/30 rounded-xl border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      <Label className="text-[10px] font-black uppercase tracking-widest">Clean Sheet</Label>
                    </div>
                    <p className="text-[9px] text-muted-foreground">No goals conceded</p>
                  </div>
                  <Switch checked={formData.cleanSheet} onCheckedChange={v => setFormData({ ...formData, cleanSheet: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <Label className="text-[10px] font-black uppercase tracking-widest">Man of the Match</Label>
                    </div>
                    <p className="text-[9px] text-muted-foreground">Best player award</p>
                  </div>
                  <Switch checked={formData.manOfTheMatch} onCheckedChange={v => setFormData({ ...formData, manOfTheMatch: v })} />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving || !formData.competition} className="w-full h-12 font-black uppercase tracking-widest">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {pendingMatchId ? 'Sync Club Performance' : 'Append to Career History'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
