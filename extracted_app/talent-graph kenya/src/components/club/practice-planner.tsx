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
import { Loader2, Plus, Check } from 'lucide-react';
import type { PracticeSession, Drill } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PracticePlannerProps {
    session: PracticeSession;
    clubId: string;
}

export function PracticePlanner({ session, clubId }: PracticePlannerProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedDrills, setSelectedDrills] = useState<string[]>(session.drills || []);

    const drillsQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'drills'), where('clubId', '==', clubId)) : null
    ), [firestore, clubId]);
    const { data: drills, isLoading: drillsLoading } = useCollection<Drill>(drillsQuery);

    const toggleDrill = (drillId: string) => {
        setSelectedDrills(prev => 
            prev.includes(drillId) ? prev.filter(id => id !== drillId) : [...prev, drillId]
        );
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'practices', session.id), {
                drills: selectedDrills,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Plan Updated', description: 'Drill sequence successfully scheduled.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update plan.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest">Plan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="uppercase font-black tracking-tight">Tactical Practice Builder</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase">
                        Select drills from library for {session.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-[400px] overflow-auto pr-2">
                    {drillsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                    ) : drills?.length ? (
                        drills.map(d => (
                            <div 
                                key={d.id} 
                                onClick={() => toggleDrill(d.id)}
                                className={cn(
                                    "p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between group",
                                    selectedDrills.includes(d.id) ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-black uppercase">{d.name}</h4>
                                        <Badge variant="outline" className="text-[8px] font-black h-4 px-1">{d.focus}</Badge>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground line-clamp-1">{d.description}</p>
                                </div>
                                <div className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                    selectedDrills.includes(d.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/20"
                                )}>
                                    {selectedDrills.includes(d.id) && <Check className="w-3 h-3" />}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-12 text-muted-foreground text-xs font-bold">No drills found. Add some to your library first.</p>
                    )}
                </div>
                <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1 font-black uppercase tracking-widest h-10">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finalize Session Plan'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
