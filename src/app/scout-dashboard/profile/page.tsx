'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowLeft, Building, User as UserIcon, Camera, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ScoutProfile, ClubMember, UserAccount } from '@/lib/types';
import { doc, query, collection, where } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { ClubAffiliation } from '@/components/scout/club-affiliation';
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { compressImage, type UploadProgress } from '@/firebase/storage';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

const scoutUpdateFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  sports: z.string().min(3, 'Please list at least one sport.'),
  website: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters.').optional(),
});


export default function ScoutProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const photoInputRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string>('');
    const [photoUpload, setPhotoUpload] = useState<UploadProgress | null>(null);
    const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
    const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);

    const scoutDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'scouts', user.uid) : null), [firestore, user?.uid]);
    const { data: scoutProfile, isLoading: isScoutProfileLoading } = useDoc<ScoutProfile>(scoutDocRef);

    const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
    const { data: userAccount } = useDoc<UserAccount>(userDocRef);
    const accountRole: 'scout' | 'coach' = userAccount?.role === 'coach' ? 'coach' : 'scout';

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const activeClubId = userMemberships?.[0]?.clubId;

    const form = useForm<z.infer<typeof scoutUpdateFormSchema>>({
        resolver: zodResolver(scoutUpdateFormSchema),
        defaultValues: {
            name: '',
            sports: '',
            website: '',
            bio: '',
        },
    });

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    useEffect(() => {
        if (scoutProfile) {
            form.reset({
                name: scoutProfile.name,
                sports: scoutProfile.sports?.join(', ') || '',
                website: scoutProfile.website || '',
                bio: scoutProfile.bio || '',
            });
            if (scoutProfile.photoUrl) setPhotoPreview(scoutProfile.photoUrl);
        }
    }, [scoutProfile, form]);

    const handlePhotoFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image under 15 MB.' });
            return;
        }
        if (!user?.uid || !firestore) return;
        const previewUrl = URL.createObjectURL(file);
        setPhotoPreview(previewUrl);
        setIsCompressingPhoto(true);
        setPhotoUpload(null);
        setPendingPhotoUrl(null);
        try {
            const compressed = await compressImage(file, 400, 0.82);
            setIsCompressingPhoto(false);
            setPhotoUpload({ progress: 40, state: 'running' });

            // Convert to base64 data URL — saves directly to Firestore, works instantly
            const dataUrl = await blobToBase64(compressed);
            setPhotoUpload({ progress: 80, state: 'running' });

            const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
            await updateDoc(firestoreDoc(firestore, 'scouts', user.uid), {
                photoUrl: dataUrl,
                updatedAt: new Date().toISOString(),
            });
            URL.revokeObjectURL(previewUrl);
            setPhotoUpload({ progress: 100, state: 'success', downloadUrl: dataUrl });
            setPendingPhotoUrl(dataUrl);
            setPhotoPreview(dataUrl);
            toast({ title: 'Photo saved!', description: 'Your profile photo has been updated.' });
        } catch (err: any) {
            setIsCompressingPhoto(false);
            setPhotoUpload({ progress: 0, state: 'error', error: err.message });
            toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await handlePhotoFile(file);
        e.target.value = '';
    };

    const onSubmit = async (values: z.infer<typeof scoutUpdateFormSchema>) => {
        if (!user || !firestore || !scoutDocRef) return;
        setIsLoading(true);

        try {
            const updatedData: Record<string, any> = {
                name: values.name,
                sports: values.sports.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
                website: values.website,
                bio: values.bio,
                updatedAt: new Date().toISOString(),
            };
            if (pendingPhotoUrl) updatedData.photoUrl = pendingPhotoUrl;

            updateDocumentNonBlocking(scoutDocRef, updatedData);

            toast({
                title: 'Profile Updated',
                description: 'Your profile has been successfully updated.',
            });
            router.push('/scout-dashboard');

        } catch (error) {
            console.error("Error updating scout profile:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update your profile. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isUserLoading || isScoutProfileLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!scoutProfile) {
        return (
             <div className="flex h-screen items-center justify-center text-center">
                <p>Scout profile not found.</p>
                <Button asChild variant="link"><Link href="/scout-dashboard">Go back</Link></Button>
             </div>
        );
    }

    const nameInitials = scoutProfile.name
        ? scoutProfile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : 'SC';

    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
             <div className="max-w-3xl mx-auto mb-4">
                <Button variant="ghost" asChild>
                    <Link href="/scout-dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" prefetch={false}>
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm font-semibold">Back to Dashboard</span>
                    </Link>
                </Button>
            </div>
            <div className="max-w-3xl mx-auto space-y-8 pb-24">

                {/* Profile Photo Card */}
                <Card className="w-full shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Profile Photo</CardTitle>
                        <CardDescription>Upload a professional photo so athletes and clubs can recognise you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handlePhotoSelect}
                        />
                        <div className="flex items-start gap-5">
                            <div className="relative shrink-0">
                                <Avatar className="h-20 w-20 border-4 border-background shadow-xl rounded-2xl">
                                    <AvatarImage src={photoPreview} className="object-cover" />
                                    <AvatarFallback className="text-lg font-black rounded-2xl bg-primary text-primary-foreground">
                                        {nameInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={photoUpload?.state === 'running'}
                                    className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div>
                                    <p className="font-black text-sm">{scoutProfile.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{scoutProfile.entityType} · @{scoutProfile.username}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 font-bold text-xs h-9"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={isCompressingPhoto || photoUpload?.state === 'running'}
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                                </Button>
                                {(isCompressingPhoto || photoUpload?.state === 'running') && (
                                    <div className="space-y-1 max-w-xs">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {isCompressingPhoto ? 'Compressing…' : 'Uploading…'}
                                            </span>
                                            <span>{isCompressingPhoto ? '—' : `${photoUpload?.progress ?? 0}%`}</span>
                                        </div>
                                        <Progress value={isCompressingPhoto ? undefined : photoUpload?.progress} className="h-1.5" />
                                    </div>
                                )}
                                {photoUpload?.state === 'success' && (
                                    <p className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Photo saved to your profile!
                                    </p>
                                )}
                                {photoUpload?.state === 'error' && (
                                    <div className="space-y-1">
                                        <p className="flex items-center gap-1.5 text-destructive text-xs">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {photoUpload.error}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-8"
                                            onClick={() => photoInputRef.current?.click()}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl md:text-3xl">Professional ID</CardTitle>
                        <CardDescription>Keep your professional identity on the Talent Graph up to date.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <div className="space-y-2">
                                    <Label>Username</Label>
                                    <Input value={`@${scoutProfile.username}`} readOnly disabled />
                                    <FormDescription>Usernames cannot be changed.</FormDescription>
                                </div>
                                <div className="space-y-2">
                                     <Label>Entity Type</Label>
                                     <div className="flex items-center gap-2 text-muted-foreground p-2 border rounded-md bg-muted/50">
                                        {scoutProfile.entityType === 'individual' ? <UserIcon className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                                        <span className="capitalize">{scoutProfile.entityType}</span>
                                     </div>
                                    <FormDescription>Entity type cannot be changed.</FormDescription>
                                </div>

                                <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>{scoutProfile.entityType === 'individual' ? 'Your Full Name' : 'Organization Name'}</FormLabel><FormControl><Input placeholder={scoutProfile.entityType === 'individual' ? 'John Doe' : 'Verve & Vigor FC'} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />

                                <FormField control={form.control} name="sports" render={({ field }) => (
                                <FormItem><FormLabel>Sports of Focus</FormLabel><FormControl><Input placeholder="Football, Basketball, Sprinting" {...field} /></FormControl><FormDescription>Separate multiple sports with a comma.</FormDescription><FormMessage /></FormItem>
                                )} />

                                <FormField control={form.control} name="website" render={({ field }) => (
                                <FormItem><FormLabel>Website (Optional)</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />

                                <FormField control={form.control} name="bio" render={({ field }) => (
                                <FormItem><FormLabel>Bio (Optional)</FormLabel><FormControl><Textarea placeholder="Tell us about yourself or your organization..." className="resize-none h-32" {...field} /></FormControl><FormDescription>You can use markdown for formatting.</FormDescription><FormMessage /></FormItem>
                                )} />
                                
                                <Button type="submit" className="w-full sm:w-auto font-black uppercase tracking-widest h-12 px-8" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Profile</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <ClubAffiliation currentClubId={activeClubId} />

                {/* Danger Zone */}
                <div className="border border-destructive/30 rounded-2xl overflow-hidden bg-background shadow-xl">
                    <div className="bg-destructive/5 border-b border-destructive/20 py-3 px-4">
                        <p className="text-sm font-black uppercase tracking-widest text-destructive">Danger Zone</p>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="font-black text-sm">Delete Account</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all associated data. This cannot be undone.</p>
                        </div>
                        <DeleteAccountDialog role={accountRole} />
                    </div>
                </div>
            </div>
        </div>
    );
}
