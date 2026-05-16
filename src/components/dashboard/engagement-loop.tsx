'use client';

import { useMemo } from 'react';
import type { AthleteProfile } from '@/lib/types';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ProfileView } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Eye, MapPin, Target, AlertCircle, TrendingUp,
  Building2, Zap, CheckCircle2, Info,
} from 'lucide-react';
import Link from 'next/link';
import { countAttributes, countVerifiedAppearances } from './profile-strength-card';
import { formatDistanceToNow } from 'date-fns';

interface EngagementLoopProps {
  profile: AthleteProfile;
}

type InsightType = 'view' | 'rank' | 'talent_call' | 'complete' | 'consistency' | 'club' | 'info';

interface Insight {
  id: string;
  type: InsightType;
  message: string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  actionLabel?: string;
  actionPath?: string;
  isNew?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  scout: 'Scout',
  club: 'Club',
  athlete: 'Athlete',
  admin: 'Admin',
};

function isWithin24h(dateStr: string): boolean {
  try {
    return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function EngagementLoop({ profile }: EngagementLoopProps) {
  const firestore = useFirestore();

  const viewsQuery = useMemoFirebase(
    () =>
      firestore && profile.uid
        ? query(
            collection(firestore, 'profile_views', profile.uid, 'viewers'),
            orderBy('viewedAt', 'desc'),
            limit(5)
          )
        : null,
    [firestore, profile.uid]
  );
  const { data: views } = useCollection<ProfileView>(viewsQuery);

  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = [];
    const attrCount = countAttributes(profile);
    const verifiedApps = countVerifiedAppearances(profile);
    const csi = profile.compositeScoutingIndex ?? 0;

    // Real profile view data
    if (views && views.length > 0) {
      const latest = views[0];
      const roleLabel = ROLE_LABEL[latest.viewerRole] || latest.viewerRole;
      const isNew = isWithin24h(latest.viewedAt);
      const timeAgo = formatDistanceToNow(new Date(latest.viewedAt), { addSuffix: true });
      list.push({
        id: 'view-latest',
        type: 'view',
        message: latest.viewerName
          ? `Your profile was viewed by ${latest.viewerName} (${roleLabel}) ${timeAgo}`
          : `Your profile was viewed by a ${roleLabel} ${timeAgo}`,
        sub: views.length > 1 ? `${views.length} total views on your profile` : undefined,
        icon: Eye,
        iconColor: 'text-blue-500',
        isNew,
      });
    }

    // CSI-based ranking estimate — clearly labelled as estimated
    if (csi > 0 && profile.position) {
      const region = profile.country || 'your region';
      const estimatedRank =
        csi >= 80 ? 'Top 5%' :
        csi >= 65 ? 'Top 15%' :
        csi >= 50 ? 'Top 30%' : 'Top 50%';
      list.push({
        id: 'rank',
        type: 'rank',
        message: `Estimated ranking: ${estimatedRank} of ${profile.position}s in ${region}`,
        sub: `Based on your CSI score of ${csi}. Improves as you add verified data.`,
        icon: MapPin,
        iconColor: 'text-green-500',
      });
    }

    // Attribute completeness — with exact numbers, no implied external state
    if (attrCount < 30) {
      const needed = 30 - attrCount;
      list.push({
        id: 'complete-attrs',
        type: 'complete',
        message: `Rate ${needed} more attribute${needed !== 1 ? 's' : ''} to complete your profile`,
        sub: `You have ${attrCount} of 30 rated — this directly powers Talent Call matching`,
        icon: AlertCircle,
        iconColor: 'text-yellow-500',
        actionLabel: 'Rate attributes',
        actionPath: '/dashboard/update-attributes',
      });
    } else {
      list.push({
        id: 'attrs-complete',
        type: 'info',
        message: 'All 30+ attributes rated — you appear in advanced Talent Call searches',
        icon: CheckCircle2,
        iconColor: 'text-green-500',
      });
    }

    // Verified appearances milestone
    if (verifiedApps === 0) {
      list.push({
        id: 'no-verified',
        type: 'complete',
        message: 'No coach-verified appearances yet — your CSI cannot be computed',
        sub: 'Log a match and request verification from your coach to unlock your composite score',
        icon: Target,
        iconColor: 'text-red-500',
        actionLabel: 'Log a match',
        actionPath: '/dashboard/add-match',
      });
    } else if (verifiedApps < 10) {
      list.push({
        id: 'verified-apps',
        type: 'complete',
        message: `${verifiedApps} coach-verified appearance${verifiedApps !== 1 ? 's' : ''} — reach 10 to unlock Semi-Pro tier`,
        sub: 'Request match verification from your coach after every game',
        icon: CheckCircle2,
        iconColor: 'text-orange-500',
        actionLabel: 'Add a match',
        actionPath: '/dashboard/add-match',
      });
    } else if (verifiedApps < 30) {
      list.push({
        id: 'verified-apps-mid',
        type: 'consistency',
        message: `${verifiedApps} coach-verified appearances — ${30 - verifiedApps} more needed to qualify for Pro tier`,
        sub: 'Consistency score improves with each additional verified game',
        icon: TrendingUp,
        iconColor: 'text-purple-500',
        actionLabel: 'Add a match',
        actionPath: '/dashboard/add-match',
      });
    }

    // Consistency score insight (only if it exists)
    if (profile.consistencyIndex && profile.consistencyIndex > 0 && verifiedApps >= 10) {
      const score = profile.consistencyIndex;
      list.push({
        id: 'consistency',
        type: 'consistency',
        message: `Consistency score: ${score} — ${score >= 60 ? 'meets the Pro tier threshold' : `${60 - score} points short of Pro threshold`}`,
        sub: 'Increases as you log more verified matches over time',
        icon: TrendingUp,
        iconColor: score >= 60 ? 'text-green-500' : 'text-purple-500',
      });
    }

    // Club affiliation
    if (profile.affiliatedClubId) {
      list.push({
        id: 'club-linked',
        type: 'club',
        message: 'Club affiliation linked — scouts can see your team context',
        sub: 'Club-verified matches carry higher weight in your composite index',
        icon: Building2,
        iconColor: 'text-teal-500',
      });
    } else {
      list.push({
        id: 'club-missing',
        type: 'club',
        message: 'No club affiliation linked',
        sub: 'Link a club to add a credibility signal and improve your scout ranking',
        icon: Building2,
        iconColor: 'text-muted-foreground',
      });
    }

    // Talent Call eligibility — honest about what we know
    if (profile.position && attrCount >= 20) {
      list.push({
        id: 'talent-call',
        type: 'talent_call',
        message: `Your profile is eligible for ${profile.position} Talent Calls`,
        sub: attrCount < 30
          ? 'Rate all 30 attributes to maximise your match rate'
          : 'All attributes rated — you appear in the full Talent Call pool',
        icon: Target,
        iconColor: 'text-primary',
      });
    } else if (profile.position) {
      list.push({
        id: 'talent-call-ineligible',
        type: 'talent_call',
        message: `Rate at least 20 attributes to enter the ${profile.position} Talent Call pool`,
        sub: `You currently have ${attrCount} attributes rated`,
        icon: Info,
        iconColor: 'text-muted-foreground',
        actionLabel: 'Rate attributes',
        actionPath: '/dashboard/update-attributes',
      });
    }

    return list.slice(0, 7);
  }, [profile, views]);

  return (
    <Card className="border-none shadow-lg bg-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Engagement Feed
        </CardTitle>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Live insights from your profile activity and data
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {insights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No insights yet</p>
            <p className="text-[10px] mt-1">Start building your profile to see activity here.</p>
          </div>
        ) : (
          insights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors border border-transparent hover:border-muted"
            >
              <insight.icon className={`w-4 h-4 shrink-0 mt-0.5 ${insight.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold leading-snug">{insight.message}</p>
                  {insight.isNew && (
                    <Badge className="text-[9px] font-black px-1.5 h-4 shrink-0 bg-primary text-primary-foreground">
                      New
                    </Badge>
                  )}
                </div>
                {insight.sub && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{insight.sub}</p>
                )}
                {insight.actionPath && insight.actionLabel && (
                  <Link
                    href={insight.actionPath}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-wider mt-1 hover:underline"
                  >
                    {insight.actionLabel} →
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
