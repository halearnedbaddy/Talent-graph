'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ScoutConnection, AthleteProfile } from '@/lib/types';
import { TrendingUp, Users, Star, FileCheck, Trophy, XCircle, ArrowRight } from 'lucide-react';

interface RecruitmentPipelineProps {
  connections: ScoutConnection[];
  athletes: AthleteProfile[];
}

type Stage = 'connected' | 'evaluating' | 'shortlisted' | 'offer_extended' | 'signed' | 'rejected';

const STAGES: { key: Stage; label: string; short: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
  { key: 'connected',     label: 'Connected',     short: 'CON', icon: Users,      color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/30'    },
  { key: 'evaluating',    label: 'Evaluating',    short: 'EVL', icon: TrendingUp, color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30'   },
  { key: 'shortlisted',   label: 'Shortlisted',   short: 'SHT', icon: Star,       color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30'  },
  { key: 'offer_extended',label: 'Offer Extended', short: 'OFR', icon: FileCheck,  color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30' },
  { key: 'signed',        label: 'Signed',         short: 'SGN', icon: Trophy,     color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
];

const REJECTED: typeof STAGES[0] = {
  key: 'rejected', label: 'Rejected', short: 'REJ', icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30'
};

function getInitials(a: AthleteProfile) {
  return `${a.firstName?.[0] ?? ''}${a.lastName?.[0] ?? ''}`.toUpperCase();
}

export function RecruitmentPipeline({ connections, athletes }: RecruitmentPipelineProps) {
  const athleteMap = useMemo(() => {
    const m = new Map<string, AthleteProfile>();
    athletes.forEach(a => m.set(a.uid, a));
    return m;
  }, [athletes]);

  const grouped = useMemo(() => {
    const map: Record<Stage, ScoutConnection[]> = {
      connected: [], evaluating: [], shortlisted: [],
      offer_extended: [], signed: [], rejected: [],
    };
    connections.forEach(c => {
      const stage = c.recruitment_stage as Stage;
      if (map[stage]) map[stage].push(c);
    });
    return map;
  }, [connections]);

  const total = connections.length;

  if (total === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-black tracking-tight uppercase">Recruitment Pipeline</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live progression from prospect to signed</p>
        </div>
        <Card className="border-none shadow-xl bg-background">
          <CardContent className="p-10 text-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
            No connected athletes yet — pipeline will appear once scouts make connections
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black tracking-tight uppercase">Recruitment Pipeline</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live progression from prospect to signed</p>
      </div>

      {/* Funnel summary bar */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b p-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest">Funnel Overview</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-tight">{total} athlete{total !== 1 ? 's' : ''} in pipeline</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {/* Stage steps with arrows */}
          <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
            {STAGES.map((stage, i) => {
              const count = grouped[stage.key].length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const Icon = stage.icon;
              return (
                <React.Fragment key={stage.key}>
                  <div className={`flex-1 min-w-[80px] flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg ${stage.bg} border ${stage.border}`}>
                    <Icon className={`w-4 h-4 ${stage.color}`} />
                    <span className={`text-xl font-black ${stage.color}`}>{count}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center leading-tight">{stage.label}</span>
                    <span className="text-[8px] font-bold text-muted-foreground">{pct}%</span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className="flex items-center px-1 shrink-0">
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {grouped.rejected.length > 0 && (
              <>
                <div className="flex items-center px-2 shrink-0">
                  <div className="w-px h-8 bg-border" />
                </div>
                <div className={`min-w-[80px] flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg ${REJECTED.bg} border ${REJECTED.border}`}>
                  <XCircle className={`w-4 h-4 ${REJECTED.color}`} />
                  <span className={`text-xl font-black ${REJECTED.color}`}>{grouped.rejected.length}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center leading-tight">{REJECTED.label}</span>
                  <span className="text-[8px] font-bold text-muted-foreground">
                    {Math.round((grouped.rejected.length / total) * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Conversion rate */}
          {grouped.signed.length > 0 && (
            <div className="mt-4 pt-3 border-t flex items-center gap-3">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-black text-[9px] uppercase tracking-widest">
                {Math.round((grouped.signed.length / total) * 100)}% conversion
              </Badge>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {grouped.signed.length} of {total} prospects signed
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAGES.map(stage => {
          const stageConnections = grouped[stage.key];
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="space-y-2">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${stage.bg} border ${stage.border}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${stage.color}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${stage.color}`}>{stage.label}</span>
                </div>
                <span className={`text-xs font-black ${stage.color}`}>{stageConnections.length}</span>
              </div>

              {/* Athlete cards */}
              <div className="space-y-2">
                {stageConnections.length === 0 ? (
                  <div className={`rounded-lg border ${stage.border} border-dashed p-4 text-center`}>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Empty</p>
                  </div>
                ) : (
                  stageConnections.map(conn => {
                    const athlete = athleteMap.get(conn.athleteId);
                    if (!athlete) return null;
                    return (
                      <div key={conn.id} className={`rounded-xl border ${stage.border} bg-background p-3 shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${stage.bg} flex items-center justify-center font-black text-[10px] ${stage.color} shrink-0`}>
                            {getInitials(athlete)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase leading-tight truncate">
                              {athlete.firstName} {athlete.lastName}
                            </p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                              {athlete.position || 'Unknown'}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                {athlete.age ? `${athlete.age}y` : '—'}
                              </span>
                              {athlete.compositeScoutingIndex != null && (
                                <span className="text-[10px] font-black text-primary">
                                  {athlete.compositeScoutingIndex}
                                  <span className="text-[8px] font-bold text-muted-foreground ml-0.5">CSI</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                            Since {new Date(conn.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rejected section (collapsed at bottom) */}
      {grouped.rejected.length > 0 && (
        <Card className="border-none shadow-sm bg-background overflow-hidden">
          <CardHeader className="bg-red-500/5 border-b border-red-500/20 p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <CardTitle className="text-sm font-black uppercase tracking-widest text-red-400">
                Rejected / Declined ({grouped.rejected.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {grouped.rejected.map(conn => {
                const athlete = athleteMap.get(conn.athleteId);
                if (!athlete) return null;
                return (
                  <div key={conn.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-400/5 border border-red-400/20">
                    <div className="w-6 h-6 rounded-md bg-red-400/10 flex items-center justify-center font-black text-[9px] text-red-400">
                      {getInitials(athlete)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase leading-none">{athlete.firstName} {athlete.lastName}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{athlete.position || '—'}</p>
                    </div>
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
