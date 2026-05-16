'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowLeft, Building, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ScoutProfile, ClubMember } from '@/lib/types';
import { doc, query, collection, where } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { ClubAffiliation } from '@/components/scout/club-affiliation';

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

    const scoutDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'scouts', user.uid) : null), [firestore, user?.uid]);
    const { data: scoutProfile, isLoading: isScoutProfileLoading } = useDoc<ScoutProfile>(scoutDocRef);

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
        }
    }, [scoutProfile, form]);

    const onSubmit = async (values: z.infer<typeof scoutUpdateFormSchema>) => {
        if (!user || !firestore || !scoutDocRef) return;
        setIsLoading(true);

        try {
            const updatedData = {
                name: values.name,
                sports: values.sports.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
                website: values.website,
                bio: values.bio,
                updatedAt: new Date().toISOString(),
            };
            
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
            </div>
        </div>
    );
}