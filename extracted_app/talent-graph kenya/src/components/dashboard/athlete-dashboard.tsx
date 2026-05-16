'use client';

import type { UserAccount, AthleteProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogOut, Loader2, Target, TrendingUp, ShieldAlert, BarChart3, Eye, Award, Bell, Layers, GitGraph, PlusCircle, Play, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
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

const PerformanceRadarChart = dynamic(() => import('./performance-radar-chart').then(mod => mod.PerformanceRadarChart), {
  loading: () => <div className="flex h-full items-center justify-center"><Skeleton className="h-64 w-64 rounded-full" /></div>,
  ssr: false
});

const AttributeRadarCharts = dynamic(() => import('./attribute-radar-charts').then(mod => mod.AttributeRadarCharts), {
  loading: () => <div className="h-[400px] w-full bg-muted/20 animate-pulse rounded-xl" />,
  ssr: false
});

interface AthleteDashboardProps {
  userAccount: UserAccount;
  athleteProfile?: AthleteProfile;
}

export function AthleteDashboard({ userAccount, athleteProfile }: AthleteDashboardProps) {
  const auth = useAuth();
  const router = useRouter();

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

  // Profile completion score (same weights as ProfileStrengthCard)
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
  const topMissing = completionItems.find(i => !i.achieved);

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

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="bg-background border-b sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold tracking-tight">Talent Graph</h1>
              <Badge variant="outline" className="hidden sm:block">Institutional Console</Badge>
            </div>
            {/* Profile completion % in header */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/40">
              <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : profileScore >= 50 ? 'bg-primary' : 'bg-yellow-500'}`} />
              <span className="text-xs font-black">{profileScore}%</span>
              <span className="text-[10px] text-muted-foreground font-medium">profile strength</span>
            </div>
            <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Profile completion notification banner */}
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
              {/* Mini progress bar */}
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

        <ProfileHeader profile={athleteProfile} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <EditProfileMediaDialog profile={athleteProfile} />
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
              </Card>
            )}
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
                <CardDescription className="text-neutral-400 text-xs">Update your professional data points to influence your CSI rating.</CardDescription>
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
    </div>
  );
}
