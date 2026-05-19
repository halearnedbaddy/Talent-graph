'use client';

import { useState, useMemo } from 'react';
import type { ScoutProfile, AthleteProfile, ScoutConnection } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GitPullRequestArrow, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Stage = ScoutConnection['recruitment_stage'];

const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: 'connected',     label: 'Connected',     color: 'text-blue-600',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'evaluating',    label: 'Evaluating',    color: 'text-amber-600',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'shortlisted',   label: 'Shortlisted',   color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'offer_extended',label: 'Offer Extended', color: 'text-emerald-600',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'signed',        label: 'Signed',        color: 'text-green-700',  bg: 'bg-green-500/15 border-green-500/30' },
  { id: 'rejected',      label: 'Rejected',      color: 'text-red-600',    bg: 'bg-red-500/10 border-red-500/20' },
];

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

interface AthleteCardProps {
  connection: ScoutConnection;
  athlete: AthleteProfile | undefined;
  onMove: (connectionId: string, stage: Stage) => Promise<void>;
  moving: string | null;
}

function PipelineCard({ connection, athlete, onMove, moving }: AthleteCardProps) {
  const isMoving = moving === connection.id;
  const name = athlete ? `${athlete.firstName} ${athlete.lastName}` : connection.athleteId;

  return (
    <div className="bg-background rounded-xl border shadow-sm p-3 space-y-2.5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 rounded-lg shrink-0">
          <AvatarImage src={athlete?.photoUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${name}`} />
          <AvatarFallback className="rounded-lg text-xs font-black">{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black truncate leading-tight">{name}</p>
          {athlete && (
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">
              {athlete.position}{athlete.sport ? ` · ${athlete.sport}` : ''}
            </p>
          )}
        </div>
        {athlete?.username && (
          <Link href={`/${athlete.username}`} target="_blank">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
          </Link>
        )}
      </div>

      {athlete && (
        <div className="flex gap-1.5">
          <div className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Score</p>
            <p className="text-sm font-black">{athlete.compositeScoutingIndex ?? '--'}</p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-center">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Age</p>
            <p className="text-sm font-black">{athlete.age ?? '--'}</p>
          </div>
          {athlete.isVerified && (
            <div className="flex-1 bg-green-500/10 rounded-lg px-2 py-1 text-center">
              <p className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Status</p>
              <p className="text-[10px] font-black text-green-600">Verified</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Select
          value={connection.recruitment_stage}
          onValueChange={val => onMove(connection.id, val as Stage)}
          disabled={isMoving}
        >
          <SelectTrigger className="h-7 text-xs flex-1 font-bold">
            {isMoving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Moving...
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {STAGES.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs font-bold">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Connected {new Date(connection.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </p>
    </div>
  );
}

interface Props {
  scoutProfile: ScoutProfile;
}

export function PipelineTab({ scoutProfile }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [moving, setMoving] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all');

  const connectionsQuery = useMemoFirebase(() => (
    firestore
      ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', scoutProfile.uid))
      : null
  ), [firestore, scoutProfile.uid]);
  const { data: connections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const allAthletesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'athletes') : null), [firestore]);
  const { data: allAthletes } = useCollection<AthleteProfile>(allAthletesQuery);

  const athleteMap = useMemo(() => {
    const map: Record<string, AthleteProfile> = {};
    allAthletes?.forEach(a => { map[a.uid] = a; });
    return map;
  }, [allAthletes]);

  const accepted = useMemo(() => (connections || []).filter(c => c.status === 'accepted'), [connections]);
  const pending  = useMemo(() => (connections || []).filter(c => c.status === 'pending'),  [connections]);

  const byStage = useMemo(() => {
    const map: Record<Stage, ScoutConnection[]> = {
      connected: [], evaluating: [], shortlisted: [], offer_extended: [], signed: [], rejected: [],
    };
    accepted.forEach(c => {
      const stage = c.recruitment_stage || 'connected';
      map[stage]?.push(c);
    });
    return map;
  }, [accepted]);

  const handleMove = async (connectionId: string, newStage: Stage) => {
    if (!firestore) return;
    setMoving(connectionId);
    try {
      await updateDoc(doc(firestore, 'scout_connections', connectionId), {
        recruitment_stage: newStage,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Stage updated', description: `Athlete moved to ${STAGES.find(s => s.id === newStage)?.label}.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update stage.' });
    } finally {
      setMoving(null);
    }
  };

  const visibleStages = activeStage === 'all' ? STAGES : STAGES.filter(s => s.id === activeStage);

  if (connectionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitPullRequestArrow className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Recruitment Pipeline</h2>
          <Badge variant="secondary">{accepted.length} athletes</Badge>
          {pending.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
              {pending.length} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveStage('all')}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-bold transition-colors',
            activeStage === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'
          )}
        >
          All stages
        </button>
        {STAGES.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveStage(s.id)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-bold transition-colors',
              activeStage === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'
            )}
          >
            {s.label}
            {byStage[s.id].length > 0 && (
              <span className={cn('ml-1.5 text-[10px]', activeStage === s.id ? 'opacity-80' : s.color)}>
                {byStage[s.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {accepted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <GitPullRequestArrow className="w-10 h-10 text-muted-foreground/20" />
            <p className="font-medium text-muted-foreground">No accepted connections yet</p>
            <p className="text-sm text-muted-foreground">
              When athletes accept your scouting requests, they appear here so you can track their recruitment stage.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => {}}>
              <ChevronRight className="w-3.5 h-3.5 mr-1" />
              Go to Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          'grid gap-4',
          activeStage === 'all'
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 max-w-sm'
        )}>
          {visibleStages.map(stage => {
            const cards = byStage[stage.id];
            if (activeStage === 'all' && cards.length === 0) return null;
            return (
              <div key={stage.id} className="space-y-2">
                <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl border', stage.bg)}>
                  <span className={cn('text-xs font-black uppercase tracking-wider', stage.color)}>{stage.label}</span>
                  <Badge variant="outline" className={cn('text-[10px] font-black border-current', stage.color)}>
                    {cards.length}
                  </Badge>
                </div>
                {cards.length === 0 ? (
                  <div className="border border-dashed rounded-xl p-6 text-center">
                    <p className="text-xs text-muted-foreground">No athletes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cards.map(c => (
                      <PipelineCard
                        key={c.id}
                        connection={c}
                        athlete={athleteMap[c.athleteId]}
                        onMove={handleMove}
                        moving={moving}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending requests notice */}
      {pending.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-black text-amber-700 flex items-center gap-2">
              {pending.length} Pending Request{pending.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1">
              {pending.map(c => {
                const a = athleteMap[c.athleteId];
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-amber-800">
                      {a ? `${a.firstName} ${a.lastName}` : c.athleteId}
                    </span>
                    <span className="text-xs text-amber-600">Awaiting response</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
