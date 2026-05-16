'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { ScoutProfile, ScoutConnection, ClubProfile } from '@/lib/types';
import { Loader2, User, Building, Globe, Award, ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import React from 'react';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function ScoutUsernamePage() {
    const params = useParams();
    const username = params.username as string;
    const firestore = useFirestore();

    const memoizedQuery = useMemoFirebase(
        () => (firestore && username ? query(collection(firestore, 'scouts'), where('username', '==', username)) : null),
        [firestore, username]
    );
    const { data: scouts, isLoading, error } = useCollection<ScoutProfile>(memoizedQuery);
    
    const scout = scouts?.[0];

    // Fetch club info if affiliated
    const clubDocRef = useMemoFirebase(() => (firestore && scout?.clubId ? query(collection(firestore, 'clubs'), where('uid', '==', scout.clubId)) : null), [firestore, scout?.clubId]);
    const { data: clubs } = useCollection<ClubProfile>(clubDocRef);
    const club = clubs?.[0];

    // Fetch scouted athletes count (accepted connections)
    const connectionsQuery = useMemoFirebase(() => (firestore && scout?.uid ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', scout.uid), where('status', '==', 'accepted')) : null), [firestore, scout?.uid]);
    const { data: connections } = useCollection<ScoutConnection>(connectionsQuery);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error || !scout) {
        return (
            <div className="flex flex-col h-screen items-center justify-center text-center p-4">
                <h1 className="text-4xl font-bold mb-2">Scout Profile Not Found</h1>
                <p className="text-muted-foreground mb-6">The scout @{username} does not exist or has not completed their profile.</p>
                <Button asChild>
                    <Link href="/">Go to Homepage</Link>
                </Button>
            </div>
        );
    }
    
    const userDisplayName = scout.name;

    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center">
                 <Button variant="ghost" asChild>
                    <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" prefetch={false}>
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm font-semibold">Back to Home</span>
                    </Link>
                </Button>
                {scout.isVerified && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1.5 px-3 py-1 font-bold">
                        <ShieldCheck className="w-4 h-4" />
                        VERIFIED PROFESSIONAL
                    </Badge>
                )}
            </div>
            <div className="max-w-4xl mx-auto space-y-6">
                <Card className="overflow-hidden shadow-lg border-none">
                    <div className="h-40 bg-gradient-to-r from-blue-600 to-indigo-700" />
                    <CardHeader className="-mt-16 flex flex-col sm:flex-row items-center gap-4">
                         <Avatar className="h-28 w-28 border-4 border-background">
                            <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${userDisplayName}`} />
                            <AvatarFallback>{getInitials(userDisplayName)}</AvatarFallback>
                        </Avatar>
                        <div className="text-center sm:text-left flex-1">
                            <div className="flex items-center justify-center sm:justify-start gap-2">
                                <CardTitle className="text-3xl font-bold">{userDisplayName}</CardTitle>
                                {scout.isVerified && <ShieldCheck className="w-6 h-6 text-blue-500 fill-blue-500/10" />}
                            </div>
                             <CardDescription className="flex items-center justify-center sm:justify-start gap-2 text-base font-medium">
                                @{scout.username}
                            </CardDescription>
                             <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    {scout.entityType === 'individual' ? <User className="h-3 w-3" /> : <Building className="h-3 w-3" />}
                                    <span className="capitalize">{scout.entityType} Scout</span>
                                </Badge>
                                {club && (
                                    <Badge variant="outline" className="flex items-center gap-1 border-primary/20">
                                        <Building className="h-3 w-3 text-primary" />
                                        <span>Affiliated with {club.clubName}</span>
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
                        <div className="md:col-span-1 space-y-4">
                           <Card className="bg-muted/30">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Scouting Stats</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="h-4 w-4 text-primary" />
                                            <span>Scouted Athletes</span>
                                        </div>
                                        <span className="font-bold">{connections?.length || 0}</span>
                                    </div>
                                    <Separator />
                                    {scout.sports && scout.sports.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Award className="h-4 w-4 text-primary" />
                                                <span className="font-semibold">Sports Focus</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {scout.sports.map(sport => (
                                                    <Badge key={sport} variant="secondary" className="capitalize text-[10px] px-2 py-0">
                                                        {sport}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {scout.website && (
                                        <div className="flex items-center gap-2 text-sm pt-2">
                                            <Globe className="h-4 w-4 text-muted-foreground" />
                                            <a href={scout.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                                                {scout.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                        <div className="md:col-span-2">
                             <Card className="h-full bg-muted/10">
                                <CardHeader>
                                    <CardTitle className="text-xl">About</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {scout.bio ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                            {scout.bio}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground italic">No professional bio provided.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}