'use client';

import { useMemo } from 'react';
import type { AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, ChevronRight, Trophy } from 'lucide-react';
import { countAttributes, countVerifiedAppearances } from './profile-strength-card';

interface TierProgressionCardProps {
  profile: AthleteProfile;
}

const DISPLAY_TIERS = ['Developing', 'Semi-Pro', 'Pro'] as const;
type DisplayTier = typeof DISPLAY_TIERS[number];

function toDisplayTier(tier: string): DisplayTier {
  if (tier === 'Raw') return 'Developing';
  if (tier === 'Advanced') return 'Semi-Pro';
  if (tier === 'Elite') return 'Pro';
  if (DISPLAY_TIERS.includes(tier as DisplayTier)) return tier as DisplayTier;
  return 'Developing';
}

interface Criterion {
  label: string;
  current: number;
  target: number;
  met: boolean;
  progress: number;
  inverse?: boolean;
}

export function TierProgressionCard({ profile }: TierProgressionCardProps) {
  const rawTier = profile.readinessTier || 'Developing';
  const displayTier = toDisplayTier(rawTier);
  const currentTierIndex = DISPLAY_TIERS.indexOf(displayTier);

  const verifiedApps = countVerifiedAppearances(profile);
  const attributeCount = countAttributes(profile);
  const csi = profile.compositeScoutingIndex ?? 0;
  const consistency = profile.consistencyIndex ?? 0;
  const risk = profile.riskIndex ?? 100;

  const { nextTier, criteria, overallProgress } = useMemo(() => {
    if (displayTier === 'Developing') {
      const criteria: Criterion[] = [
        {
          label: 'Coach-verified appearances',
          current: verifiedApps,
          target: 10,
          met: verifiedApps >= 10,
          progress: Math.min(100, Math.round((verifiedApps / 10) * 100)),
        },
        {
          label: 'Composite Index',
          current: csi,
          target: 50,
          met: csi >= 50,
          progress: Math.min(100, Math.round((csi / 50) * 100)),
        },
        {
          label: 'Attributes rated',
          current: attributeCount,
          target: 20,
          met: attributeCount >= 20,
          progress: Math.min(100, Math.round((attributeCount / 20) * 100)),
        },
      ];
      const metCount = criteria.filter(c => c.met).length;
      return {
        nextTier: 'Semi-Pro' as DisplayTier,
        criteria,
        overallProgress: Math.round((metCount / criteria.length) * 100),
      };
    }

    if (displayTier === 'Semi-Pro') {
      const criteria: Criterion[] = [
        {
          label: 'Coach-verified appearances',
          current: verifiedApps,
          target: 30,
          met: verifiedApps >= 30,
          progress: Math.min(100, Math.round((verifiedApps / 30) * 100)),
        },
        {
          label: 'Composite Index',
          current: csi,
          target: 70,
          met: csi >= 70,
          progress: Math.min(100, Math.round((csi / 70) * 100)),
        },
        {
          label: 'Consistency Score',
          current: consistency,
          target: 60,
          met: consistency >= 60,
          progress: Math.min(100, Math.round((consistency / 60) * 100)),
        },
        {
          label: 'Risk Score below 40',
          current: risk,
          target: 40,
          met: risk <= 40,
          inverse: true,
          progress: risk <= 40
            ? 100
            : Math.max(0, Math.round(((100 - risk) / (100 - 40)) * 100)),
        },
      ];
      const metCount = criteria.filter(c => c.met).length;
      return {
        nextTier: 'Pro' as DisplayTier,
        criteria,
        overallProgress: Math.round((metCount / criteria.length) * 100),
      };
    }

    return { nextTier: null, criteria: [], overallProgress: 100 };
  }, [displayTier, verifiedApps, csi, attributeCount, consistency, risk]);

  return (
    <Card className="border-none shadow-lg bg-background overflow-hidden">
      <CardHeader className="pb-4 bg-neutral-950 text-white">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Tier Progression
        </CardTitle>

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {DISPLAY_TIERS.map((tier, i) => {
            const isPast = i < currentTierIndex;
            const isCurrent = i === currentTierIndex;
            return (
              <div key={tier} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 border text-[10px] font-black uppercase tracking-wider transition-all ${
                    isCurrent
                      ? 'bg-primary text-black border-primary'
                      : isPast
                      ? 'bg-neutral-700 text-neutral-400 border-neutral-600'
                      : 'bg-neutral-800 text-neutral-600 border-neutral-700'
                  }`}
                >
                  {isPast && <CheckCircle2 className="w-3 h-3" />}
                  {tier}
                </div>
                {i < DISPLAY_TIERS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {nextTier ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground">
                Progress to <span className="text-foreground font-black">{nextTier}</span>
              </p>
              <span className="text-xs font-black text-primary">{overallProgress}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="space-y-3 pt-1">
              {criteria.map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {c.met ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={`text-[11px] font-bold truncate ${c.met ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {c.label}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black tabular-nums shrink-0 ${c.met ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {c.inverse ? `${c.current} → <${c.target}` : `${c.current} / ${c.target}`}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${c.met ? 'bg-green-500' : 'bg-primary/40'}`}
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <Trophy className="w-10 h-10 mx-auto text-primary mb-2" />
            <p className="text-sm font-black">Pro Status Achieved</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your profile is verified at the highest tier — visible to all scouts and clubs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
