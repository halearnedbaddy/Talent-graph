'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import type { MatchEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  matchHistory: MatchEntry[];
}

type Metric = 'rating' | 'goals' | 'assists' | 'ga' | 'minutes';

const METRIC_CONFIG: Record<Metric, { label: string; color: string; domain: [number | 'auto', number | 'auto']; decimals: number }> = {
  rating:  { label: 'Rating',       color: '#6366f1', domain: [0, 10],      decimals: 1 },
  goals:   { label: 'Goals',        color: '#22c55e', domain: ['auto', 'auto'], decimals: 0 },
  assists: { label: 'Assists',      color: '#f59e0b', domain: ['auto', 'auto'], decimals: 0 },
  ga:      { label: 'G + A',        color: '#ec4899', domain: ['auto', 'auto'], decimals: 0 },
  minutes: { label: 'Minutes',      color: '#38bdf8', domain: ['auto', 'auto'], decimals: 0 },
};

function getTrend(values: number[]): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  const recent = values.slice(-3);
  const older  = values.slice(0, Math.max(1, values.length - 3));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg  = older.reduce((a, b)  => a + b, 0) / older.length;
  if (recentAvg > olderAvg + 0.1) return 'up';
  if (recentAvg < olderAvg - 0.1) return 'down';
  return 'flat';
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-green-500" />;
  if (direction === 'down') return <TrendingDown  className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function StatPill({
  label, value, sub, trend,
}: { label: string; value: string | number; sub?: string; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 px-3 py-2.5 gap-0.5 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <span className="text-xl font-black tabular-nums leading-none">{value}</span>
        {trend && <TrendIcon direction={trend} />}
      </div>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const cfg = METRIC_CONFIG[metric as Metric];
  const val = payload[0]?.value;
  return (
    <div className="rounded-lg border bg-background shadow-lg px-3 py-2 text-xs space-y-0.5">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground truncate max-w-[140px]">{label}</p>
      <p className="font-black" style={{ color: cfg.color }}>
        {cfg.label}: {typeof val === 'number' ? val.toFixed(cfg.decimals) : '--'}
      </p>
    </div>
  );
}

export function MatchPerformanceChart({ matchHistory }: Props) {
  const [metric, setMetric] = useState<Metric>('rating');

  const sorted = useMemo(
    () => [...matchHistory].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [matchHistory]
  );

  const chartData = useMemo(() =>
    sorted.map((m, i) => ({
      label: m.competition ? (m.competition.length > 16 ? m.competition.slice(0, 14) + '…' : m.competition) : `M${i + 1}`,
      fullLabel: m.competition || `Match ${i + 1}`,
      rating:  Number(m.rating)   || 0,
      goals:   Number(m.goals)    || 0,
      assists: Number(m.assists)  || 0,
      ga:      (Number(m.goals) || 0) + (Number(m.assists) || 0),
      minutes: Number(m.minutes)  || 0,
      verified: m.isVerified,
      motm: m.manOfTheMatch,
    })),
    [sorted]
  );

  const totals = useMemo(() => {
    const goals   = sorted.reduce((s, m) => s + (Number(m.goals)   || 0), 0);
    const assists = sorted.reduce((s, m) => s + (Number(m.assists) || 0), 0);
    const ratingSum = sorted.reduce((s, m) => s + (Number(m.rating) || 0), 0);
    const avgRating = sorted.length > 0 ? ratingSum / sorted.length : 0;
    const motm = sorted.filter(m => m.manOfTheMatch).length;
    const minutes = sorted.reduce((s, m) => s + (Number(m.minutes) || 0), 0);
    return { goals, assists, avgRating, motm, minutes };
  }, [sorted]);

  const trend = useMemo(() => getTrend(chartData.map(d => d[metric] as number)), [chartData, metric]);
  const cfg = METRIC_CONFIG[metric];

  // Average line value
  const avgValue = chartData.length > 0
    ? chartData.reduce((s, d) => s + (d[metric] as number), 0) / chartData.length
    : 0;

  if (matchHistory.length === 0) {
    return (
      <Card className="border-none shadow-lg bg-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Performance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-xs font-bold">No matches logged yet</p>
            <p className="text-[10px]">Log your first match to start tracking performance trends.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Performance History
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <TrendIcon direction={trend} />
            <Badge
              variant="secondary"
              className={cn(
                'text-[9px] font-black uppercase',
                trend === 'up' && 'bg-green-500/10 text-green-600 border-green-300',
                trend === 'down' && 'bg-red-500/10 text-red-500 border-red-300',
              )}
            >
              {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
            </Badge>
            <Badge variant="outline" className="text-[9px] font-black uppercase">
              {sorted.length} match{sorted.length !== 1 ? 'es' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stat pills */}
        <div className="grid grid-cols-4 gap-2">
          <StatPill label="Goals"   value={totals.goals}   trend={getTrend(chartData.map(d => d.goals))} />
          <StatPill label="Assists" value={totals.assists} trend={getTrend(chartData.map(d => d.assists))} />
          <StatPill label="Avg Rating" value={totals.avgRating.toFixed(1)} trend={getTrend(chartData.map(d => d.rating))} />
          <StatPill label="MOTM" value={totals.motm} sub={`of ${sorted.length}`} />
        </div>

        {/* Metric selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {(Object.entries(METRIC_CONFIG) as [Metric, typeof METRIC_CONFIG[Metric]][]).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={cn(
                'h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wide border transition-all',
                metric === key
                  ? 'text-white border-transparent'
                  : 'bg-transparent text-muted-foreground border-muted hover:border-primary/40 hover:text-foreground'
              )}
              style={metric === key ? { backgroundColor: c.color, borderColor: c.color } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={cfg.domain}
                tick={{ fontSize: 9, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
              />
              <Tooltip content={<CustomTooltip metric={metric} />} />
              {chartData.length > 1 && (
                <ReferenceLine
                  y={avgValue}
                  stroke={cfg.color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                  label={{ value: `avg ${avgValue.toFixed(cfg.decimals)}`, position: 'insideTopRight', fontSize: 9, fill: cfg.color, fontWeight: 700 }}
                />
              )}
              <Area
                type="monotone"
                dataKey={metric}
                stroke={cfg.color}
                strokeWidth={2.5}
                fill={`url(#grad-${metric})`}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.motm) {
                    return (
                      <g key={`dot-${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r={5} fill={cfg.color} stroke="white" strokeWidth={1.5} />
                        <text x={cx} y={cy - 9} textAnchor="middle" fontSize={8} fill={cfg.color} fontWeight={900}>★</text>
                      </g>
                    );
                  }
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={cfg.color} stroke="white" strokeWidth={1} />;
                }}
                activeDot={{ r: 5, fill: cfg.color, stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[9px] text-muted-foreground text-center">
          ★ = Man of the Match · Dashed line = career average · {sorted.length} entries ordered chronologically
        </p>
      </CardContent>
    </Card>
  );
}
