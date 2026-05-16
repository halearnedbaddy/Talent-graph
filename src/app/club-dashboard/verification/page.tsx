'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Clock, Check, X, AlertTriangle } from 'lucide-react';
import type { AthleteProfile, ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function AttributeVerificationPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = userMemberships?.[0]?.clubId;

    const pendingAthletesQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId), where('isVerified', '==', false)) : null
    ), [firestore, clubId]);
    const { data: pendingAthletes, isLoading } = useCollection<AthleteProfile>(pendingAthletesQuery);

    const handleVerify = async (athleteId: string) => {
        if (!firestore) return;
        setProcessingId(athleteId);
        try {
            const athleteRef = doc(firestore, 'athletes', athleteId);
            await updateDoc(athleteRef, {
                isVerified: true,
                attributesVerified: true,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Profile Verified', description: 'Athlete data has been confirmed as institutional truth.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to verify athlete.' });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Data Verification</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Audit Workflow</p>
            </div>

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                ) : pendingAthletes && pendingAthletes.length > 0 ? (
                    pendingAthletes.map(a => (
                        <Card key={a.uid} className="border-none shadow-xl bg-background overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex flex-col sm:flex-row">
                                    <div className="p-5 bg-muted/50 sm:w-1/3 border-b sm:border-b-0 sm:border-r">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center font-black text-base text-muted-foreground shrink-0">
                                                {a.firstName[0]}{a.lastName[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base font-black uppercase tracking-tight truncate">{a.firstName} {a.lastName}</h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{a.position} • {a.age}y</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-muted-foreground">CSI</span>
                                                <span className="text-primary text-lg">{a.compositeScoutingIndex || '--'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-muted-foreground">Data Points</span>
                                                <span>{Object.keys(a.rawMetrics || {}).length}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 bg-background">
                                        <div className="flex items-center gap-2 mb-3 text-orange-500">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Confirmation</p>
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                                            Verify these self-reported metrics as accurate institutional records.
                                        </p>

                                        <div className="flex flex-wrap gap-1.5 mt-4">
                                            {Object.keys(a.detailedAttributes?.Technical || {}).slice(0, 8).map(attr => (
                                                <Badge key={attr} variant="secondary" className="text-[8px] font-bold uppercase px-1.5 py-0.5">
                                                    {attr}: {a.detailedAttributes?.Technical[attr]}
                                                </Badge>
                                            ))}
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            <Button
                                                onClick={() => handleVerify(a.uid)}
                                                disabled={processingId === a.uid}
                                                className="bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px] h-11 min-h-[44px] px-5 flex-1 sm:flex-none"
                                            >
                                                {processingId === a.uid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                                Verify
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="font-black uppercase tracking-widest text-[10px] h-11 min-h-[44px] border-red-500/20 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                                            >
                                                <X className="w-4 h-4 mr-2" /> Flag
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground bg-muted/10 rounded-3xl border-4 border-dashed">
                        <ShieldCheck className="w-14 h-14 mb-4 opacity-10 text-green-600" />
                        <p className="font-black uppercase tracking-widest text-sm">All data is verified</p>
                    </div>
                )}
            </div>
        </div>
    );
}
