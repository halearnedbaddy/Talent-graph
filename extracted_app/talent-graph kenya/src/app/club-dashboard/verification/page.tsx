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
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase">Data Verification</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Audit Workflow</p>
            </div>

            <div className="grid gap-6">
                {isLoading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                ) : pendingAthletes && pendingAthletes.length > 0 ? (
                    pendingAthletes.map(a => (
                        <Card key={a.uid} className="border-none shadow-xl bg-background overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-8 bg-neutral-50 md:w-1/3 border-r">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-lg text-muted-foreground">
                                                {a.firstName[0]}{a.lastName[0]}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-tight">{a.firstName} {a.lastName}</h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{a.position} &bull; {a.age}yrs</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-muted-foreground">Master CSI</span>
                                                <span className="text-primary text-xl">{a.compositeScoutingIndex || '--'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-muted-foreground">Data Points</span>
                                                <span className="text-foreground">{Object.keys(a.rawMetrics || {}).length}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-8 flex-1 bg-background relative">
                                        <div className="flex items-center gap-2 mb-4 text-orange-500">
                                            <AlertTriangle className="w-4 h-4" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Institutional Confirmation</p>
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                                            This athlete has submitted self-reported metrics and tactical attributes. 
                                            By confirming, you are verifying these data points as accurate institutional records for your organization.
                                        </p>
                                        
                                        <div className="flex flex-wrap gap-2 mt-6">
                                            {Object.keys(a.detailedAttributes?.Technical || {}).map(attr => (
                                                <Badge key={attr} variant="secondary" className="text-[8px] font-bold uppercase px-1.5 py-0.5">
                                                    {attr}: {a.detailedAttributes?.Technical[attr]} ⏳
                                                </Badge>
                                            ))}
                                        </div>

                                        <div className="mt-8 flex gap-3">
                                            <Button onClick={() => handleVerify(a.uid)} disabled={processingId === a.uid} className="bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px] h-10 px-8">
                                                {processingId === a.uid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                                Verify Records ✅
                                            </Button>
                                            <Button variant="outline" className="font-black uppercase tracking-widest text-[10px] h-10 border-red-500/20 text-red-600 hover:bg-red-50">
                                                <X className="w-4 h-4 mr-2" /> Flag Discrepancy
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground bg-muted/10 rounded-3xl border-4 border-dashed">
                        <ShieldCheck className="w-16 h-16 mb-4 opacity-10 text-green-600" />
                        <p className="font-black uppercase tracking-widest">All organizational data is verified</p>
                    </div>
                )}
            </div>
        </div>
    );
}
