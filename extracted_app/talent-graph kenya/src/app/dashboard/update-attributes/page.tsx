'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Save, GitGraph } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ATTRIBUTE_LIST } from '@/lib/metrics';
import type { AthleteProfile, AttributeScores } from '@/lib/types';

export default function UpdateAttributesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const athleteDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null), [firestore, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<AthleteProfile>(athleteDocRef);

  const [scores, setScores] = useState<AttributeScores>({
    Technical: {},
    Mental: {},
    Physical: {}
  });

  useEffect(() => {
    if (profile?.detailedAttributes) {
      setScores(profile.detailedAttributes);
    }
  }, [profile]);

  const handleSliderChange = (category: keyof AttributeScores, attr: string, value: number[]) => {
    setScores(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [attr]: value[0]
      }
    }));
  };

  const handleSave = async () => {
    if (!athleteDocRef) return;
    setIsSaving(true);
    try {
      updateDocumentNonBlocking(athleteDocRef, {
        detailedAttributes: scores,
        updatedAt: new Date().toISOString()
      });
      toast({ title: 'Attributes Updated', description: 'Your tactical profile has been synced.' });
      router.push('/');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update attributes.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isProfileLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>

        <Card className="shadow-2xl border-none">
          <CardHeader className="bg-neutral-950 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <GitGraph className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Refine Tactical Attributes</CardTitle>
                <CardDescription className="text-neutral-400">Rate yourself on a scale of 1-10 across 35+ professional criteria.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="Technical" className="w-full">
              <TabsList className="grid grid-cols-3 mb-8">
                <TabsTrigger value="Technical">Technical</TabsTrigger>
                <TabsTrigger value="Mental">Mental</TabsTrigger>
                <TabsTrigger value="Physical">Physical</TabsTrigger>
              </TabsList>

              {(Object.keys(ATTRIBUTE_LIST) as Array<keyof typeof ATTRIBUTE_LIST>).map(category => (
                <TabsContent key={category} value={category} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {ATTRIBUTE_LIST[category].map(attr => (
                      <div key={attr} className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold text-xs uppercase tracking-widest">{attr}</Label>
                          <span className="text-lg font-black text-primary">{scores[category][attr] || 5}</span>
                        </div>
                        <Slider 
                          defaultValue={[scores[category][attr] || 5]} 
                          max={10} 
                          min={1} 
                          step={1} 
                          onValueChange={(val) => handleSliderChange(category, attr, val)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-12 pt-8 border-t flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} size="lg" className="px-8 font-black uppercase tracking-widest">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sync Attributes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}