'use client';

import { useMemo } from 'react';
import type { AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ProfileStrengthCardProps {
  profile: AthleteProfile;
}

interface StrengthItem {
  label: string;
  description: string;
  weight: number;
  tier: 'High' | 'Medium' | 'Low';
  achieved: boolean;
  detail?: string;
  actionPath?: string;
  actionLabel?: string;
}

export function countAttributes(profile: AthleteProfile): number {
  if (!profile.detailedAttributes) return 0;
  let count = 0;
  for (const category of Object.values(profile.detailedAttributes)) {
    count += Object.values(category as Record<string, number>).filter(v => v > 0).length;
  }
  return count;
}

export function countVerifiedAppearances(profile: AthleteProfile): number {
  if (!profile.matchHistory) return 0;
  return profile.matchHistory
    .filter(m => m.isVerified)
    .reduce((sum, m) => sum + (m.apps || 0), 0);
}

const TIER_COLOR: Record<string, string> = {
  High: 'bg-red-500/10 text-red-600 border-red-200',
  Medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  Low: 'bg-blue-500/10 text-blue-600 border-blue-200',
};

export function ProfileStrengthCard({ profile }: ProfileStrengthCardProps) {
  const verifiedApps = countVerifiedAppearances(profile);
  const attributeCount = countAttributes(profile);

  const items: StrengthItem[] = useMemo(() => [
    {
      label: 'Coach-verified match statistics',
      description: 'Directly improves composite index',
      weight: 25,
      tier: 'High',
      achieved: verifiedApps >= 1,
      detail: verifiedApps > 0 ? `${verifiedApps} verified appearance${verifiedApps !== 1 ? 's' : ''}` : undefined,
      actionPath: '/dashboard/add-match',
      actionLabel: 'Log a match',
    },
    {
      label: '30+ attributes rated',
      description: 'Powers attribute matching in Talent Calls',
      weight: 25,
      tier: 'High',
      achieved: attributeCount >= 30,
      detail: `${attributeCount} / 30 rated`,
      actionPath: '/dashboard/update-attributes',
      actionLabel: 'Rate attributes',
    },
    {
      label: 'Profile photo uploaded',
      description: 'Increases scout click-through rate',
      weight: 15,
      tier: 'Medium',
      achieved: !!profile.photoUrl,
      actionPath: undefined,
      actionLabel: 'Open Edit Profile above',
    },
    {
      label: 'Position + alternative positions',
      description: 'Expands Talent Call match surface',
      weight: 15,
      tier: 'Medium',
      achieved: !!(profile.position && profile.altPositions && profile.altPositions.length > 0),
      detail: profile.position
        ? profile.altPositions?.length
          ? `${profile.position} + ${profile.altPositions.length} alt`
          : `${profile.position} — add alt positions`
        : undefined,
      actionPath: '/onboarding/metrics',
      actionLabel: 'Update positions',
    },
    {
      label: 'Season history completed',
      description: 'Improves consistency score accuracy',
      weight: 10,
      tier: 'Medium',
      achieved: !!(profile.previousTeams && profile.previousTeams.length > 0),
      detail: profile.previousTeams?.length
        ? `${profile.previousTeams.length} club${profile.previousTeams.length !== 1 ? 's' : ''} listed`
        : undefined,
      actionPath: '/onboarding/metrics',
      actionLabel: 'Add career history',
    },
    {
      label: 'Club affiliation linked',
      description: 'Adds credibility signal',
      weight: 10,
      tier: 'Low',
      achieved: !!profile.affiliatedClubId,
    },
  ], [verifiedApps, attributeCount, profile]);

  const score = items.reduce((sum, item) => sum + (item.achieved ? item.weight : 0), 0);

  const scoreColor =
    score >= 80 ? 'text-green-500' :
    score >= 50 ? 'text-yellow-500' :
    'text-red-500';

  const barColor =
    score >= 80 ? 'bg-green-500' :
    score >= 50 ? 'bg-yellow-500' :
    'bg-red-500';

  const subtitle =
    score >= 80
      ? 'Excellent — your profile is fully optimised for discovery.'
      : score >= 50
      ? 'Good progress — a few more items will unlock more Talent Calls.'
      : 'Complete the high-impact items below to increase your scout visibility.';

  return (
    <Card className="border-none shadow-lg bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Profile Strength
          </CardTitle>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black tabular-nums ${scoreColor}`}>{score}</span>
            <span className="text-xs text-muted-foreground font-bold">/100</span>
          </div>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
              item.achieved
                ? 'bg-muted/30'
                : 'bg-muted/10 border border-dashed border-muted'
            }`}
          >
            {item.achieved ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={`text-xs font-bold leading-tight ${item.achieved ? '' : 'text-muted-foreground'}`}>
                  {item.label}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[9px] font-black px-1 py-0 h-4 border shrink-0 ${TIER_COLOR[item.tier]}`}
                >
                  {item.tier}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
              {item.detail && (
                <p className={`text-[10px] font-bold mt-0.5 ${item.achieved ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {item.detail}
                </p>
              )}
              {!item.achieved && item.actionLabel && (
                item.actionPath ? (
                  <Link
                    href={item.actionPath}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-wider mt-1 hover:underline"
                  >
                    {item.actionLabel}
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                ) : (
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                    {item.actionLabel}
                  </p>
                )
              )}
            </div>
            <span className={`text-[10px] font-black shrink-0 ${item.achieved ? 'text-green-500' : 'text-muted-foreground'}`}>
              +{item.weight}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
