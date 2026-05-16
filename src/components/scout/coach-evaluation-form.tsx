'use client';

import { useState } from 'react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { baseMetrics, Metric } from '@/lib/metrics';
import type { AthleteProfile, UserAccount } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';

interface CoachEvaluationFormProps {
  athlete: AthleteProfile;
  scoutId: string;
}

export function CoachEvaluationForm({ athlete, scoutId }: CoachEvaluationFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Coach-only metrics to evaluate - safely filter out any undefined metrics
  const evalMetrics = [
    baseMetrics.coachMatchRating,
    baseMetrics.workRate,
    baseMetrics.pressResistance,
    baseMetrics.defensivePositioning,
    baseMetrics.bigMatchImpact
  ].filter((m): m is Metric => {
      if (!m) return false;
      // Only show if the athlete has some data already, or just show always for scouts
      return !!athlete.uid;
  });

  const [values, setValues] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {};
      evalMetrics.forEach(m => {
          // Double safety check for m being defined
          if (!m) return;
          const history = athlete.rawMetrics?.[m.id];
          if (history && history.length > 0) {
              initial[m.id] = history[history.length - 1].value.toString();
          }
      });
      return initial;
  });

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);

    try {
        const updatedMetrics = { ...athlete.rawMetrics };
        const now = new Date().toISOString();

        evalMetrics.forEach(m => {
            const val = values[m.id];
            if (val) {
                if (!updatedMetrics[m.id]) updatedMetrics[m.id] = [];
                updatedMetrics[m.id].push({
                    value: Number(val),
                    unit: m.unit,
                    measuredAt: now,
                    method: 'tested',
                    verifiedBy: scoutId,
                    verifiedAt: now
                });
            }
        });

        const athleteRef = doc(firestore, 'athletes', athlete.uid);
        const userDoc = await getDoc(doc(firestore, 'users', athlete.uid));
        
        // Recalculate full CSI with new coach ratings
        const scores = calculateTalentGraphScore({ ...athlete, rawMetrics: updatedMetrics }, userDoc.data() as UserAccount);

        updateDocumentNonBlocking(athleteRef, {
            rawMetrics: updatedMetrics,
            ...scores,
            updatedAt: now
        });

        toast({ title: 'Evaluation Saved', description: 'Athlete institutional indices updated.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save evaluation.' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Institutional Evaluation
        </CardTitle>
        <CardDescription>
          Provide professional ratings for intangible and tactical metrics. This directly impacts the athlete's CSI score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {evalMetrics.map(metric => (
            <div key={metric.id} className="space-y-2">
              <Label htmlFor={metric.id} className="text-xs font-black uppercase tracking-tight">{metric.name}</Label>
              <div className="relative">
                <Input
                  id={metric.id}
                  type="number"
                  placeholder={`Range: ${metric.validation.min}-${metric.validation.max}`}
                  value={values[metric.id] || ''}
                  onChange={e => setValues({ ...values, [metric.id]: e.target.value })}
                  className="h-9 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                  {metric.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          Submit Professional Rating
        </Button>
      </CardContent>
    </Card>
  );
}