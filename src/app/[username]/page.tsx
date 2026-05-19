'use client';
import { useParams } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import type { AthleteProfile, UserAccount, ScoutConnection, ClubMember, ScoutAthleteData, ScoutProfile, ClubProfile } from '@/lib/types';
import { Loader2, ArrowLeft, ShieldCheck, BarChart3, Target, TrendingUp, ShieldAlert, Award, FileText, MessageSquare, MapPin, Building2, Trophy, AlertTriangle, Calendar, Users, Lock, Zap, Printer } from 'lucide-react';
import { PerformanceRadarChart } from '@/components/dashboard/performance-radar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { smsSend } from '@/hooks/useSMS';
import React, { useEffect, useRef, useState } from 'react';
import { Separator } from '@/components/ui/separator';

import { AiSummary } from '@/components/scout/ai-summary';
import { PrivateNotes } from '@/components/scout/private-notes';
import { VerifyMetricsButton } from '@/components/scout/verify-metrics-button';
import { MatchStatisticsTable } from '@/components/dashboard/match-statistics-table';
import { AttributeRadarCharts } from '@/components/dashboard/attribute-radar-charts';
import { HighlightVideo } from '@/components/profile/highlight-video';
import { ProfileEngagement } from '@/components/profile/profile-engagement';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function UsernamePage() {
    const params = useParams();
    const username = params.username as string;
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();
    const notificationFired = useRef(false);

    const currentUserDocRef = useMemoFirebase(() => (firestore && authUser?.uid ? doc(firestore, 'users', authUser.uid) : null), [firestore, authUser?.uid]);
    const { data: currentUserProfile } = useDoc<UserAccount>(currentUserDocRef);

    const memoizedQuery = useMemoFirebase(() => (firestore && username ? query(collection(firestore, 'athletes'), where('username', '==', username)) : null), [firestore, username]);
    const { data: athletes, isLoading, error } = useCollection<AthleteProfile>(memoizedQuery);
    
    const athlete = athletes?.[0];
    const isScout = currentUserProfile?.role === 'scout';
    const isOwner = authUser?.uid === athlete?.uid;

    // ── Growth gate: 1 free profile view for unauthenticated visitors ──
    const [isGated, setIsGated] = useState(false);
    const GUEST_VIEWS_KEY = 'tg_guest_views';

    useEffect(() => {
        if (!athlete || authUser) return; // authenticated users always get full access
        try {
            const raw = localStorage.getItem(GUEST_VIEWS_KEY);
            const seen: string[] = raw ? JSON.parse(raw) : [];
            if (seen.includes(username)) return; // returning to same profile — no gate
            if (seen.length >= 1) {
                setIsGated(true); // already used free view on a different profile
                return;
            }
            // First free view — record this profile
            localStorage.setItem(GUEST_VIEWS_KEY, JSON.stringify([...seen, username]));
        } catch {
            // localStorage unavailable (private mode) — show profile anyway
        }
    }, [athlete?.uid, authUser, username]);

    const scoutDocRef = useMemoFirebase(() => (firestore && authUser?.uid && isScout ? doc(firestore, 'scouts', authUser.uid) : null), [firestore, authUser?.uid, isScout]);
    const { data: scoutProfile } = useDoc<ScoutProfile>(scoutDocRef);

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && authUser?.uid && isScout ? query(collection(firestore, 'club_members'), where('userId', '==', authUser.uid)) : null
    ), [firestore, authUser?.uid, isScout]);
    const { data: clubMemberships } = useCollection<ClubMember>(clubMemberQuery);
    
    const activeMembership = clubMemberships?.find(m => m.status === 'active');
    const clubId = activeMembership?.clubId;

    // Fetch affiliated club profile for location data
    const affiliatedClubRef = useMemoFirebase(
        () => (firestore && athlete?.affiliatedClubId && athlete?.clubStatus === 'active'
            ? doc(firestore, 'clubs', athlete.affiliatedClubId)
            : null),
        [firestore, athlete?.affiliatedClubId, athlete?.clubStatus]
    );
    const { data: affiliatedClub } = useDoc<ClubProfile>(affiliatedClubRef);

    const connectionId = athlete?.uid && authUser?.uid ? `${athlete.uid}_${authUser.uid}` : null;
    const existingConnectionDocRef = useMemoFirebase(() => {
      if (firestore && connectionId) {
        return doc(firestore, 'scout_connections', connectionId);
      }
      return null;
    }, [firestore, connectionId]);

    const { data: existingConnection } = useDoc<ScoutConnection>(existingConnectionDocRef);
    const isScoutedByViewer = existingConnection?.status === 'accepted';

    const privateNotesDocRef = useMemoFirebase(() => {
      if (firestore && authUser?.uid && athlete?.uid && isScout) {
        return doc(firestore, 'scoutData', authUser.uid, 'privateNotes', athlete.uid);
      }
      return null;
    }, [firestore, authUser?.uid, athlete?.uid, isScout]);
    const { data: notesData } = useDoc<ScoutAthleteData>(privateNotesDocRef);

    // Profile view tracking — fires once per session for non-owners
    useEffect(() => {
        if (
            !firestore ||
            !athlete?.uid ||
            !currentUserProfile ||
            isOwner ||
            notificationFired.current
        ) return;

        notificationFired.current = true;

        const viewerName = `${currentUserProfile.firstName} ${currentUserProfile.lastName}`.trim() || 'Someone';
        const viewerRole = currentUserProfile.role || 'visitor';
        const viewedAt = new Date().toISOString();

        // Record the view under the athlete's viewers subcollection
        const viewerDocRef = doc(
            firestore,
            'profile_views',
            athlete.uid,
            'viewers',
            authUser?.uid || `anon_${Date.now()}`
        );
        setDoc(viewerDocRef, {
            viewerId: authUser?.uid || null,
            viewerName,
            viewerRole,
            viewedAt,
        }, { merge: true }).catch(() => {});

        // Push a notification to the athlete
        addDoc(
            collection(firestore, 'notifications', athlete.uid, 'items'),
            {
                type: 'profile_view',
                actorName: viewerName,
                actorRole: viewerRole,
                message: `viewed your profile`,
                isRead: false,
                createdAt: viewedAt,
            }
        ).catch(() => {});

        // SMS alert — only fire for scout/club viewers
        if (viewerRole === 'scout' || viewerRole === 'club') {
            smsSend('profile-view', {
                athletePhone: (athlete as any).phone,
                athleteName: athlete.firstName,
                viewerName,
                viewerRole,
            });
        }
    }, [firestore, athlete?.uid, currentUserProfile, isOwner, authUser?.uid]);

    const handleRequestAccess = () => {
       if (!firestore || !authUser?.uid || !athlete?.uid || !connectionId) return;

        const requestRef = doc(firestore, 'scout_connections', connectionId);
        const now = new Date().toISOString();
        
        setDocumentNonBlocking(requestRef, {
            id: connectionId,
            scoutId: authUser.uid,
            athleteId: athlete.uid,
            status: 'pending',
            recruitment_stage: 'connected',
            createdAt: now,
            updatedAt: now,
            clubId: clubId || null,
        });
        toast({ title: 'Request Sent', description: `Request to connect with ${athlete.firstName} sent.` });
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    if (error || !athlete) {
        return (
            <div className="flex flex-col h-screen items-center justify-center text-center p-4">
                <h1 className="text-4xl font-bold mb-2">Profile Not Found</h1>
                <p className="text-muted-foreground mb-6">The user @{username} does not exist.</p>
                <Button asChild><Link href="/">Go Home</Link></Button>
            </div>
        );
    }
    
    const userDisplayName = `${athlete.firstName} ${athlete.lastName}`;

    const indices = [
        { label: 'Performance', value: athlete.performanceIndex, icon: BarChart3 },
        { label: 'Efficiency', value: athlete.efficiencyIndex, icon: Target },
        { label: 'Consistency', value: athlete.consistencyIndex, icon: TrendingUp },
        { label: 'Risk', value: athlete.riskIndex, icon: ShieldAlert },
    ];

    const safeRenderValue = (val: any) => {
        if (val === null || val === undefined || isNaN(val)) return '--';
        return val;
    };

    const viewerName = currentUserProfile
        ? `${currentUserProfile.firstName} ${currentUserProfile.lastName}`.trim()
        : undefined;
    const viewerRole = currentUserProfile?.role;

    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8 pb-24">
            <div className="max-w-5xl mx-auto mb-4 flex justify-between items-center">
                 <Button variant="ghost" asChild>
                    <Link href={isScout ? "/scout-dashboard" : "/"} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm font-bold">Exit Profile</span>
                    </Link>
                </Button>
                <div className="flex items-center gap-2">
                    {isScout && athlete.uid && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs font-bold" asChild>
                            <Link href={`/scout-dashboard/report/${athlete.uid}`}>
                                <Printer className="w-3.5 h-3.5" />
                                Export Report
                            </Link>
                        </Button>
                    )}
                    {athlete.isVerified ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-1.5 px-3 py-1">
                            <ShieldCheck className="w-4 h-4" />
                            INSTITUTIONAL VERIFIED ✅
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1.5 px-3 py-1">
                            <FileText className="w-4 h-4" />
                            SELF-REPORTED DATA ⏳
                        </Badge>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Hero Profile Card */}
                <Card className="overflow-hidden shadow-2xl border-none bg-background">
                    <div className="h-48 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-8 flex flex-col md:flex-row items-start md:items-end gap-6">
                            <div className="relative">
                                <Avatar className="h-32 w-32 border-4 border-background shadow-2xl rounded-2xl">
                                    <AvatarImage src={athlete.photoUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${userDisplayName}`} />
                                    <AvatarFallback className="rounded-none text-2xl font-black">{getInitials(userDisplayName)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="text-white pb-2">
                                <div className="flex items-center gap-3">
                                  <h1 className="text-4xl font-black tracking-tight">{userDisplayName}</h1>
                                  {athlete.jerseyNumber && <Badge variant="outline" className="text-white border-white/20">#{athlete.jerseyNumber}</Badge>}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mt-1">
                                    <Badge className="bg-primary text-primary-foreground font-black tracking-widest">{athlete.readinessTier || 'RAW'}</Badge>
                                    <span className="text-sm font-bold text-white/70">@{athlete.username}</span>
                                    {athlete.dominantFoot && <span className="text-xs font-black uppercase text-white/40 tracking-widest">Foot: {athlete.dominantFoot}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <CardContent className="p-8 space-y-6">
                        {athlete.bio && (
                            <div className="flex items-start gap-2 text-muted-foreground">
                                <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                <p className="text-sm leading-relaxed">{athlete.bio}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {indices.map(idx => (
                                <div key={idx.label} className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-1.5">
                                        <idx.icon className="w-3 h-3" />
                                        {idx.label}
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black">{safeRenderValue(idx.value)}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold">/ 100</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Growth gate wraps everything below the hero */}
                <div className="relative">

                {/* Gate overlay — shown to guests who've already used their free view */}
                {isGated && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-start pt-8 px-4"
                        style={{ background: 'linear-gradient(to bottom, rgba(var(--background-rgb,255,255,255),0.1) 0%, hsl(var(--background)/0.97) 18%)' }}
                    >
                        <Card className="max-w-lg w-full border-none shadow-2xl overflow-hidden bg-background">
                            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
                            <CardContent className="p-8 text-center space-y-5">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                                    <Lock className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight mb-2">
                                        You&apos;ve used your free profile view
                                    </h2>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Join Talent Graph Kenya to unlock full career stats, performance radar,
                                        match history, and direct scouting tools for every athlete on the platform.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <Button asChild className="flex-1 h-12 font-black text-sm uppercase tracking-widest gap-2">
                                        <Link href="/signup">
                                            <Zap className="w-4 h-4" />
                                            Create Free Account
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" className="flex-1 h-12 font-black text-sm uppercase tracking-widest">
                                        <Link href="/login">Log In</Link>
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                    Free for athletes · Scouts unlock advanced tools
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Content below gate (blurred for guests) */}
                <div className={isGated ? 'space-y-8 pointer-events-none select-none blur-sm opacity-50' : 'space-y-8'}>

                {/* Social Engagement */}
                <ProfileEngagement
                    athleteId={athlete.uid}
                    athleteName={userDisplayName}
                    viewerName={viewerName}
                    viewerRole={viewerRole}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-8">
                        {isScout && (
                            <Card className="bg-neutral-900 text-white border-none shadow-lg">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Award className="w-5 h-5 text-primary" />
                                        Scout Control
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button variant="secondary" className="w-full font-bold" onClick={handleRequestAccess} disabled={!!existingConnection}>
                                        {existingConnection ? `Status: ${existingConnection.status}` : 'Connect to Scout'}
                                    </Button>
                                    {authUser && isScoutedByViewer && (
                                        <>
                                            <Separator className="bg-white/10" />
                                            <VerifyMetricsButton athlete={athlete} scoutId={authUser.uid} />
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card className="bg-background border-none shadow-lg">
                            <CardHeader><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Vitals & Spec</CardTitle></CardHeader>
                            <CardContent className="space-y-4 text-sm font-bold">
                                <div className="flex justify-between border-b pb-2"><span>Sport</span><span className="capitalize">{athlete.sport}</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Position</span><span className="capitalize">{athlete.position}</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Age</span><span>{athlete.age}</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Height</span><span>{athlete.heightCm} cm</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Weight</span><span>{athlete.weightKg} kg</span></div>
                                {athlete.country && (
                                    <div className="flex justify-between border-b pb-2"><span>Nationality</span><span>{athlete.country}</span></div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ── Club & Location ── */}
                        {(athlete.clubName || athlete.team) && (
                            <Card className="bg-background border-none shadow-lg">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                                        <Building2 className="w-3 h-3" /> Current Club
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    {athlete.clubName && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Building2 className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-black">{athlete.clubName}</p>
                                                {athlete.team && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{athlete.team}</p>}
                                            </div>
                                            {athlete.clubStatus === 'active' && (
                                                <Badge className="ml-auto bg-green-500/10 text-green-600 border-none text-[9px] font-black uppercase shrink-0">Active</Badge>
                                            )}
                                        </div>
                                    )}
                                    {(affiliatedClub?.location || affiliatedClub?.venue) && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                                            <span className="text-xs font-bold">{affiliatedClub.location}{affiliatedClub.venue ? ` · ${affiliatedClub.venue}` : ''}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Career Stats Summary ── */}
                        {(athlete.matchHistory?.length ?? 0) > 0 && (() => {
                            const history = athlete.matchHistory!;
                            const totalApps = history.reduce((s, m) => s + (m.apps || 0), 0);
                            const totalGoals = history.reduce((s, m) => s + (m.goals || 0), 0);
                            const totalAssists = history.reduce((s, m) => s + (m.assists || 0), 0);
                            const motm = history.filter(m => m.manOfTheMatch).length;
                            const avgRating = history.length ? (history.reduce((s, m) => s + (m.rating || 0), 0) / history.length).toFixed(1) : '--';
                            return (
                                <Card className="bg-background border-none shadow-lg">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                                            <Trophy className="w-3 h-3" /> Career Stats
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Apps', value: totalApps },
                                            { label: 'Goals', value: totalGoals },
                                            { label: 'Assists', value: totalAssists },
                                            { label: 'MoTM', value: motm },
                                            { label: 'Avg Rating', value: avgRating },
                                        ].map(stat => (
                                            <div key={stat.label} className="text-center rounded-lg bg-muted/40 py-2 px-1">
                                                <p className="text-xl font-black">{stat.value}</p>
                                                <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">{stat.label}</p>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            );
                        })()}

                        <Card className="bg-neutral-950 text-white border-none shadow-2xl">
                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Master CSI Score</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center pb-8">
                                <p className="text-8xl font-black tracking-tighter text-white leading-none">{safeRenderValue(athlete.compositeScoutingIndex)}</p>
                                <p className="text-[10px] font-bold text-primary mt-4 tracking-widest uppercase">Institutional Grade</p>
                            </CardContent>
                        </Card>

                        {/* ── Previous Teams ── */}
                        {(athlete.previousTeams?.length ?? 0) > 0 && (
                            <Card className="bg-background border-none shadow-lg">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                                        <Users className="w-3 h-3" /> Career History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {athlete.previousTeams!.map(pt => (
                                        <div key={pt.id} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-sm truncate">{pt.teamName}</p>
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                                    {pt.league || pt.country} &bull; {pt.from}{pt.to ? `–${pt.to}` : '–present'}
                                                </p>
                                                {(pt.appearances || pt.goals) && (
                                                    <div className="flex gap-3 mt-1">
                                                        {pt.appearances != null && <span className="text-[9px] font-black text-muted-foreground">{pt.appearances} apps</span>}
                                                        {pt.goals != null && <span className="text-[9px] font-black text-muted-foreground">{pt.goals} goals</span>}
                                                        {pt.assists != null && <span className="text-[9px] font-black text-muted-foreground">{pt.assists} assists</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase shrink-0">{pt.role}</Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Injury History ── */}
                        {(athlete.injuryHistory?.length ?? 0) > 0 && (
                            <Card className="bg-background border-none shadow-lg">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                                        <AlertTriangle className="w-3 h-3" /> Injury History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {athlete.injuryHistory!.map(inj => (
                                        <div key={inj.id} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                                            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                                                inj.severity === 'major' ? 'bg-destructive' :
                                                inj.severity === 'moderate' ? 'bg-amber-500' :
                                                'bg-green-500'
                                            }`} />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-sm capitalize">{inj.type} — {inj.bodyPart}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                                                    <p className="text-[10px] text-muted-foreground font-bold">
                                                        {inj.dateOccurred}{inj.recoveryDate ? ` → ${inj.recoveryDate}` : ' (ongoing)'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={`text-[8px] font-black uppercase shrink-0 ${
                                                    inj.severity === 'major' ? 'border-destructive/50 text-destructive' :
                                                    inj.severity === 'moderate' ? 'border-amber-500/50 text-amber-600' :
                                                    'border-green-500/50 text-green-600'
                                                }`}
                                            >
                                                {inj.severity}
                                            </Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="md:col-span-2 space-y-8">
                        {isScout && authUser && (
                            <div className="grid grid-cols-1 gap-8">
                                <AiSummary athlete={athlete} scoutId={authUser.uid} summaryData={notesData?.aiScoutSummary || null} />
                                <PrivateNotes athleteId={athlete.uid} scoutId={authUser.uid} notesData={notesData || null} />
                            </div>
                        )}

                        {/* Highlight Video */}
                        {athlete.highlightVideoUrl && (
                            <HighlightVideo
                                videoUrl={athlete.highlightVideoUrl}
                                videoTitle={athlete.highlightVideoTitle}
                                sport={athlete.sport}
                            />
                        )}

                        <Card className="shadow-xl bg-background border-none overflow-hidden">
                            <CardHeader className="bg-neutral-50 border-b">
                                <CardTitle className="text-sm font-black uppercase tracking-widest">Performance Radar</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[450px] p-8">
                                <PerformanceRadarChart profile={athlete} />
                            </CardContent>
                        </Card>

                        <AttributeRadarCharts profile={athlete} />

                        <Card className="shadow-xl bg-background border-none">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-widest">Match Statistics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MatchStatisticsTable matchHistory={athlete.matchHistory || []} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
                </div> {/* end blurred content wrapper */}
                </div> {/* end relative gate wrapper */}
            </div>
        </div>
    );
}
