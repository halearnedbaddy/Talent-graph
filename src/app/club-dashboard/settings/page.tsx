'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Plus, X } from 'lucide-react';
import type { ClubProfile, ClubMember, ClubSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ClubSettingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    // Note: We'll use a direct doc ref for the club settings instead
    const [clubId, setClubId] = useState<string | null>(null);

    // Initial fetch to get clubId from membership
    useEffect(() => {
        if (!firestore || !user) return;
        const checkMembership = async () => {
            const { getDocs, collection, query, where } = await import('firebase/firestore');
            const q = query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin'));
            const snap = await getDocs(q);
            if (!snap.empty) setClubId(snap.docs[0].data().clubId);
        };
        checkMembership();
    }, [firestore, user]);

    const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
    const { data: club } = useDoc<ClubProfile>(clubRef);

    const [settings, setSettings] = useState<ClubSettings>({
        seasons: [],
        competitions: [],
        drillFocuses: [],
        equipment: [],
        absenceReasons: [],
        courtType: 'grass'
    });

    useEffect(() => {
        if (club?.settings) {
            setSettings(club.settings);
        }
    }, [club]);

    const [newSeason, setNewSeason] = useState('');
    const [newComp, setNewComp] = useState('');

    const handleSave = async () => {
        if (!firestore || !clubId) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'clubs', clubId), {
                settings: settings,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Settings Updated', description: 'Organizational configuration synced.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    const addItem = (key: keyof ClubSettings, value: string) => {
        if (!value) return;
        const current = (settings[key] as string[]) || [];
        if (current.includes(value)) return;
        setSettings({ ...settings, [key]: [...current, value] });
    };

    const removeItem = (key: keyof ClubSettings, index: number) => {
        const current = [...(settings[key] as string[])];
        current.splice(index, 1);
        setSettings({ ...settings, [key]: current });
    };

    if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Organization Settings</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configure institutional frameworks</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="font-black uppercase tracking-widest h-10 px-8">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Changes
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-neutral-50 border-b">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">League & Seasons</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Active Seasons</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.seasons?.map((s, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 uppercase">
                                        {s} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('seasons', i)} />
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input value={newSeason} onChange={e => setNewSeason(e.target.value)} placeholder="e.g. 2025/26" className="h-9 font-bold" />
                                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => { addItem('seasons', newSeason); setNewSeason(''); }}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Institutional Competitions</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.competitions?.map((c, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 uppercase">
                                        {c} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('competitions', i)} />
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input value={newComp} onChange={e => setNewComp(e.target.value)} placeholder="e.g. Youth League" className="h-9 font-bold" />
                                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => { addItem('competitions', newComp); setNewComp(''); }}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-neutral-50 border-b">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Training Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Court Preference</Label>
                            <Select value={settings.courtType} onValueChange={(v: any) => setSettings({...settings, courtType: v})}>
                                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grass">Natural Grass / Turf</SelectItem>
                                    <SelectItem value="futsal">Indoor / Futsal Court</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Absence Reasons</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.absenceReasons?.map((r, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-[10px] h-7 gap-2 uppercase">
                                        {r} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('absenceReasons', i)} />
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}