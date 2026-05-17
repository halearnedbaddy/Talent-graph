'use client';

import type { UserAccount, AthleteProfile, ShowcaseVideo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  LogOut, Loader2, Target, TrendingUp, ShieldAlert, BarChart3,
  Eye, Award, Layers, GitGraph, PlusCircle, Play, Zap, ArrowRight,
  CheckCircle2, Home, Pencil, Headphones, User, MoreHorizontal, Trash2,
  Plus, Flame, Clock, ShieldCheck, ShieldX, Building2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { signOut } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ActivitySummary } from './activity-summary';
import { ScoutRequests } from './scout-requests';
import { Badge } from '@/components/ui/badge';
import { SupportDialog } from '@/components/support/support-dialog';
import { ProfileHeader } from './profile-header';
import { MatchStatisticsTable } from './match-statistics-table';
import { MatchActionCenter } from './match-action-center';
import { ProfileViewsCard } from './profile-views-card';
import { EditProfileMediaDialog } from './edit-profile-media-dialog';
import { CareerHistoryCard } from './career-history-card';
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog';
import { ProfileStrengthCard, countAttributes, countVerifiedAppearances } from './profile-strength-card';
import { TierProgressionCard } from './tier-progression-card';
import { EngagementLoop } from './engagement-loop';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { VideoEngagement } from './video-engagement';
import { ReapplyClubDialog } from './reapply-club-dialog';

const PerformanceRadarChart = dynamic(
  () => import('./performance-radar-chart').then((mod) => mod.PerformanceRadarChart),
  { loading: () => <div className="flex h-full items-center justify-center"><Skeleton className="h-64 w-64 rounded-full" /></div>, ssr: false }
);

const AttributeRadarCharts = dynamic(
  () => import('./attribute-radar-charts').then((mod) => mod.AttributeRadarCharts),
  { loading: () => <div className="h-[400px] w-full bg-muted/20 animate-pulse rounded-xl" />, ssr: false }
);

interface AthleteDashboardProps {
  userAccount: UserAccount;
  athleteProfile?: AthleteProfile;
}

type ActiveTab = 'home' | 'edit' | 'support';

export function AthleteDashboard({ userAccount, athleteProfile }: AthleteDashboardProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmDeleteVideo, setConfirmDeleteVideo] = useState<ShowcaseVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  const handleDeleteShowcaseVideo = async () => {
    if (!confirmDeleteVideo || !athleteProfile || !firestore) return;
    setIsDeletingVideo(true);
    try {
      await updateDoc(doc(firestore, 'athletes', athleteProfile.uid), {
        showcaseVideos: arrayRemove(confirmDeleteVideo),
      });
      setConfirmDeleteVideo(null);
    } catch {
      // silent - toast not available here without hook; failure is non-critical
    } finally {
      setIsDeletingVideo(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (!athleteProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" suppressHydrationWarning>
        <div className="text-center">
          <p className="text-lg mb-4">Finalizing your profile setup...</p>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  const indices = [
    { label: 'Performance', value: athleteProfile.performanceIndex, icon: BarChart3 },
    { label: 'Efficiency', value: athleteProfile.efficiencyIndex, icon: Target },
    { label: 'Consistency', value: athleteProfile.consistencyIndex, icon: TrendingUp },
    { label: 'Risk', value: athleteProfile.riskIndex, icon: ShieldAlert },
  ];

  const safeRenderValue = (val: any) => {
    if (val === null || val === undefined || isNaN(val)) return '--';
    return val;
  };

  const verifiedApps = countVerifiedAppearances(athleteProfile);
  const attributeCount = countAttributes(athleteProfile);
  const completionItems = [
    { weight: 25, achieved: verifiedApps >= 1 },
    { weight: 25, achieved: attributeCount >= 30 },
    { weight: 15, achieved: !!athleteProfile.photoUrl },
    { weight: 15, achieved: !!(athleteProfile.position && athleteProfile.altPositions?.length) },
    { weight: 10, achieved: !!(athleteProfile.previousTeams?.length) },
    { weight: 10, achieved: !!athleteProfile.affiliatedClubId },
  ];
  const profileScore = completionItems.reduce((s, i) => s + (i.achieved ? i.weight : 0), 0);
  const isComplete = profileScore === 100;

  // ── Streak: consecutive weeks (Mon–Sun) with ≥1 match logged ──
  const matchStreak = (() => {
    const history = athleteProfile.matchHistory ?? [];
    if (!history.length) return 0;
    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const m = new Date(d);
      m.setDate(diff);
      m.setHours(0, 0, 0, 0);
      return m.getTime();
    };
    const weeksWithMatches = new Set(
      history
        .map(m => { const d = new Date(m.updatedAt); return isNaN(d.getTime()) ? null : getMonday(d); })
        .filter((v): v is number => v !== null)
    );
    let streak = 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    let week = getMonday(new Date());
    if (!weeksWithMatches.has(week)) week -= MS_WEEK;
    while (weeksWithMatches.has(week)) { streak++; week -= MS_WEEK; }
    return streak;
  })();

  const bannerBg = isComplete
    ? 'bg-green-500/10 border-green-500/20'
    : profileScore >= 50
    ? 'bg-primary/5 border-primary/20'
    : 'bg-yellow-500/10 border-yellow-500/20';

  const BannerIcon = isComplete ? CheckCircle2 : Zap;
  const bannerIconColor = isComplete ? 'text-green-500' : profileScore >= 50 ? 'text-primary' : 'text-yellow-500';

  const bannerTopAction = !athleteProfile.photoUrl
    ? null
    : attributeCount < 30
    ? { label: 'Rate Attributes', href: '/dashboard/update-attributes' }
    : verifiedApps === 0
    ? { label: 'Log a Match', href: '/dashboard/add-match' }
    : null;

  const bottomTabs = [
    { id: 'home' as ActiveTab, label: 'Home', icon: Home },
    { id: 'edit' as ActiveTab, label: 'Edit', icon: Pencil },
    { id: 'support' as ActiveTab, label: 'Support', icon: Headphones },
  ];

  return (
    <div className="min-h-screen bg-muted/40 pb-20 md:pb-0">

      {/* ── Top Header ── */}
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-base md:text-xl font-black tracking-tight uppercase">Talent Graph</h1>
              <Badge variant="outline" className="hidden md:block text-[9px] font-black uppercase tracking-widest">
                Athlete Console
              </Badge>
            </div>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/40 mr-2">
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : profileScore >= 50 ? 'bg-primary' : 'bg-yellow-500'}`} />
                <span className="text-xs font-black">{profileScore}%</span>
                <span className="text-[10px] text-muted-foreground font-medium">profile strength</span>
              </div>
              {matchStreak > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-orange-400/40 bg-orange-500/10 mr-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-black text-orange-600">{matchStreak}w</span>
                  <span className="text-[10px] text-orange-500/70 font-medium">streak</span>
                </div>
              )}
              <SupportDialog />
              <EditProfileMediaDialog profile={athleteProfile} />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${athleteProfile.username}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Public View
                </Link>
              </Button>
              <DeleteAccountDialog />
              <Button onClick={handleSignOut} variant="ghost" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>

            {/* Mobile right: completion % + more sheet */}
            <div className="flex md:hidden items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-muted/40">
                <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-green-500' : profileScore >= 50 ? 'bg-primary' : 'bg-yellow-500'}`} />
                <span className="text-[11px] font-black tabular-nums">{profileScore}%</span>
              </div>
              {matchStreak > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-orange-400/40 bg-orange-500/10">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span className="text-[11px] font-black text-orange-600 tabular-nums">{matchStreak}w</span>
                </div>
              )}

              <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0 flex flex-col">
                  <SheetHeader className="p-5 border-b text-left">
                    <SheetTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-sm">
                      <Zap className="h-4 w-4 text-primary" />
                      {athleteProfile.firstName} {athleteProfile.lastName}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 p-4 space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-3 h-12 font-bold text-sm" asChild>
                      <Link href={`/${athleteProfile.username}`} onClick={() => setMoreOpen(false)}>
                        <Eye className="h-4 w-4 text-primary" />
                        Public View
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 font-bold text-sm"
                      asChild
                    >
                      <Link href="/onboarding/metrics" onClick={() => setMoreOpen(false)}>
                        <Layers className="h-4 w-4 text-primary" />
                        Update Master Index
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 font-bold text-sm"
                      asChild
                    >
                      <Link href="/dashboard/update-attributes" onClick={() => setMoreOpen(false)}>
                        <GitGraph className="h-4 w-4 text-primary" />
                        Refine Attributes
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 font-bold text-sm"
                      asChild
                    >
                      <Link href="/dashboard/add-match" onClick={() => setMoreOpen(false)}>
                        <PlusCircle className="h-4 w-4 text-primary" />
                        Log a Match
                      </Link>
                    </Button>
                  </div>
                  <div className="p-4 border-t space-y-1">
                    <DeleteAccountDialog
                      trigger={
                        <button className="w-full flex items-center gap-3 h-12 px-3 rounded-xl font-bold text-sm text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                          Delete Account
                        </button>
                      }
                    />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 font-bold text-sm text-muted-foreground hover:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Profile completion banner */}
        <div className={`rounded-xl border p-4 ${bannerBg}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <BannerIcon className={`h-5 w-5 shrink-0 ${bannerIconColor}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black">
                    {isComplete ? 'Profile Complete' : `Profile ${profileScore}% Complete`}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase tracking-widest px-1.5 ${
                      isComplete ? 'border-green-400 text-green-600' :
                      profileScore >= 50 ? 'border-primary/40 text-primary' :
                      'border-yellow-400 text-yellow-700'
                    }`}
                  >
                    {isComplete ? 'Fully Indexed' : profileScore >= 50 ? 'Indexing' : 'Incomplete'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isComplete
                    ? 'Your profile is fully optimised — visible to all scouts and Talent Call searches.'
                    : profileScore >= 75
                    ? 'Almost there — complete the remaining items to maximise your discovery rate.'
                    : profileScore >= 50
                    ? 'Good start — complete more items to increase your visibility in Talent Calls.'
                    : 'Your profile needs more data before scouts can fully evaluate you.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isComplete ? 'bg-green-500' : profileScore >= 50 ? 'bg-primary' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${profileScore}%` }}
                  />
                </div>
                <span className="text-xs font-black tabular-nums">{profileScore}/100</span>
              </div>
              {bannerTopAction && !isComplete && (
                <Button size="sm" variant="outline" className="text-xs font-black h-8 gap-1.5" asChild>
                  <Link href={bannerTopAction.href}>
                    {bannerTopAction.label}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Club Affiliation Status ── */}
        {athleteProfile?.clubStatus && athleteProfile.clubName && (
          <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
            athleteProfile.clubStatus === 'active'
              ? 'bg-green-500/5 border-green-400/30'
              : athleteProfile.clubStatus === 'rejected'
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-primary/5 border-primary/20'
          }`}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                athleteProfile.clubStatus === 'active'
                  ? 'bg-green-500/15'
                  : athleteProfile.clubStatus === 'rejected'
                  ? 'bg-destructive/10'
                  : 'bg-primary/10'
              }`}>
                {athleteProfile.clubStatus === 'active' && <ShieldCheck className="h-5 w-5 text-green-600" />}
                {athleteProfile.clubStatus === 'rejected' && <ShieldX className="h-5 w-5 text-destructive" />}
                {athleteProfile.clubStatus === 'pending' && <Clock className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-black truncate">{athleteProfile.clubName}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase tracking-widest px-1.5 shrink-0 ${
                      athleteProfile.clubStatus === 'active'
                        ? 'border-green-400 text-green-600'
                        : athleteProfile.clubStatus === 'rejected'
                        ? 'border-destructive/50 text-destructive'
                        : 'border-primary/40 text-primary'
                    }`}
                  >
                    {athleteProfile.clubStatus}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {athleteProfile.clubStatus === 'active' && `You are an active squad member.`}
                  {athleteProfile.clubStatus === 'pending' && `Awaiting approval from the club admin.`}
                  {athleteProfile.clubStatus === 'rejected' && `Your request was not approved. You can apply to another club.`}
                </p>
              </div>
            </div>
            {athleteProfile.clubStatus === 'rejected' && (
              <ReapplyClubDialog
                athleteProfile={athleteProfile}
                userAccount={userAccount}
                onSuccess={() => {}}
              />
            )}
          </div>
        )}

        {/* ── Streak Card ── */}
        {matchStreak > 0 ? (
          <div className="rounded-xl border border-orange-400/30 bg-gradient-to-r from-orange-500/10 to-amber-500/5 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-black text-orange-600">
                  {matchStreak === 1 ? 'Streak started!' : `${matchStreak}-week streak`}
                  {matchStreak >= 4 && ' 🔥'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matchStreak === 1
                    ? 'You logged a match this week — keep it going next week.'
                    : matchStreak < 4
                    ? `You've logged matches ${matchStreak} weeks running. Keep the momentum.`
                    : `${matchStreak} consecutive weeks of match data — scouts love consistency.`}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <span className="text-3xl font-black text-orange-500 tabular-nums leading-none">{matchStreak}</span>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">weeks</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-muted-foreground/20 p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Flame className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-muted-foreground">No active streak yet</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Log a match this week to start your streak — consistency builds scout confidence.</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-xs font-black h-8 gap-1.5" asChild>
              <Link href="/dashboard/add-match">
                Log Match
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        )}

        <ProfileHeader profile={athleteProfile} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {indices.map((idx) => (
            <Card key={idx.label} className="border-none shadow-sm overflow-hidden group bg-background">
              <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">{idx.label}</CardTitle>
                <idx.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{safeRenderValue(idx.value)}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">/ 100</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <MatchActionCenter athleteProfile={athleteProfile} />

            <Card className="shadow-xl bg-background border-none overflow-hidden">
              <div className="bg-neutral-950 p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-neutral-500">Master Index</h3>
                  <p className="text-xs font-bold text-neutral-400">Institutional Performance Projection</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-black tracking-tighter leading-none">{safeRenderValue(athleteProfile.compositeScoutingIndex)}</div>
                  <div className="text-[10px] font-black uppercase text-primary mt-1">CSI RATING</div>
                </div>
              </div>
              <CardContent className="p-8">
                <div className="h-[450px]">
                  <PerformanceRadarChart profile={athleteProfile} />
                </div>
              </CardContent>
            </Card>

            <AttributeRadarCharts profile={athleteProfile} />

            <Card className="shadow-lg border-none">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase tracking-widest">Match Statistics</CardTitle>
                <CardDescription>Performance breakdown by official competition.</CardDescription>
              </CardHeader>
              <CardContent>
                <MatchStatisticsTable matchHistory={athleteProfile.matchHistory || []} />
              </CardContent>
            </Card>

            <CareerHistoryCard profile={athleteProfile} />

            {athleteProfile.highlightVideoUrl && (
              <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-neutral-950 text-white flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary fill-primary" /> Highlight Reel
                    </CardTitle>
                    {athleteProfile.highlightVideoTitle && (
                      <p className="text-xs font-bold text-neutral-400 mt-0.5">{athleteProfile.highlightVideoTitle}</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-black">
                  <div className="aspect-video w-full">
                    <video
                      src={athleteProfile.highlightVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                      preload="metadata"
                    />
                  </div>
                </CardContent>
                <VideoEngagement
                  videoId={`${athleteProfile.uid}_highlight`}
                  athleteId={athleteProfile.uid}
                  athleteName={`${athleteProfile.firstName} ${athleteProfile.lastName}`}
                  viewerName={`${athleteProfile.firstName} ${athleteProfile.lastName}`}
                  viewerRole="athlete"
                />
              </Card>
            )}

            {athleteProfile.showcaseVideos && athleteProfile.showcaseVideos.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary fill-primary" /> Showcase Videos
                </h3>
                {athleteProfile.showcaseVideos.map((vid) => (
                  <Card key={vid.id} className="shadow-lg border-none overflow-hidden">
                    <CardHeader className="bg-neutral-950 text-white py-3 px-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-black uppercase tracking-widest flex-1">
                        {vid.title || 'Showcase Clip'}
                      </CardTitle>
                      <button
                        onClick={() => setConfirmDeleteVideo(vid)}
                        className="ml-3 p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/10 transition-colors shrink-0"
                        title="Delete this video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <CardContent className="p-0 bg-black">
                      <div className="aspect-video w-full">
                        <video
                          src={vid.url}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        />
                      </div>
                    </CardContent>
                    <VideoEngagement
                      videoId={`${athleteProfile.uid}_showcase_${vid.id}`}
                      athleteId={athleteProfile.uid}
                      athleteName={`${athleteProfile.firstName} ${athleteProfile.lastName}`}
                      viewerName={`${athleteProfile.firstName} ${athleteProfile.lastName}`}
                      viewerRole="athlete"
                    />
                  </Card>
                ))}
              </div>
            )}

            <AlertDialog open={!!confirmDeleteVideo} onOpenChange={(o) => { if (!o) setConfirmDeleteVideo(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this showcase video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{confirmDeleteVideo?.title || 'This clip'}</strong> will be permanently removed from your profile. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingVideo}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteShowcaseVideo}
                    disabled={isDeletingVideo}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingVideo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete Video
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="space-y-8">
            <EngagementLoop profile={athleteProfile} />
            <ProfileStrengthCard profile={athleteProfile} />
            <TierProgressionCard profile={athleteProfile} />
            <ProfileViewsCard athleteId={athleteProfile.uid} />
            <ActivitySummary userAccount={userAccount} athleteProfile={athleteProfile} />
            <ScoutRequests athleteId={athleteProfile.uid} />

            <Card className="bg-neutral-900 text-white border-none shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Scouting Pipeline
                </CardTitle>
                <CardDescription className="text-neutral-400 text-xs">
                  Update your professional data points to influence your CSI rating.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full justify-start font-black text-[10px] uppercase tracking-widest h-12" asChild>
                  <Link href="/onboarding/metrics">
                    <Layers className="mr-3 h-4 w-4" />
                    1. Update Master Index
                  </Link>
                </Button>
                <Button variant="secondary" className="w-full justify-start font-black text-[10px] uppercase tracking-widest h-12" asChild>
                  <Link href="/dashboard/update-attributes">
                    <GitGraph className="mr-3 h-4 w-4" />
                    2. Refine Attributes
                  </Link>
                </Button>
                <Button variant="secondary" className="w-full justify-start font-black text-[10px] uppercase tracking-widest h-12" asChild>
                  <Link href="/dashboard/add-match">
                    <PlusCircle className="mr-3 h-4 w-4" />
                    3. Independent Match
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Controlled dialogs (opened by bottom nav) ── */}
      <EditProfileMediaDialog
        profile={athleteProfile}
        externalOpen={activeTab === 'edit'}
        onExternalOpenChange={(open) => { if (!open) setActiveTab('home'); }}
      />
      <SupportDialog
        open={activeTab === 'support'}
        onOpenChange={(open) => { if (!open) setActiveTab('home'); }}
      />

      {/* ── Quick-Action FAB ── */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 md:bottom-6">
        {/* Action items — slide up when open */}
        <div
          className={cn(
            'flex flex-col items-end gap-2 transition-all duration-200 origin-bottom',
            fabOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
          )}
        >
          {/* Log a Match */}
          <button
            onClick={() => { setFabOpen(false); router.push('/dashboard/add-match'); }}
            className="flex items-center gap-2 rounded-full bg-background border shadow-md px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Award className="h-4 w-4 text-amber-500" />
            Log a Match
          </button>

          {/* Rate Attributes */}
          <button
            onClick={() => { setFabOpen(false); router.push('/dashboard/update-attributes'); }}
            className="flex items-center gap-2 rounded-full bg-background border shadow-md px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Rate Attributes
          </button>

          {/* Update Master Index */}
          <button
            onClick={() => { setFabOpen(false); router.push('/onboarding/metrics'); }}
            className="flex items-center gap-2 rounded-full bg-background border shadow-md px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Zap className="h-4 w-4 text-green-500" />
            Update Index
          </button>
        </div>

        {/* FAB trigger */}
        <button
          onClick={() => setFabOpen(v => !v)}
          className={cn(
            'h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200',
            fabOpen
              ? 'bg-foreground text-background rotate-45'
              : 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
          )}
          aria-label={fabOpen ? 'Close quick actions' : 'Quick actions'}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* FAB backdrop — closes on tap outside */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden h-16 items-stretch border-t bg-background/95 backdrop-blur shadow-[0_-1px_12px_rgba(0,0,0,0.08)]">

        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative',
            activeTab === 'home' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {activeTab === 'home' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
          )}
          <Home className={cn('h-5 w-5 transition-transform', activeTab === 'home' && 'scale-110')} />
          <span className={cn('text-[10px] font-bold uppercase tracking-wide', activeTab === 'home' && 'font-black')}>
            Home
          </span>
        </button>

        {/* Edit Profile */}
        <button
          onClick={() => setActiveTab('edit')}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative',
            activeTab === 'edit' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {activeTab === 'edit' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
          )}
          <Pencil className={cn('h-5 w-5 transition-transform', activeTab === 'edit' && 'scale-110')} />
          <span className={cn('text-[10px] font-bold uppercase tracking-wide', activeTab === 'edit' && 'font-black')}>
            Edit
          </span>
        </button>

        {/* Public View — link, not a dialog */}
        <Link
          href={`/${athleteProfile.username}`}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors relative"
        >
          <Eye className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Preview</span>
        </Link>

        {/* Support */}
        <button
          onClick={() => setActiveTab('support')}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative',
            activeTab === 'support' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {activeTab === 'support' && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
          )}
          <Headphones className={cn('h-5 w-5 transition-transform', activeTab === 'support' && 'scale-110')} />
          <span className={cn('text-[10px] font-bold uppercase tracking-wide', activeTab === 'support' && 'font-black')}>
            Support
          </span>
        </button>

        {/* More (account/logout) */}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
            moreOpen ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">More</span>
        </button>
      </nav>
    </div>
  );
}
