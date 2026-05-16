'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, XCircle, Clock } from 'lucide-react';
import type { PracticeSession, AthleteProfile, ScoutConnection } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AttendanceDialogProps {
    session: PracticeSession;
    clubId: string;
}

export function AttendanceDialog({ session, clubId }: AttendanceDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [localAttendance, setLocalAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>(session.attendance || {});

    // 1. Get athletes connected to this club
    const connectionsQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
    ), [firestore, clubId]);
    const { data: connections } = useCollection<ScoutConnection>(connectionsQuery);
    const athleteIds = Array.from(new Set(connections?.map(c => c.athleteId) || []));

    const athletesQuery = useMemoFirebase(() => (
        firestore && athleteIds.length > 0 ? query(collection(firestore, 'athletes'), where('uid', 'in', athleteIds)) : null
    ), [firestore, athleteIds.join(',')]);
    const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

    const handleStatusChange = (athleteId: string, status: 'present' | 'absent' | 'late') => {
        setLocalAttendance(prev => ({
            ...prev,
            [athleteId]: status
        }));
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'practices', session.id), {
                attendance: localAttendance,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Attendance Finalized', description: 'Institutional records updated.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save attendance.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest">Attendance</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="uppercase font-black tracking-tight">Session Attendance</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase">
                        {session.name} &bull; {session.date}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[400px] overflow-auto">
                    {athletesLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                    ) : athletes?.map(a => (
                        <div key={a.uid} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-black text-[10px] uppercase">
                                    {a.firstName[0]}{a.lastName[0]}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase">{a.firstName} {a.lastName}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">{a.position}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className={cn("h-8 w-8 rounded-lg", localAttendance[a.uid] === 'present' ? "bg-green-100 text-green-600" : "text-muted-foreground")}
                                    onClick={() => handleStatusChange(a.uid, 'present')}
                                >
                                    <UserCheck className="h-4 w-4" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className={cn("h-8 w-8 rounded-lg", localAttendance[a.uid] === 'late' ? "bg-orange-100 text-orange-600" : "text-muted-foreground")}
                                    onClick={() => handleStatusChange(a.uid, 'late')}
                                >
                                    <Clock className="h-4 w-4" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className={cn("h-8 w-8 rounded-lg", localAttendance[a.uid] === 'absent' ? "bg-red-100 text-red-600" : "text-muted-foreground")}
                                    onClick={() => handleStatusChange(a.uid, 'absent')}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full font-black uppercase tracking-widest h-10">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Commit Records'}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
