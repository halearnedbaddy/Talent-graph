'use client';

import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, ArrowLeft, Zap, Trophy, Star, Flame, Shield,
  CheckCircle2, Lock, TrendingUp, BarChart3, Target, Award,
  Users, Layers, GitGraph, Eye, Clock
} from 'lucide-react';
import type { AthleteProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { countAttributes, countVerifiedAppearances } from '@/components/dashboard/profile-strength-card';

interface Achievement {
  id: string;
  category: 'profile' | 'performance' | 'engagement' | 'community';
  icon: React.ElementType;
  title: string;
  description: string;
  earned: boolean;
  progress?: number;
  total?: number;
  badge?: string;
  color: string;
}

export default function AchievementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const athleteRef = useMemoFirebase(() => (
    firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null
  ), [firestore, user?.uid]);
  const { data: profile, isLoading } = useDoc<AthleteProfile>(athleteRef);

  const viewsRef = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(collection(firestore, 'profile_views', user.uid, 'viewers'), orderBy('viewedAt', 'desc'))
      : null
  ), [firestore, user?.uid]);
  const { data: views } = useCollection<{ viewerRole: string; viewedAt: string }>(viewsRef);

  if (isLoading || !profile) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const verifiedApps = countVerifiedAppearances(profile);
  const attributeCount = countAttributes(profile);
  const matchCount = profile.matchHistory?.length ?? 0;
  const scoutViews = views?.filter(v => v.viewerRole === 'scout' || v.viewerRole === 'club').length ?? 0;
  const hasVideo = !!profile.highlightVideoUrl;
  const hasShowcase = (profile.showcaseVideos?.length ?? 0) > 0;

  const matchStreak = (() => {
    const history = profile.matchHistory ?? [];
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
      history.map(m => { const d = new Date(m.updatedAt); return isNaN(d.getTime()) ? null : getMonday(d); }).filter((v): v is number => v !== null)
    );
    let streak = 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    let week = getMonday(new Date());
    if (!weeksWithMatches.has(week)) week -= MS_WEEK;
    while (weeksWithMatches.has(week)) { streak++; week -= MS_WEEK; }
    return streak;
  })();

  const totalGoals = profile.matchHistory?.reduce((s, m) => s + (m.goals || 0), 0) ?? 0;
  const totalApps = profile.matchHistory?.reduce((s, m) => s + (m.apps || 0), 0) ?? 0;

  const achievements: Achievement[] = [
    {
      id: 'profile_photo',
      category: 'profile',
      icon: Eye,
      title: 'First Impression',
      description: 'Upload your profile photo',
      earned: !!profile.photoUrl,
      color: 'text-blue-600',
      badge: 'Starter',
    },
    {
      id: 'first_match',
      category: 'performance',
      icon: Trophy,
      title: 'First Match Logged',
      description: 'Record your first match performance',
      earned: matchCount >= 1,
      progress: Math.min(matchCount, 1),
      total: 1,
      color: 'text-amber-600',
      badge: 'Rising Star',
    },
    {
      id: 'match_10',
      category: 'performance',
      icon: BarChart3,
      title: 'Ten Matches Strong',
      description: 'Log 10 matches on the platform',
      earned: matchCount >= 10,
      progress: Math.min(matchCount, 10),
      total: 10,
      color: 'text-primary',
      badge: 'Consistent',
    },
    {
      id: 'match_25',
      category: 'performance',
      icon: Star,
      title: 'Battle-Hardened',
      description: 'Log 25 matches on the platform',
      earned: matchCount >= 25,
      progress: Math.min(matchCount, 25),
      total: 25,
      color: 'text-purple-600',
      badge: 'Veteran',
    },
    {
      id: 'verified_appearance',
      category: 'performance',
      icon: CheckCircle2,
      title: 'Coach-Verified',
      description: 'Have at least 1 match verified by your coach',
      earned: verifiedApps >= 1,
      progress: Math.min(verifiedApps, 1),
      total: 1,
      color: 'text-green-600',
      badge: 'Verified',
    },
    {
      id: 'verified_5',
      category: 'performance',
      icon: Shield,
      title: 'Fully Verified',
      description: 'Have 5+ matches verified by your coach',
      earned: verifiedApps >= 5,
      progress: Math.min(verifiedApps, 5),
      total: 5,
      color: 'text-green-700',
      badge: 'Trusted',
    },
    {
      id: 'attributes_full',
      category: 'profile',
      icon: Layers,
      title: 'Self-Scout Complete',
      description: 'Rate all 30+ tactical attributes',
      earned: attributeCount >= 30,
      progress: Math.min(attributeCount, 30),
      total: 30,
      color: 'text-blue-700',
      badge: 'Self-Aware',
    },
    {
      id: 'streak_2',
      category: 'engagement',
      icon: Flame,
      title: 'Momentum Builder',
      description: 'Maintain a 2-week match logging streak',
      earned: matchStreak >= 2,
      progress: Math.min(matchStreak, 2),
      total: 2,
      color: 'text-orange-600',
      badge: 'Momentum',
    },
    {
      id: 'streak_4',
      category: 'engagement',
      icon: Flame,
      title: 'Hot Streak',
      description: 'Maintain a 4-week match logging streak',
      earned: matchStreak >= 4,
      progress: Math.min(matchStreak, 4),
      total: 4,
      color: 'text-red-600',
      badge: 'On Fire',
    },
    {
      id: 'streak_8',
      category: 'engagement',
      icon: Flame,
      title: 'Scout Magnet',
      description: 'Maintain an 8-week match logging streak',
      earned: matchStreak >= 8,
      progress: Math.min(matchStreak, 8),
      total: 8,
      color: 'text-red-700',
      badge: 'Scout Magnet',
    },
    {
      id: 'highlight_video',
      category: 'profile',
      icon: Award,
      title: 'Showreel Ready',
      description: 'Upload your highlight reel video',
      earned: hasVideo,
      color: 'text-primary',
      badge: 'Video Star',
    },
    {
      id: 'showcase_videos',
      category: 'profile',
      icon: Award,
      title: 'Showcase Gallery',
      description: 'Upload 3+ showcase videos',
      earned: hasShowcase && (profile.showcaseVideos?.length ?? 0) >= 3,
      progress: Math.min(profile.showcaseVideos?.length ?? 0, 3),
      total: 3,
      color: 'text-purple-600',
      badge: 'Content Creator',
    },
    {
      id: 'verified_badge',
      category: 'community',
      icon: Shield,
      title: 'Platform Verified',
      description: 'Receive official verification from Talent Graph',
      earned: !!profile.isVerified,
      color: 'text-blue-600',
      badge: 'Verified Scout',
    },
    {
      id: 'has_club',
      category: 'community',
      icon: Users,
      title: 'Squad Member',
      description: 'Join an affiliated club on the platform',
      earned: profile.clubStatus === 'active',
      color: 'text-green-600',
      badge: 'Club Athlete',
    },
    {
      id: 'scout_views_5',
      category: 'engagement',
      icon: Eye,
      title: 'On the Radar',
      description: 'Receive 5 scout / club profile views',
      earned: scoutViews >= 5,
      progress: Math.min(scoutViews, 5),
      total: 5,
      color: 'text-primary',
      badge: 'Scouted',
    },
    {
      id: 'scout_views_25',
      category: 'engagement',
      icon: TrendingUp,
      title: 'High Visibility',
      description: 'Receive 25 scout / club profile views',
      earned: scoutViews >= 25,
      progress: Math.min(scoutViews, 25),
      total: 25,
      color: 'text-primary',
      badge: 'High Profile',
    },
    {
      id: 'goals_10',
      category: 'performance',
      icon: Target,
      title: 'Goal Scorer',
      description: 'Log 10 goals across all matches',
      earned: totalGoals >= 10,
      progress: Math.min(totalGoals, 10),
      total: 10,
      color: 'text-amber-600',
      badge: 'Striker',
    },
    {
      id: 'csi_75',
      category: 'performance',
      icon: GitGraph,
      title: 'Elite Index',
      description: 'Achieve a Composite Scouting Index of 75+',
      earned: (profile.compositeScoutingIndex ?? 0) >= 75,
      progress: Math.min(profile.compositeScoutingIndex ?? 0, 75),
      total: 75,
      color: 'text-green-700',
      badge: 'Elite Rated',
    },
  ];

  const earned = achievements.filter(a => a.earned);
  const locked = achievements.filter(a => !a.earned);
  const earnedPct = Math.round((earned.length / achievements.length) * 100);

  const categories = [
    { id: 'profile', label: 'Profile', icon: Eye },
    { id: 'performance', label: 'Performance', icon: Trophy },
    { id: 'engagement', label: 'Engagement', icon: Flame },
    { id: 'community', label: 'Community', icon: Users },
  ] as const;

  const AchievementCard = ({ achievement }: { achievement: Achievement }) => {
    const pct = achievement.total
      ? Math.round(((achievement.progress ?? 0) / achievement.total) * 100)
      : achievement.earned ? 100 : 0;

    return (
      <div className={cn(
        'p-4 rounded-xl border transition-all',
        achievement.earned
          ? 'bg-background border-primary/20 shadow-sm'
          : 'bg-muted/30 border-border opacity-70'
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
            achievement.earned ? `bg-primary/10` : 'bg-muted'
          )}>
            {achievement.earned
              ? <achievement.icon className={`h-5 w-5 ${achievement.color}`} />
              : <Lock className="h-4 w-4 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className={cn('font-black text-sm', !achievement.earned && 'text-muted-foreground')}>
                {achievement.title}
              </p>
              {achievement.earned && achievement.badge && (
                <Badge className="bg-primary/10 text-primary border-primary/30 font-black text-[9px] shrink-0">
                  {achievement.badge}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{achievement.description}</p>
            {achievement.total && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[9px] font-black text-muted-foreground mb-1">
                  <span>{achievement.progress ?? 0} / {achievement.total}</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-8">
      <header className="bg-background border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <h1 className="text-sm font-black uppercase tracking-widest truncate">Achievements</h1>
          </div>
          <Badge className="bg-primary text-primary-foreground font-black text-xs">
            {earned.length}/{achievements.length}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-3xl">
        {/* Overall progress */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg">{earned.length} Earned</p>
                <p className="text-[11px] text-muted-foreground">{locked.length} achievements still to unlock</p>
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] font-black text-muted-foreground mb-1">
                    <span>Overall Progress</span>
                    <span>{earnedPct}%</span>
                  </div>
                  <Progress value={earnedPct} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(cat => {
            const catAchievements = achievements.filter(a => a.category === cat.id);
            const catEarned = catAchievements.filter(a => a.earned).length;
            return (
              <Card key={cat.id} className="border-none shadow-sm bg-background">
                <CardContent className="p-3 text-center">
                  <cat.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="font-black text-lg">{catEarned}/{catAchievements.length}</p>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{cat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Earned */}
        {earned.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Earned ({earned.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {earned.map(a => <AchievementCard key={a.id} achievement={a} />)}
            </div>
          </div>
        )}

        {/* Locked */}
        {locked.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              Locked ({locked.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {locked.map(a => <AchievementCard key={a.id} achievement={a} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
