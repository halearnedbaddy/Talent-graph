'use client';

import { AthleteProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Zap, TrendingUp, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { differenceInDays } from 'date-fns';

interface PerformanceAlertsProps {
    athletes: AthleteProfile[];
}

export function PerformanceAlerts({ athletes }: PerformanceAlertsProps) {
    const alerts = athletes.flatMap(a => {
        const list = [];
        const lastUpdate = a.updatedAt ? new Date(a.updatedAt) : new Date(a.createdAt);
        const daysSinceUpdate = differenceInDays(new Date(), lastUpdate);

        // 1. Critical Risk Index
        if (a.riskIndex && a.riskIndex > 75) {
            list.push({
                type: 'risk',
                title: 'High Availability Risk',
                athlete: a,
                message: `Risk index spiked to ${a.riskIndex}%. High probability of non-availability.`,
                icon: ShieldAlert,
                color: 'text-red-600',
                bgColor: 'bg-red-50'
            });
        }

        // 2. Elite Potential
        if (a.compositeScoutingIndex && a.compositeScoutingIndex > 85) {
            list.push({
                type: 'elite',
                title: 'Elite Projection',
                athlete: a,
                message: `Maintains verified Institutional Grade of ${a.compositeScoutingIndex}. Market target.`,
                icon: Zap,
                color: 'text-yellow-600',
                bgColor: 'bg-yellow-50'
            });
        }

        // 3. Stale Data Integrity
        if (daysSinceUpdate > 30) {
            list.push({
                type: 'stale',
                title: 'Stale Performance Data',
                athlete: a,
                message: `Metrics last confirmed ${daysSinceUpdate} days ago. Recalibration needed.`,
                icon: Clock,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50'
            });
        }

        return list;
    }).slice(0, 5); // Limit to top 5 most critical

    return (
        <Card className="border-none shadow-xl bg-background overflow-hidden h-full">
            <CardHeader className="bg-neutral-900 text-white p-6">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Command Intelligence
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-neutral-400 uppercase">System Generated Squad Insights</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y">
                {alerts.length > 0 ? alerts.map((alert, i) => (
                    <div key={i} className="p-4 hover:bg-muted/20 transition-colors flex items-start gap-4 group">
                        <div className={cn("mt-1 p-2 rounded-lg", alert.bgColor)}>
                            <alert.icon className={cn("w-4 h-4", alert.color)} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest">{alert.title}</p>
                                <Link href={`/${alert.athlete.username}`} className="text-muted-foreground hover:text-primary transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <p className="text-xs font-black uppercase">{alert.athlete.firstName} {alert.athlete.lastName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">{alert.message}</p>
                        </div>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center opacity-20">
                        <AlertTriangle className="w-12 h-12 mb-2" />
                        <p className="font-black uppercase text-[10px] tracking-widest">No Active Command Alerts</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
