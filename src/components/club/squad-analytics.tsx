'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { AthleteProfile } from '@/lib/types';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface SquadAnalyticsProps {
  athletes: AthleteProfile[];
}

const POSITION_COLORS: Record<string, string> = {
  Forward: '#f97316',
  Midfielder: '#3b82f6',
  Defender: '#22c55e',
  Goalkeeper: '#a855f7',
  Other: '#6b7280',
};

function normalizePosition(raw?: string): string {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase();
  if (lower.includes('forward') || lower.includes('striker') || lower.includes('winger') || lower === 'fw') return 'Forward';
  if (lower.includes('midfielder') || lower.includes('midfield') || lower === 'mf' || lower === 'cm' || lower === 'am' || lower === 'dm') return 'Midfielder';
  if (lower.includes('defender') || lower.includes('back') || lower === 'df' || lower === 'cb' || lower === 'lb' || lower === 'rb') return 'Defender';
  if (lower.includes('goalkeeper') || lower.includes('keeper') || lower === 'gk') return 'Goalkeeper';
  return 'Other';
}

export function SquadAnalytics({ athletes }: SquadAnalyticsProps) {
  const positionData = useMemo(() => {
    const counts: Record<string, number> = {};
    athletes.forEach(a => {
      const pos = normalizePosition(a.position);
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count);
  }, [athletes]);

  const csiTrendData = useMemo(() => {
    const monthBuckets: Record<string, { total: number; count: number }> = {};

    athletes.forEach(a => {
      if (!a.matchHistory?.length) return;
      a.matchHistory.forEach(entry => {
        const dateStr = (entry as any).updatedAt || (entry as any).date;
        if (!dateStr || typeof entry.rating !== 'number') return;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthBuckets[key]) monthBuckets[key] = { total: 0, count: 0 };
        monthBuckets[key].total += entry.rating;
        monthBuckets[key].count += 1;
      });
    });

    if (Object.keys(monthBuckets).length === 0) {
      athletes.forEach(a => {
        if (!a.rawMetrics) return;
        Object.values(a.rawMetrics).forEach(entries => {
          entries.forEach(entry => {
            if (!entry.measuredAt || typeof entry.value !== 'number') return;
            const d = new Date(entry.measuredAt);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthBuckets[key]) monthBuckets[key] = { total: 0, count: 0 };
            monthBuckets[key].total += entry.value;
            monthBuckets[key].count += 1;
          });
        });
      });
    }

    return Object.entries(monthBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, { total, count }]) => ({
        month,
        avg: Math.round((total / count) * 10) / 10,
      }));
  }, [athletes]);

  const ageData = useMemo(() => {
    const brackets: Record<string, number> = {
      'U18': 0,
      '18–21': 0,
      '22–25': 0,
      '26–29': 0,
      '30+': 0,
    };
    athletes.forEach(a => {
      const age = typeof a.age === 'number' ? a.age : 0;
      if (age < 18) brackets['U18']++;
      else if (age <= 21) brackets['18–21']++;
      else if (age <= 25) brackets['22–25']++;
      else if (age <= 29) brackets['26–29']++;
      else brackets['30+']++;
    });
    return Object.entries(brackets).map(([bracket, count]) => ({ bracket, count }));
  }, [athletes]);

  const hasAnyData = athletes.length > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-background border rounded-lg px-3 py-2 shadow-lg text-xs font-bold">
        <p className="text-muted-foreground uppercase tracking-widest text-[9px]">{label}</p>
        <p className="text-primary">{payload[0]?.value}</p>
      </div>
    );
  };

  if (!hasAnyData) {
    return (
      <div className="text-center py-12 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
        No squad data available for analytics
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black tracking-tight uppercase">Squad Analytics</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live data from squad records</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Position Heatmap */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b p-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Position Breakdown</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Players per position</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {positionData.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No position data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={positionData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="position" tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {positionData.map((entry) => (
                      <Cell key={entry.position} fill={POSITION_COLORS[entry.position] || POSITION_COLORS.Other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {positionData.map(d => (
                <div key={d.position} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: POSITION_COLORS[d.position] || POSITION_COLORS.Other }} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{d.position} ({d.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CSI Score Trend */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b p-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">CSI Score Trend</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">
              {csiTrendData.length > 0 ? 'Avg squad rating over time' : 'No historical match data yet'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {csiTrendData.length === 0 ? (
              <div className="space-y-2">
                <div className="flex h-40 items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center px-4">
                  Match history data will appear here once athletes log matches
                </div>
                <div className="border rounded-lg divide-y">
                  {athletes.slice(0, 5).sort((a, b) => (b.compositeScoutingIndex || 0) - (a.compositeScoutingIndex || 0)).map(a => (
                    <div key={a.uid} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-black uppercase truncate max-w-[120px]">{a.firstName} {a.lastName}</span>
                      <span className="text-[10px] font-black text-primary">{a.compositeScoutingIndex ?? '--'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={csiTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 8, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b p-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Age Distribution</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Players per age bracket</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {ageData.every(d => d.count === 0) ? (
              <div className="flex h-40 items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No age data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bracket" tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 grid grid-cols-5 gap-1">
              {ageData.map(d => (
                <div key={d.bracket} className="text-center">
                  <p className="text-sm font-black">{d.count}</p>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">{d.bracket}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
