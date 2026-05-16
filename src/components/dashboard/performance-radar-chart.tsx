'use client';
import { PolarGrid, PolarAngleAxis, Radar, RadarChart, ResponsiveContainer, PolarRadiusAxis, Tooltip } from 'recharts';
import type { AthleteProfile } from '@/lib/types';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock } from 'lucide-react';

interface PerformanceRadarChartProps {
  profile: AthleteProfile;
}

export function PerformanceRadarChart({ profile }: PerformanceRadarChartProps) {
  const chartData = useMemo(() => {
    if (!profile.metricScores) return [];
    
    // Explicit 8 points requested
    const points = [
      'Illinois Agility',
      '30m Sprint',
      'Vertical Jump',
      'Physical',
      'Tactical',
      'Impact',
      'Technical',
      'Pass Completion'
    ];

    return points.map(p => ({
      subject: p,
      score: profile.metricScores?.[p] || 50,
      fullMark: 100,
    }));
  }, [profile.metricScores]);

  if (chartData.length < 3) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <p className="text-sm font-bold uppercase tracking-widest">Complete Match History to Generate Radar</p>
        </div>
    );
  }

  const isVerified = profile.isVerified;

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="mb-4">
        {isVerified ? (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" /> Coach Verified ✅
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" /> Self Reported ⏳
          </Badge>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid gridType="polygon" stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900, textAnchor: 'middle' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar 
              name="Score" 
              dataKey="score" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary))" 
              fillOpacity={0.4} 
          />
          <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-neutral-900 text-white p-3 rounded-xl border border-white/10 shadow-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{data.subject}</p>
                      <p className="text-xl font-black">{data.score} <span className="text-[10px] text-neutral-500">/ 100</span></p>
                    </div>
                  );
                }
                return null;
              }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}