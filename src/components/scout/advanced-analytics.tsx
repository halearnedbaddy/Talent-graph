'use client';

import { AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PerformanceRadarChart } from '../dashboard/performance-radar-chart';
import { PolarGrid, PolarAngleAxis, Radar, RadarChart, ResponsiveContainer, PolarRadiusAxis, Legend, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Award, Target, Zap } from 'lucide-react';

interface AdvancedAnalyticsProps {
  scoutedAthletes: AthleteProfile[];
}

export function AdvancedAnalytics({ scoutedAthletes }: AdvancedAnalyticsProps) {
  const comparisonData = [
    { pillar: 'Technical' },
    { pillar: 'Tactical' },
    { pillar: 'Physical' },
    { pillar: 'Impact' },
  ].map(p => {
    const data: any = { subject: p.pillar, fullMark: 100 };
    scoutedAthletes.slice(0, 4).forEach(a => {
      data[a.uid] = a.metricScores?.[p.pillar] || 0;
    });
    return data;
  });

  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  if (scoutedAthletes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-dashed rounded-xl">
        <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-bold text-foreground">No Scouted Athletes</h3>
        <p className="max-w-xs text-sm mt-1">Connect with athletes to unlock advanced squad analytics and comparison tools.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Squad Comparison (4-Pillars)</CardTitle>
            <CardDescription>Overlaid performance metrics for your top 4 candidates.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={comparisonData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                {scoutedAthletes.slice(0, 4).map((a, i) => (
                  <Radar
                    key={a.uid}
                    name={`${a.firstName} ${a.lastName}`}
                    dataKey={a.uid}
                    stroke={colors[i]}
                    fill={colors[i]}
                    fillOpacity={0.2}
                  />
                ))}
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>CSI Leaderboard</CardTitle>
            <CardDescription>Ranked institutional output across your scouted pool.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead className="text-right">CSI</TableHead>
                  <TableHead className="text-right">Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scoutedAthletes
                  .sort((a, b) => (b.compositeScoutingIndex || 0) - (a.compositeScoutingIndex || 0))
                  .map(a => (
                    <TableRow key={a.uid}>
                      <TableCell className="font-bold">{a.firstName} {a.lastName}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{a.compositeScoutingIndex || '--'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{a.readinessTier || 'Raw'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Avg. Consistency', icon: Zap, value: Math.round(scoutedAthletes.reduce((acc, a) => acc + (a.consistencyIndex || 0), 0) / scoutedAthletes.length) },
          { label: 'Avg. Efficiency', icon: Target, value: Math.round(scoutedAthletes.reduce((acc, a) => acc + (a.efficiencyIndex || 0), 0) / scoutedAthletes.length) },
          { label: 'Elite Projections', icon: Award, value: scoutedAthletes.filter(a => a.readinessTier === 'Elite').length },
        ].map(stat => (
          <Card key={stat.label} className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</p>
              <p className="text-3xl font-black mt-1">{stat.value}</p>
            </div>
            <stat.icon className="w-8 h-8 text-primary/20" />
          </Card>
        ))}
      </div>
    </div>
  );
}