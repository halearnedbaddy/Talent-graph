'use client';

import { useState, useMemo } from 'react';
import type { ScoutProfile, AthleteProfile, ScoutConnection } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GitPullRequestArrow, ChevronRight, Loader2, ExternalLink, StickyNote, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Stage = ScoutConnection['recruitment_stage'];

const STAGES: { id: Stage; label: string; textColor: string; bg: string; dot: string }[] = [
  { id: 'connected',      label: 'Connected',      textColor: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    dot: 'bg-blue-400' },
  { id: 'evaluating',     label: 'Evaluating',     textColor: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  dot: 'bg-amber-400' },
  { id: 'shortlisted',    label: 'Shortlisted',    textColor: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20',dot: 'bg-purple-400' },
  { id: 'offer_extended', label: 'Offer Extended', textColor: 'text-[#00C853]',   bg: 'bg-[#00C853]/10 border-[#00C853]/20',  dot: 'bg-[#00C853]' },
  { id: 'signed',         label: 'Signed',         textColor: 'text-[#00C853]',   bg: 'bg-[#00C853]/15 border-[#00C853]/30',  dot: 'bg-[#00C853]' },
  { id: 'rejected',       label: 'Rejected',       textColor: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',      dot: 'bg-red-400' },
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
  noteValue: string;
  onNoteChange: (id: string, val: string) => void;
  onNoteSave: (id: string) => Promise<void>;
  savingNote: string | null;
}

function PipelineCard({ connection, athlete, onMove, moving, noteValue, onNoteChange, onNoteSave, savingNote }: AthleteCardProps) {
  const isMoving = moving === connection.id;
  const isSavingNote = savingNote === connection.id;
  const name = athlete ? `${athlete.firstName} ${athlete.lastName}` : connection.athleteId;

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-3 space-y-2.5 hover:border-[#1E293B]/80 transition-colors">
      {/* Athlete header */}
      <div className="flex items-center gap-2.5">
        {athlete?.photoUrl ? (
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#1E293B] shrink-0">
            <Image src={athlete.photoUrl} alt={name} width={36} height={36} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-[#1C2333] border border-[#1E293B] flex items-center justify-center text-xs font-black text-[#94A3B8] shrink-0">
            {getInitials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black truncate leading-tight text-white">{name}</p>
          {athlete && (
            <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider truncate">
              {athlete.position}{athlete.sport ? ` · ${athlete.sport}` : ''}
            </p>
          )}
        </div>
        {athlete?.username && (
          <Link href={`/${athlete.username}`} target="_blank">
            <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] hover:text-white transition-colors" />
          </Link>
        )}
      </div>

      {/* Stats row */}
      {athlete && (
        <div className="flex gap-1.5">
          <div className="flex-1 bg-[#1C2333] border border-[#1E293B] rounded-lg px-2 py-1 text-center">
            <p className="text-[9px] text-[#94A3B8] font-bold uppercase tracking-wider">Score</p>
            <p className="text-sm font-black text-white">{athlete.compositeScoutingIndex ? Math.round(athlete.compositeScoutingIndex) : '--'}</p>
          </div>
          <div className="flex-1 bg-[#1C2333] border border-[#1E293B] rounded-lg px-2 py-1 text-center">
            <p className="text-[9px] text-[#94A3B8] font-bold uppercase tracking-wider">Age</p>
            <p className="text-sm font-black text-white">{athlete.age ?? '--'}</p>
          </div>
          {athlete.isVerified && (
            <div className="flex-1 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg px-2 py-1 text-center">
              <p className="text-[9px] text-[#00C853] font-bold uppercase tracking-wider">Status</p>
              <p className="text-[10px] font-black text-[#00C853]">Verified</p>
            </div>
          )}
        </div>
      )}

      {/* Stage selector */}
      <Select
        value={connection.recruitment_stage}
        onValueChange={val => onMove(connection.id, val as Stage)}
        disabled={isMoving}
      >
        <SelectTrigger className="h-7 text-xs flex-1 font-bold bg-[#1C2333] border-[#1E293B] text-white">
          {isMoving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Moving...
            </span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent className="bg-[#111827] border-[#1E293B]">
          {STAGES.map(s => (
            <SelectItem key={s.id} value={s.id} className="text-xs font-bold text-white focus:bg-[#1C2333]">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Private notes */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <StickyNote className="w-3 h-3 text-[#94A3B8]" />
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Private Note</span>
          </div>
          {isSavingNote && (
            <span className="flex items-center gap-1 text-[10px] text-[#00C853]">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <textarea
          value={noteValue}
          onChange={e => onNoteChange(connection.id, e.target.value)}
          onBlur={() => onNoteSave(connection.id)}
          placeholder="Add a private note about this athlete..."
          rows={2}
          className="w-full text-xs bg-[#0A0E1A] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-[#94A3B8] placeholder:text-[#94A3B8]/30 resize-none focus:outline-none focus:border-[#00C853]/40 transition-colors"
        />
      </div>

      <p className="text-[10px] text-[#94A3B8]/60">
        Connected {new Date(connection.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
}

interface Props {
  scoutProfile: ScoutProfile;
  onGoToSearch?: () => void;
}

export function PipelineTab({ scoutProfile, onGoToSearch }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [moving, setMoving] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all');
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

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

  const handleNoteChange = (id: string, val: string) => {
    setEditNotes(prev => ({ ...prev, [id]: val }));
  };

  const handleNoteSave = async (id: string) => {
    if (!firestore) return;
    const note = editNotes[id] ?? connections?.find(c => c.id === id)?.notes ?? '';
    setSavingNote(id);
    try {
      await updateDoc(doc(firestore, 'scout_connections', id), {
        notes: note,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save note.' });
    } finally {
      setTimeout(() => setSavingNote(null), 1500);
    }
  };

  const getNoteValue = (conn: ScoutConnection) => {
    return editNotes[conn.id] !== undefined ? editNotes[conn.id] : (conn.notes ?? '');
  };

  const visibleStages = activeStage === 'all' ? STAGES : STAGES.filter(s => s.id === activeStage);

  const totalAccepted = accepted.length;
  const stageCounts = STAGES.map(s => ({ ...s, count: byStage[s.id].length })).filter(s => s.count > 0);

  if (connectionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitPullRequestArrow className="w-5 h-5 text-[#00C853]" />
          <h2 className="font-black text-white">Recruitment Pipeline</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#94A3B8] bg-[#1C2333] border border-[#1E293B] px-2.5 py-1 rounded-lg">
            {totalAccepted} athletes
          </span>
          {pending.length > 0 && (
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {pending.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Summary stats when there are athletes */}
      {totalAccepted > 0 && stageCounts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {stageCounts.map(s => (
            <div key={s.id} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold', s.bg)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
              <span className={s.textColor}>{s.label}</span>
              <span className={cn('font-black', s.textColor)}>{s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveStage('all')}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-bold transition-colors',
            activeStage === 'all'
              ? 'bg-[#00C853] text-black border-[#00C853]'
              : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#00C853]/40 hover:text-white'
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
              activeStage === s.id
                ? 'bg-[#00C853] text-black border-[#00C853]'
                : 'bg-[#1C2333] text-[#94A3B8] border-[#1E293B] hover:border-[#00C853]/40 hover:text-white'
            )}
          >
            {s.label}
            {byStage[s.id].length > 0 && (
              <span className={cn('ml-1.5 text-[10px]', activeStage === s.id ? 'text-black' : s.textColor)}>
                {byStage[s.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {accepted.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl py-16 flex flex-col items-center text-center gap-3 px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#1C2333] border border-[#1E293B] flex items-center justify-center">
            <GitPullRequestArrow className="w-7 h-7 text-[#94A3B8]/30" />
          </div>
          <div>
            <p className="font-black text-white">No accepted connections yet</p>
            <p className="text-sm text-[#94A3B8] mt-1">
              When athletes accept your scouting requests, they appear here so you can track their recruitment stage.
            </p>
          </div>
          <Button
            size="sm"
            className="mt-1 bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-wide text-xs"
            onClick={onGoToSearch}
          >
            <ChevronRight className="w-3.5 h-3.5 mr-1" />
            Go to Search
          </Button>
        </div>
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
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full', stage.dot)} />
                    <span className={cn('text-xs font-black uppercase tracking-wider', stage.textColor)}>{stage.label}</span>
                  </div>
                  <span className={cn('text-xs font-black', stage.textColor)}>{cards.length}</span>
                </div>
                {cards.length === 0 ? (
                  <div className="border border-dashed border-[#1E293B] rounded-xl p-6 text-center">
                    <p className="text-xs text-[#94A3B8]">No athletes</p>
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
                        noteValue={getNoteValue(c)}
                        onNoteChange={handleNoteChange}
                        onNoteSave={handleNoteSave}
                        savingNote={savingNote}
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
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-black text-amber-400">
            {pending.length} Pending Request{pending.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {pending.map(c => {
              const a = athleteMap[c.athleteId];
              return (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    {a ? `${a.firstName} ${a.lastName}` : c.athleteId}
                  </span>
                  <span className="text-xs text-amber-400/70 font-medium">Awaiting response</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
