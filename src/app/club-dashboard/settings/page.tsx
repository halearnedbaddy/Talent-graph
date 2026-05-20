'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Plus, X, Camera, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import type { ClubProfile, ClubSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { compressImage, uploadFileWithProgress, type UploadProgress } from '@/firebase/storage';

export default function ClubSettingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const firebaseApp = useFirebaseApp();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [clubId, setClubId] = useState<string | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [logoUpload, setLogoUpload] = useState<UploadProgress | null>(null);
    const [isCompressingLogo, setIsCompressingLogo] = useState(false);
    const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);

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

    useEffect(() => {
        if (club?.logoUrl) setLogoPreview(club.logoUrl);
    }, [club]);

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

    const handleLogoFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image under 15 MB.' });
            return;
        }
        if (!clubId) return;
        const previewUrl = URL.createObjectURL(file);
        setLogoPreview(previewUrl);
        setIsCompressingLogo(true);
        setLogoUpload(null);
        setPendingLogoUrl(null);
        try {
            const compressed = await compressImage(file, 400, 0.82);
            setIsCompressingLogo(false);
            setLogoUpload({ progress: 5, state: 'running' });
            const logoBlob = new File([compressed], 'logo.jpg', { type: 'image/jpeg' });
            const downloadUrl = await uploadFileWithProgress(
                firebaseApp,
                `club-logos/${clubId}/logo.jpg`,
                logoBlob,
                (p) => setLogoUpload({ ...p, progress: Math.max(5, p.progress) })
            );
            // Auto-save logoUrl to Firestore immediately — no "Save Changes" click needed
            await updateDoc(doc(firestore, 'clubs', clubId), {
                logoUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
            });
            setPendingLogoUrl(downloadUrl);
            setLogoPreview(downloadUrl);
            toast({ title: 'Logo saved!', description: 'Your club logo has been updated.' });
        } catch (err: any) {
            setIsCompressingLogo(false);
            setLogoUpload({ progress: 0, state: 'error', error: err.message });
            toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
        }
    };

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await handleLogoFile(file);
        e.target.value = '';
    };

    const handleSave = async () => {
        if (!firestore || !clubId) return;
        setIsSaving(true);
        try {
            const updates: Record<string, any> = {
                settings: settings,
                updatedAt: new Date().toISOString()
            };
            if (pendingLogoUrl) updates.logoUrl = pendingLogoUrl;
            await updateDoc(doc(firestore, 'clubs', clubId), updates);
            setPendingLogoUrl(null);
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

    const clubInitials = club?.clubName
        ? club.clubName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : 'CL';

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Organization Settings</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configure institutional frameworks</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="font-black uppercase tracking-widest h-11 min-h-[44px] px-6 self-start sm:self-auto">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                </Button>
            </div>

            {/* Club Logo Upload */}
            <Card className="border-none shadow-xl bg-background overflow-hidden">
                <CardHeader className="bg-muted/50 border-b py-3 px-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Club Identity</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleLogoSelect}
                    />
                    <div className="flex items-start gap-5">
                        <div className="relative shrink-0">
                            <Avatar className="h-20 w-20 border-4 border-background shadow-xl rounded-2xl">
                                <AvatarImage src={logoPreview} className="object-cover" />
                                <AvatarFallback className="text-lg font-black rounded-2xl bg-primary text-primary-foreground">
                                    {clubInitials}
                                </AvatarFallback>
                            </Avatar>
                            <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={logoUpload?.state === 'running'}
                                className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <Camera className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 space-y-2">
                            <div>
                                <p className="font-black text-sm">{club?.clubName || 'Your Club'}</p>
                                <p className="text-xs text-muted-foreground">Upload your club logo or crest</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 font-bold text-xs h-9"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={logoUpload?.state === 'running'}
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {logoPreview ? 'Change Logo' : 'Upload Logo'}
                            </Button>
                            {logoUpload?.state === 'running' && (
                                <div className="space-y-1 max-w-xs">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Uploading...</span>
                                        <span>{logoUpload.progress}%</span>
                                    </div>
                                    <Progress value={logoUpload.progress} className="h-1.5" />
                                </div>
                            )}
                            {logoUpload?.state === 'success' && (
                                <p className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Logo saved to your club profile!
                                </p>
                            )}
                            {logoUpload?.state === 'error' && (
                                <p className="flex items-center gap-1.5 text-destructive text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {logoUpload.error}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 [&>*]:self-start">
                <Card className="border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-muted/50 border-b py-3 px-4">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">League & Seasons</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-5">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Active Seasons</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.seasons?.map((s, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 uppercase">
                                        {s} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('seasons', i)} />
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input value={newSeason} onChange={e => setNewSeason(e.target.value)} placeholder="e.g. 2025/26" className="h-11 font-bold" />
                                <Button size="icon" variant="outline" className="h-11 w-11 min-h-[44px] shrink-0" onClick={() => { addItem('seasons', newSeason); setNewSeason(''); }}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Competitions</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.competitions?.map((c, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 uppercase">
                                        {c} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('competitions', i)} />
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input value={newComp} onChange={e => setNewComp(e.target.value)} placeholder="e.g. Youth League" className="h-11 font-bold" />
                                <Button size="icon" variant="outline" className="h-11 w-11 min-h-[44px] shrink-0" onClick={() => { addItem('competitions', newComp); setNewComp(''); }}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-muted/50 border-b py-3 px-4">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Training Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-5">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Court Preference</Label>
                            <Select value={settings.courtType} onValueChange={(v: any) => setSettings({...settings, courtType: v})}>
                                <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grass">Natural Grass / Turf</SelectItem>
                                    <SelectItem value="futsal">Indoor / Futsal Court</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Absence Reasons</Label>
                            <div className="flex flex-wrap gap-2">
                                {settings.absenceReasons?.map((r, i) => (
                                    <Badge key={i} variant="secondary" className="font-bold text-[10px] h-8 gap-2 uppercase px-2">
                                        {r} <X className="w-3 h-3 cursor-pointer" onClick={() => removeItem('absenceReasons', i)} />
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Danger Zone */}
            <Card className="border border-destructive/30 bg-background overflow-hidden">
                <CardHeader className="bg-destructive/5 border-b border-destructive/20 py-3 px-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="font-black text-sm">Delete Club Account</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Permanently delete this club and all associated data. This cannot be undone.</p>
                    </div>
                    <DeleteAccountDialog role="club" clubId={clubId ?? undefined} />
                </CardContent>
            </Card>
        </div>
    );
}
