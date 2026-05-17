'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { ScoutConnection, ScoutProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GitGraph, CheckCircle2, CircleDot, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

type Stage = 'connected' | 'evaluating' | 'shortlisted' | 'offer_extended' | 'signed' | 'rejected';

const STAGES: { key: Stage; label: string }[] = [
  { key: 'connected',     label: 'Connected' },
  { key: 'evaluating',    label: 'Evaluating' },
  { key: 'shortlisted',   label: 'Shortlisted' },
  { key: 'offer_extended',label: 'Offer' },
  { key: 'signed',        label: 'Signed' },
];

const STAGE_CONFIG: Record<Stage, { color: string; bg: string; badge: string; dot: string }> = {
  connected:     { color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-200',       badge: 'bg-sky-100 text-sky-700 border-sky-300',        dot: 'bg-sky-500' },
  evaluating:    { color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700 border-amber-300',  dot: 'bg-amber-500' },
  shortlisted:   { color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500' },
  offer_extended:{ color: 'text-green-600',  bg: 'bg-green-50 border-green-200',   badge: 'bg-green-100 text-green-700 border-green-300',  dot: 'bg-green-500' },
  signed:        { color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200',badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  rejected:      { color: 'text-red-500',    bg: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-600 border-red-200',        dot: 'bg-red-400' },
};

const STAGE_LABELS: Record<Stage, string> = {
  connected: 'Connected',
  evaluating: 'Evaluating',
  shortlisted: 'Shortlisted',
  offer_extended: 'Offer Extended',
  signed: 'Signed',
  rejected: 'Rejected',
};

function getInitials(name: string) {
  if (!name) return 'S';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

function stageIndex(stage: Stage): number {
  const idx = STAGES.findIndex(s => s.key === stage);
  return idx === -1 ? 0 : idx;
}

function PipelineProgress({ stage }: { stage: Stage }) {
  if (stage === 'rejected') {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map(s => (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <Circle className="w-3 h-3 text-muted-foreground/30" />
              <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-wide hidden sm:block">{s.label}</span>
            </div>
            {s.key !== 'signed' && <div className="w-3 h-px bg-muted-foreground/20" />}
          </div>
        ))}
        <Badge className="ml-1 text-[9px] font-black uppercase bg-red-100 text-red-600 border border-red-200">Rejected</Badge>
      </div>
    );
  }

  const current = stageIndex(stage);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-0.5">
            {i < current ? (
              <CheckCircle2 className="w-3 h-3 text-primary" />
            ) : i === current ? (
              <CircleDot className={`w-3 h-3 ${STAGE_CONFIG[stage].color}`} />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground/30" />
            )}
            <span className={`text-[8px] font-black uppercase tracking-wide hidden sm:block ${
              i < current ? 'text-primary' : i === current ? STAGE_CONFIG[stage].color : 'text-muted-foreground/40'
            }`}>
              {s.label}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div className={`w-3 sm:w-5 h-px ${i < current ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ConnectionCard({ connection }: { connection: ScoutConnection }) {
  const firestore = useFirestore();
  const scoutRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'scouts', connection.scoutId) : null),
    [firestore, connection.scoutId]
  );
  const { data: scout, isLoading } = useDoc<ScoutProfile>(scoutRef);

  const stage = (connection.recruitment_stage || 'connected') as Stage;
  const cfg = STAGE_CONFIG[stage];

  return (
    <div className={`rounded-xl border p-3 sm:p-4 space-y-3 transition-colors ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-8 w-8 border shrink-0">
            <AvatarImage src={scout ? `https://api.dicebear.com/8.x/initials/svg?seed=${scout.name}` : ''} />
            <AvatarFallback className="text-xs font-bold">
              {isLoading ? '…' : getInitials(scout?.name || '')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : scout ? (
              <Link href={`/scout/${scout.username}`} className="text-sm font-black hover:underline truncate block">
                {scout.name}
              </Link>
            ) : (
              <p className="text-sm font-black text-muted-foreground">Scout</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(connection.updatedAt || connection.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <Badge className={`text-[9px] font-black uppercase tracking-widest border shrink-0 ${cfg.badge}`}>
          {STAGE_LABELS[stage]}
        </Badge>
      </div>

      <PipelineProgress stage={stage} />
    </div>
  );
}

interface Props {
  athleteId: string;
}

export function RecruitmentPipelineTracker({ athleteId }: Props) {
  const firestore = useFirestore();

  const connectionsQuery = useMemoFirebase(
    () =>
      firestore && athleteId
        ? query(
            collection(firestore, 'scout_connections'),
            where('athleteId', '==', athleteId),
            where('status', '==', 'accepted')
          )
        : null,
    [firestore, athleteId]
  );
  const { data: connections, isLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const sorted = useMemo(() => {
    if (!connections) return [];
    const ORDER: Stage[] = ['offer_extended', 'signed', 'shortlisted', 'evaluating', 'connected', 'rejected'];
    return [...connections].sort(
      (a, b) =>
        ORDER.indexOf((a.recruitment_stage || 'connected') as Stage) -
        ORDER.indexOf((b.recruitment_stage || 'connected') as Stage)
    );
  }, [connections]);

  const summary = useMemo(() => {
    const counts: Partial<Record<Stage, number>> = {};
    for (const c of connections || []) {
      const s = (c.recruitment_stage || 'connected') as Stage;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [connections]);

  const hasOffer = (summary['offer_extended'] ?? 0) > 0;
  const hasSigned = (summary['signed'] ?? 0) > 0;

  return (
    <Card className="border-none shadow-lg bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <GitGraph className="w-4 h-4 text-primary" />
            Recruitment Pipeline
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasSigned && (
              <Badge className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-300">
                Signed
              </Badge>
            )}
            {hasOffer && !hasSigned && (
              <Badge className="text-[9px] font-black uppercase bg-green-100 text-green-700 border border-green-300">
                Offer Received
              </Badge>
            )}
            {connections && connections.length > 0 && (
              <Badge variant="secondary" className="text-[9px] font-black uppercase">
                {connections.length} scout{connections.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : sorted.length > 0 ? (
          sorted.map((conn) => (
            <ConnectionCard key={conn.id} connection={conn} />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <GitGraph className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No active pipelines yet</p>
            <p className="text-[10px] mt-1">Accept a scout connection to appear in their recruitment pipeline.</p>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <div className="pt-1 grid grid-cols-3 gap-2">
            {(Object.entries(summary) as [Stage, number][])
              .filter(([, count]) => count > 0)
              .sort(([a], [b]) => stageIndex(b) - stageIndex(a))
              .map(([stage, count]) => (
                <div key={stage} className={`rounded-lg border px-2.5 py-2 text-center ${STAGE_CONFIG[stage].bg}`}>
                  <p className={`text-lg font-black tabular-nums leading-none ${STAGE_CONFIG[stage].color}`}>{count}</p>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${STAGE_CONFIG[stage].color} opacity-80`}>
                    {STAGE_LABELS[stage]}
                  </p>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
