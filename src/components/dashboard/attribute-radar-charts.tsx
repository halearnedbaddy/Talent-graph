'use client';

import { AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PolarGrid, PolarAngleAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, PolarRadiusAxis } from 'recharts';
import { ATTRIBUTE_LIST } from '@/lib/metrics';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock } from 'lucide-react';

function AttributeRadar({ data, category, isVerified }: { data: any[], category: string, isVerified: boolean }) {
  return (
    <div className="h-[400px] w-full relative">
      <div className="absolute top-0 right-0 z-10">
        {isVerified ? (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 text-[9px] font-black uppercase">
            <ShieldCheck className="w-3 h-3" /> VERIFIED ✅
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[9px] font-black uppercase">
            <Clock className="w-3 h-3" /> REPORTED ⏳
          </Badge>
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: 700 }}
          />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name={category}
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-neutral-900 text-white p-2 rounded-lg border border-white/10 text-xs shadow-xl">
                    <p className="font-black uppercase tracking-widest">{item.subject}</p>
                    <p className="text-lg font-black text-primary">{item.value} <span className="text-[10px] text-neutral-500">/ 10</span></p>
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

export function AttributeRadarCharts({ profile }: { profile: AthleteProfile }) {
  const getChartData = (category: keyof typeof ATTRIBUTE_LIST) => {
    const list = ATTRIBUTE_LIST[category];
    const scores = profile.detailedAttributes?.[category] || {};
    return list.map(attr => ({
      subject: attr,
      value: scores[attr] || 5, // Default to 5 if not set
      fullMark: 10
    }));
  };

  return (
    <Card className="border-none shadow-lg bg-background">
      <CardHeader>
        <CardTitle className="text-lg font-black uppercase tracking-widest">Player Attributes</CardTitle>
        <CardDescription>Comprehensive tactical and technical profile (Scale 1-10).</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="Technical" className="w-full">
          <TabsList className="grid grid-cols-3 mb-8 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="Technical" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background">Technical</TabsTrigger>
            <TabsTrigger value="Mental" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background">Mental</TabsTrigger>
            <TabsTrigger value="Physical" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background">Physical</TabsTrigger>
          </TabsList>
          
          <TabsContent value="Technical">
            <AttributeRadar data={getChartData('Technical')} category="Technical" isVerified={!!profile.isVerified} />
          </TabsContent>
          <TabsContent value="Mental">
            <AttributeRadar data={getChartData('Mental')} category="Mental" isVerified={!!profile.isVerified} />
          </TabsContent>
          <TabsContent value="Physical">
            <AttributeRadar data={getChartData('Physical')} category="Physical" isVerified={!!profile.isVerified} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}