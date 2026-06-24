'use client';

import { useState, useMemo } from 'react';
import type { ScoutProfile, AthleteProfile, ScoutConnection } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  GitPullRequestArrow, ChevronRight, Loader2, ExternalLink,
  StickyNote, Check, Sparkles, Trophy, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ShortlistOutput, RankedAthlete } from '@/ai/flows/shortlist-athletes';

type Stage = ScoutConnection['recruitment_stage'];

const STAGES: { id: Stage; label: string; textColor: string; bg: string; dot: string }[] = [
  { id: 'connected',      label: 'Connected',      textColor: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    dot: 'bg-blue-400' },
  { id: 'evaluating',     label: 'Evaluating',     textColor: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  dot: 'bg-amber-400' },
  { id: 'shortlisted',    label: 'Shortlisted',    textColor: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20',dot: 'bg-purple-400' },
  { id: 'offer_extended', label: 'Offer Extended', textColor: 'text-[#00C853]',   bg: 'bg-[#00C853]/10 border-[#00C853]/20',  dot: 'bg-[#00C853]' },
  { id: 'signed',         label: 'Signed',         textColor: 'text-[#00C853]',   bg: 'bg-[#00C853]/15 border-[#00C853]/30',  dot: 'bg-[#00C853]' },
  { id: 'rejected',       label: 'Rejected',       textColor: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',      dot: 'bg-red-400' },
];

const FIT_STYLES: Record<RankedAthlete['fitLabel'], { bar: string; text: string; bg: string; border: string }> = {
  'Excellent Fit': { bar: 'bg-[#00C853]',    text: 'text-[#00C853]',    bg: 'bg-[#00C853]/10',    border: 'border-[#00C853]/30' },
  'Strong Fit':    { bar: 'bg-emerald-400',  text: 'text-emerald-400',  bg: 'bg-emerald-400/10',  border: 'border-emerald-400/30' },
  'Good Fit':      { bar: 'bg-amber-400',    text: 'text-amber-400',    bg: 'bg-amber-400/10',    border: 'border-amber-400/30' },
  'Partial Fit':   { bar: 'bg-orange-400',   text: 'text-orange-400',   bg: 'bg-orange-400/10',   border: 'border-orange-400/30' },
  'Poor Fit':      { bar: 'bg-red-400',      text: 'text-red-400',      bg: 'bg-red-400/10',      border: 'border-red-400/30' },
};

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
  aiRank?: RankedAthlete;
  isTopPick?: boolean;
}

function PipelineCard({
  connection, athlete, onMove, moving,
  noteValue, onNoteChange, onNoteSave, savingNote,
  aiRank, isTopPick,
}: AthleteCardProps) {
  const isMoving = moving === connection.id;
  const isSavingNote = savingNote === connection.id;
  const name = athlete ? `${athlete.firstName} ${athlete.lastName}` : connection.athleteId;
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const fitStyle = aiRank ? FIT_STYLES[aiRank.fitLabel] : null;

  return (
    <div className={cn(
      'bg-[#111827] border rounded-2xl p-3 space-y-2.5 transition-colors',
      isTopPick ? 'border-[#00C853]/40 ring-1 ring-[#00C853]/20' : 'border-[#1E293B] hover:border-[#1E293B]/80'
    )}>
      {/* Top pick badge */}
      {isTopPick && (
        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#00C853] uppercase tracking-wider">
          <Trophy className="w-3 h-3" />
          Top Pick
        </div>
      )}

      {/* AI fit banner */}
      {aiRank && fitStyle && (
        <div className={cn('rounded-xl border px-2.5 py-2 space-y-1.5', fitStyle.bg, fitStyle.border)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className={cn('w-3 h-3', fitStyle.text)} />
              <span className={cn('text-[10px] font-black uppercase tracking-wider', fitStyle.text)}>{aiRank.fitLabel}</span>
            </div>
            <span className={cn('text-xs font-black tabular-nums', fitStyle.text)}>{aiRank.fitScore}/100</span>
          </div>
          {/* Score bar */}
          <div className="h-1 bg-[#0A0E1A] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', fitStyle.bar)}
              style={{ width: `${aiRank.fitScore}%` }}
            />
          </div>
          <p className={cn('text-[11px] leading-snug', fitStyle.text)}>{aiRank.headline}</p>
          {/* Expand reasons */}
          {(aiRank.reasons?.length > 0 || aiRank.concerns?.length > 0) && (
            <button
              onClick={() => setReasonsOpen(o => !o)}
              className={cn('flex items-center gap-1 text-[10px] font-bold opacity-70 hover:opacity-100', fitStyle.text)}
            >
              {reasonsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {reasonsOpen ? 'Hide details' : 'See reasons'}
            </button>
          )}
          {reasonsOpen && (
            <div className="space-y-1.5 pt-0.5">
              {aiRank.reasons?.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 mt-0.5 shrink-0 text-[#00C853]" />
                  <span className="text-[11px] text-[#94A3B8]">{r}</span>
                </div>
              ))}
              {aiRank.concerns?.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                  <span className="text-[11px] text-[#94A3B8]">{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
  const { user } = useUser();
  const { toast } = useToast();
  const [moving, setMoving] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all');
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // AI shortlist
  const [aiOpen, setAiOpen] = useState(false);
  const [criteria, setCriteria] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<ShortlistOutput | null>(null);

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

  // Build aiRankMap for fast lookup
  const aiRankMap = useMemo(() => {
    if (!aiResult) return {};
    const map: Record<string, RankedAthlete & { rank: number }> = {};
    aiResult.rankedAthletes.forEach((r, i) => { map[r.id] = { ...r, rank: i + 1 }; });
    return map;
  }, [aiResult]);

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
    const note = editNotes[id] ?? (connections?.find(c => c.id === id) as any)?.notes ?? '';
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
    return editNotes[conn.id] !== undefined ? editNotes[conn.id] : ((conn as any).notes ?? '');
  };

  const handleAiShortlist = async () => {
    if (!user || !criteria.trim() || accepted.length === 0) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const idToken = await user.getIdToken();
      const athletes = accepted.map(c => {
        const a = athleteMap[c.athleteId];
        return {
          id: c.id,
          name: a ? `${a.firstName} ${a.lastName}` : c.athleteId,
          position: a?.position,
          altPositions: a?.altPositions,
          age: a?.age,
          country: a?.country,
          clubName: a?.clubName,
          compositeScoutingIndex: a?.compositeScoutingIndex,
          performanceIndex: a?.performanceIndex,
          efficiencyIndex: a?.efficiencyIndex,
          consistencyIndex: a?.consistencyIndex,
          developmentIndex: a?.developmentIndex,
          isVerified: a?.isVerified,
          activelyLooking: a?.activelyLooking,
          recruitment_stage: c.recruitment_stage,
          scoutNotes: getNoteValue(c) || (c as any).notes,
          heightCm: a?.heightCm,
          dominantFoot: a?.dominantFoot,
        };
      });

      const res = await fetch('/api/ai/shortlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ criteria: criteria.trim(), athletes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setAiResult(data.result);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Shortlist failed',
        description: err instanceof Error ? err.message : 'Could not generate shortlist.',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const visibleStages = activeStage === 'all' ? STAGES : STAGES.filter(s => s.id === activeStage);
  const totalAccepted = accepted.length;
  const stageCounts = STAGES.map(s => ({ ...s, count: byStage[s.id].length })).filter(s => s.count > 0);

  // When AI results are showing, sort accepted connections by AI rank
  const sortedAccepted = useMemo(() => {
    if (!aiResult) return accepted;
    return [...accepted].sort((a, b) => {
      const ra = aiRankMap[a.id]?.rank ?? 999;
      const rb = aiRankMap[b.id]?.rank ?? 999;
      return ra - rb;
    });
  }, [accepted, aiResult, aiRankMap]);

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
          {totalAccepted > 0 && (
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-[#00C853]/10 hover:bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/30 font-black text-xs uppercase tracking-wide"
              variant="outline"
              onClick={() => { setAiResult(null); setAiOpen(true); }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Suggest Best Fit
            </Button>
          )}
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

      {/* Summary stats */}
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

      {/* AI result banner */}
      {aiResult && (
        <div className="bg-[#00C853]/5 border border-[#00C853]/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00C853]" />
              <span className="text-sm font-black text-[#00C853]">AI Shortlist Results</span>
            </div>
            <button
              onClick={() => setAiResult(null)}
              className="text-[10px] text-[#94A3B8] hover:text-white font-bold uppercase tracking-wide"
            >
              Clear
            </button>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">{aiResult.summary}</p>
          <p className="text-[10px] text-[#94A3B8]/60 font-bold uppercase tracking-wider">
            Athletes ranked by fit · tap ↓ on any card to expand reasons
          </p>
        </div>
      )}

      {/* Stage filter pills — hidden when AI results shown */}
      {!aiResult && (
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
      )}

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
      ) : aiResult ? (
        /* AI view — flat ranked list */
        <div className="space-y-3">
          {sortedAccepted.map((c, idx) => (
            <div key={c.id} className="flex gap-3 items-start">
              <div className="shrink-0 w-6 h-6 rounded-full bg-[#1C2333] border border-[#1E293B] flex items-center justify-center text-[10px] font-black text-[#94A3B8] mt-1">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <PipelineCard
                  connection={c}
                  athlete={athleteMap[c.athleteId]}
                  onMove={handleMove}
                  moving={moving}
                  noteValue={getNoteValue(c)}
                  onNoteChange={handleNoteChange}
                  onNoteSave={handleNoteSave}
                  savingNote={savingNote}
                  aiRank={aiRankMap[c.id]}
                  isTopPick={c.id === aiResult.topPickId}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Normal stage-grouped view */
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

      {/* AI Shortlist Dialog */}
      <Dialog open={aiOpen} onOpenChange={o => { if (!o) { setAiOpen(false); } }}>
        <DialogContent className="max-w-sm bg-[#111827] border-[#1E293B]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="w-4 h-4 text-[#00C853]" />
              Suggest Best Fit
            </DialogTitle>
          </DialogHeader>

          {!aiResult ? (
            <div className="space-y-4">
              <div className="bg-[#0A0E1A] border border-[#1E293B] rounded-xl p-3 space-y-1">
                <p className="text-[11px] font-black text-[#00C853] uppercase tracking-wider">How it works</p>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Describe the role you need to fill. Gemini AI will analyse all {accepted.length} athletes in your pipeline — their position, age, CSI scores, verified status, and your private notes — and rank them by how well they match.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Describe your target role</Label>
                <Textarea
                  placeholder={`e.g. "Left-back, under 22, strong defensively, must be verified and actively looking for a move. Preferably Kenyan."`}
                  value={criteria}
                  onChange={e => setCriteria(e.target.value)}
                  className="h-28 text-sm bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 resize-none focus-visible:ring-[#00C853]/30"
                  maxLength={400}
                />
                <p className="text-xs text-right text-[#94A3B8]/60">{criteria.length}/400</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#0A0E1A] border border-[#00C853]/20 rounded-xl p-3 space-y-1">
              <p className="text-[11px] font-black text-[#00C853] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Results ready
              </p>
              <p className="text-xs text-[#94A3B8]">Your {accepted.length} pipeline athletes have been ranked. Close this dialog to view them.</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#1E293B] text-[#94A3B8] hover:text-white bg-transparent"
              onClick={() => setAiOpen(false)}
            >
              {aiResult ? 'View Results' : 'Cancel'}
            </Button>
            {!aiResult && (
              <Button
                onClick={handleAiShortlist}
                disabled={aiLoading || !criteria.trim() || accepted.length === 0}
                className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-wide text-xs gap-1.5"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analysing {accepted.length} athletes…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyse Pipeline
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
