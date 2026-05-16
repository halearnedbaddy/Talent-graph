
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { positionalMetrics, Metric } from '@/lib/metrics';
import { MetricCard } from '@/components/onboarding/metric-card';
import { AthleteProfile, UserAccount } from '@/lib/types';
import { calculateTalentGraphScore } from '@/lib/scoring-calculator';

export default function MetricsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [athleteMetrics, setAthleteMetrics] = useState<Metric[]>([]);
  
  const athleteDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: athleteProfile, isLoading: isAthleteProfileLoading } = useDoc<AthleteProfile>(athleteDocRef);

  const formSchema = useMemo(() => {
    if (athleteMetrics.length === 0) return z.object({});
    
    const schemaShape = athleteMetrics.reduce((acc, metric) => {
      let validator: any = z.coerce.number()
        .min(metric.validation.min, `Value must be at least ${metric.validation.min}.`)
        .max(metric.validation.max, `Value cannot exceed ${metric.validation.max}.`);
      
      if (!metric.required) {
        validator = z.union([z.literal(''), validator.optional()]).transform(val => val === '' ? undefined : val);
      }
      
      acc[metric.id] = validator;
      return acc;
    }, {} as Record<string, any>);

    return z.object(schemaShape);
  }, [athleteMetrics]);

  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
    
    if (athleteProfile && !isAthleteProfileLoading) {
        if (athleteProfile.sport && athleteProfile.position) {
            const sportMetrics = positionalMetrics[athleteProfile.sport];
            const allPositionalMetrics = sportMetrics?.[athleteProfile.position] || sportMetrics?.['default'] || [];
            
            // FILTER: Only show metrics that athletes are allowed to input
            const filteredMetrics = allPositionalMetrics.filter(m => m.athleteInput);
            
            setAthleteMetrics(filteredMetrics);
            form.reset({});
        } else {
            router.push('/onboarding');
        }
    }
  }, [user, isUserLoading, athleteProfile, isAthleteProfileLoading, router, form]);

  const handleSkip = async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    const userDocRefToUpdate = doc(firestore, 'users', user.uid);
    await setDoc(userDocRefToUpdate, { profileCompleted: true, onboardingStep: 'metrics_skipped' }, { merge: true });
    router.push('/');
  }

  const onSubmit = async (values: any) => {
    if (!user || !firestore || !athleteProfile) return;
    setIsLoading(true);

    try {
        const existingMetrics = athleteProfile.rawMetrics || {};
        const newMetricsPayload = { ...existingMetrics };

        for (const metric of athleteMetrics) {
            const value = values[metric.id];
            if (value !== undefined && value !== null && value !== '') {
                const newEntry = {
                    value: Number(value),
                    unit: metric.unit,
                    measuredAt: new Date().toISOString(),
                    method: "self-reported" as const,
                };
                if (!newMetricsPayload[metric.id]) newMetricsPayload[metric.id] = [];
                newMetricsPayload[metric.id].push(newEntry);
            }
        }
        
        const updatedAthleteProfile = { ...athleteProfile, rawMetrics: newMetricsPayload };
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const scores = calculateTalentGraphScore(updatedAthleteProfile, userDoc.data() as UserAccount);

        const athleteDocRefToUpdate = doc(firestore, 'athletes', user.uid);
        await setDoc(athleteDocRefToUpdate, { rawMetrics: newMetricsPayload, ...scores }, { merge: true });
        await setDoc(userDocRef, { profileCompleted: true, onboardingStep: 'metrics_completed' }, { merge: true });

        router.push('/');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save metrics.' });
    } finally {
        setIsLoading(false);
    }
  };
  
  if (isUserLoading || isAthleteProfileLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold">Performance Baseline</h1>
                <p className="mt-2 text-lg text-muted-foreground capitalize">
                    Enter your technical stats for {athleteProfile?.position} ({athleteProfile?.sport}).
                </p>
            </div>

            <Alert className="mb-8 border-primary/20 bg-primary/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-semibold">Self-Reported Stats</AlertTitle>
                <AlertDescription>
                    These metrics will be marked as "Self-Reported" until verified by a verified scout or organization.
                </AlertDescription>
            </Alert>
            
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {athleteMetrics.map((metric) => (
                            <MetricCard key={metric.id} metric={metric} />
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
                         <Button type="button" variant="ghost" onClick={handleSkip} disabled={isLoading}>Skip for now</Button>
                        <Button type="submit" disabled={isLoading} size="lg">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save & Finish Profile
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
      </main>
    </div>
  );
}
