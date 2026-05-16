
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AthleteProfile } from '@/lib/types';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
// TODO: Create and import the actual AI flow.
// import { generateScoutSummary } from '@/ai/flows/scout-summary-flow';


// Mock function until the actual AI flow is created
async function generateScoutSummary(athlete: AthleteProfile): Promise<{ summary: string, version: string }> {
    console.log("Generating summary for:", athlete);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
        summary: `Executive Snapshot:
A developmental prospect with a strong acceleration profile (85) but a notable power deficit (45). Shows potential if strength can be improved.

Athletic Strengths:
- Acceleration: Score 85
- Agility: Score 78

Development Areas:
- Power: Score 45 (Performance Gap)
- Strength: Score 55

Projection Assessment:
Currently a project player. Upside is contingent on significant strength and power development in a structured program. Ceiling could be a rotational player if physical gaps are closed.

Risk Indicators:
- Performance gap in Power.
- Metrics last updated over 90 days ago.`,
        version: "1.0-mock"
    };
}


interface AiSummaryProps {
    athlete: AthleteProfile;
    scoutId: string;
    summaryData: { text: string; generatedAt: string; version: string; } | null;
}

export function AiSummary({ athlete, scoutId, summaryData }: AiSummaryProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState(summaryData?.text || null);

    useEffect(() => {
        setSummary(summaryData?.text || null);
    }, [summaryData]);

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        try {
            const { summary: newSummary, version } = await generateScoutSummary(athlete);

            const newSummaryData = {
                text: newSummary,
                generatedAt: new Date().toISOString(),
                version: version,
            };

            const privateNotesDocRef = doc(firestore, 'scoutData', scoutId, 'privateNotes', athlete.uid);
            
            setDocumentNonBlocking(privateNotesDocRef, { aiScoutSummary: newSummaryData }, { merge: true });

            setSummary(newSummary);
            toast({
                title: 'Summary Generated',
                description: 'AI scout summary has been created and saved.',
            });

        } catch (error) {
            console.error("Error generating summary:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not generate AI summary.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                    <Sparkles className="w-5 h-5" />
                    AI Scout Summary
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-400">
                    An AI-generated evaluation based on the athlete's performance data. For internal use only.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : summary ? (
                    <div className="whitespace-pre-wrap text-sm font-mono bg-background/50 p-4 rounded-md">
                        {summary}
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-muted-foreground mb-4">No AI summary has been generated for this athlete yet.</p>
                        <Button onClick={handleGenerateSummary} disabled={isLoading}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Summary
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

    