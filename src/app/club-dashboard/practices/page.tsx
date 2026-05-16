'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Activity, BookOpen } from 'lucide-react';
import type { PracticeSession, Drill, ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AttendanceDialog } from '@/components/club/attendance-dialog';
import { PracticePlanner } from '@/components/club/practice-planner';

export default function PracticeManagementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [activeTab, setActiveTab] = useState<'sessions' | 'drills'>('sessions');

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = userMemberships?.[0]?.clubId;

    const sessionsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'practices'), where('clubId', '==', clubId)) : null
    ), [firestore, clubId]);
    const { data: sessions, isLoading: sessionsLoading } = useCollection<PracticeSession>(sessionsQuery);

    const drillsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'drills'), where('clubId', '==', clubId)) : null
    ), [firestore, clubId]);
    const { data: drills } = useCollection<Drill>(drillsQuery);

    const [newSession, setNewSession] = useState({
        name: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        time: '16:00',
        season: '2024/25',
        repeat: false
    });

    const [newDrill, setNewDrill] = useState({
        name: '',
        description: '',
        focus: '',
        equipment: ''
    });

    const handleAddSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !clubId) return;
        setIsAdding(true);
        try {
            await addDoc(collection(firestore, 'practices'), {
                ...newSession,
                clubId,
                drills: [],
                attendance: {},
                createdAt: new Date().toISOString()
            });
            toast({ title: 'Session Scheduled', description: 'Players and coaches have been notified.' });
            setNewSession({...newSession, name: '', location: ''});
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add practice.' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleAddDrill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !clubId) return;
        setIsAdding(true);
        try {
            await addDoc(collection(firestore, 'drills'), {
                ...newDrill,
                clubId,
                equipment: newDrill.equipment.split(',').map(s => s.trim())
            });
            toast({ title: 'Drill Added', description: 'Available in practice builder.' });
            setNewDrill({ name: '', description: '', focus: '', equipment: '' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add drill.' });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Performance Training</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Practice & Drill Management</p>
                </div>
                <div className="bg-background border rounded-lg p-1 flex gap-1">
                    <Button variant={activeTab === 'sessions' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('sessions')} className="text-[10px] font-black h-8 px-4 uppercase">Sessions</Button>
                    <Button variant={activeTab === 'drills' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('drills')} className="text-[10px] font-black h-8 px-4 uppercase">Drill Library</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {activeTab === 'sessions' ? (
                        <Card className="border-none shadow-xl bg-background overflow-hidden">
                            <CardHeader className="bg-neutral-900 text-white p-6">
                                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" /> Schedule Practice
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <form onSubmit={handleAddSession} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Session Name</Label>
                                        <Input value={newSession.name} onChange={e => setNewSession({...newSession, name: e.target.value})} className="h-9 font-bold" placeholder="e.g. Technical Fundamentals" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Location</Label>
                                        <Input value={newSession.location} onChange={e => setNewSession({...newSession, location: e.target.value})} className="h-9 font-bold" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Date</Label>
                                            <Input type="date" value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} className="h-9 font-bold" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Time</Label>
                                            <Input type="time" value={newSession.time} onChange={e => setNewSession({...newSession, time: e.target.value})} className="h-9 font-bold" required />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-black uppercase tracking-widest h-10" disabled={isAdding}>
                                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Notify Squad'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-none shadow-xl bg-background overflow-hidden">
                            <CardHeader className="bg-neutral-900 text-white p-6">
                                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary" /> New Drill Entry
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <form onSubmit={handleAddDrill} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Drill Name</Label>
                                        <Input value={newDrill.name} onChange={e => setNewDrill({...newDrill, name: e.target.value})} className="h-9 font-bold" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Main Focus</Label>
                                        <Input value={newDrill.focus} onChange={e => setNewDrill({...newDrill, focus: e.target.value})} className="h-9 font-bold" placeholder="e.g. Agility / Finishing" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Equipment (CSV)</Label>
                                        <Input value={newDrill.equipment} onChange={e => setNewDrill({...newDrill, equipment: e.target.value})} className="h-9 font-bold" placeholder="Cones, Bibs, Balls" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Instructions</Label>
                                        <Textarea value={newDrill.description} onChange={e => setNewDrill({...newDrill, description: e.target.value})} className="font-bold min-h-[100px]" />
                                    </div>
                                    <Button type="submit" className="w-full font-black uppercase tracking-widest h-10" disabled={isAdding}>
                                        Add to Library
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <div className="grid gap-4">
                        {activeTab === 'sessions' ? (
                            sessions?.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(s => (
                                <Card key={s.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-background">
                                    <div className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                                <Activity className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-black uppercase">{s.name}</h3>
                                                    <Badge variant="outline" className="text-[8px] font-black h-4 px-1">{s.season}</Badge>
                                                </div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                                    {s.location} &bull; {s.date} @ {s.time}
                                                </p>
                                                {s.drills?.length > 0 && (
                                                    <p className="text-[8px] font-black uppercase tracking-tighter text-primary mt-1">
                                                        {s.drills.length} Drills Planned
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {clubId && <AttendanceDialog session={s} clubId={clubId} />}
                                            {clubId && <PracticePlanner session={s} clubId={clubId} />}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {drills?.map(d => (
                                    <Card key={d.id} className="border-none shadow-sm hover:border-primary transition-all bg-background">
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm font-black uppercase">{d.name}</CardTitle>
                                                <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase">{d.focus}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{d.description}</p>
                                            <div className="flex flex-wrap gap-1 mt-4">
                                                {d.equipment?.map(e => (
                                                    <Badge key={e} variant="secondary" className="text-[8px] font-bold px-1 py-0">{e}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
