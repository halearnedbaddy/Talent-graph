'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Trophy, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import type { ClubMatch, PracticeSession, ClubMember } from '@/lib/types';
import { format, isSameDay, isAfter, isBefore, startOfToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function SchedulePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = userMemberships?.[0]?.clubId;

    const matchesQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
    ), [firestore, clubId]);
    const { data: matches } = useCollection<ClubMatch>(matchesQuery);

    const sessionsQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'practices'), where('clubId', '==', clubId)) : null
    ), [firestore, clubId]);
    const { data: sessions } = useCollection<PracticeSession>(sessionsQuery);

    const today = startOfToday();

    const allEvents = [
        ...(matches || []).map(m => ({ ...m, type: 'match' as const })),
        ...(sessions || []).map(s => ({ ...s, type: 'practice' as const }))
    ].filter(e => {
        const eventDate = new Date(e.date);
        if (filter === 'upcoming') return isAfter(eventDate, today) || isSameDay(eventDate, today);
        if (filter === 'past') return isBefore(eventDate, today);
        return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const selectedDayEvents = allEvents.filter(e => date && isSameDay(new Date(e.date), date));

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Master Schedule</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unified fixture & training calendar</p>
                </div>
                <div className="bg-background border rounded-lg p-1 flex gap-1">
                    {(['all', 'upcoming', 'past'] as const).map(f => (
                        <Button key={f} variant={filter === f ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(f)} className="text-[10px] font-black h-8 px-4 uppercase">{f}</Button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-4 border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-neutral-900 text-white">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" /> Squad Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex justify-center">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="p-4"
                        />
                    </CardContent>
                </Card>

                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-none shadow-2xl bg-background overflow-hidden">
                        <CardHeader className="bg-neutral-50 border-b">
                            <CardTitle className="text-sm font-black uppercase tracking-widest">
                                {date ? format(date, 'PPPP') : 'Timeline'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {selectedDayEvents.length > 0 ? selectedDayEvents.map(e => (
                                    <div key={e.id} className="p-6 flex items-center justify-between group hover:bg-muted/20">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${e.type === 'match' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600'}`}>
                                                {e.type === 'match' ? <Trophy className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-black uppercase">
                                                        {e.type === 'match' ? `vs ${(e as any).opponent}` : (e as any).name}
                                                    </h3>
                                                    <Badge className={`${e.type === 'match' ? 'bg-primary' : 'bg-orange-600'} text-white border-none font-black text-[8px] h-4 uppercase`}>
                                                        {e.type}
                                                    </Badge>
                                                </div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                                    {(e as any).location} &bull; {(e as any).time || 'Kickoff'} &bull; {(e as any).competition || (e as any).season}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest">Details</Button>
                                    </div>
                                )) : (
                                    <div className="p-12 text-center text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">
                                        No scheduled events for this date
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming Agenda</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allEvents.filter(e => isAfter(new Date(e.date), today)).slice(0, 4).map(e => (
                                <Card key={e.id} className="border-none shadow-sm bg-background p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${e.type === 'match' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600'}`}>
                                            {e.type === 'match' ? <Trophy className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase leading-none truncate max-w-[150px]">
                                                {e.type === 'match' ? `vs ${(e as any).opponent}` : (e as any).name}
                                            </p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">
                                                {format(new Date(e.date), 'MMM d')}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}