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
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Master Schedule</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unified fixture & training calendar</p>
                </div>
                <div className="bg-background border rounded-lg p-1 flex gap-1 self-start sm:self-auto">
                    {(['all', 'upcoming', 'past'] as const).map(f => (
                        <Button key={f} variant={filter === f ? 'default' : 'ghost'} size="sm" onClick={() => setFilter(f)} className="text-[10px] font-black h-10 min-h-[44px] px-3 uppercase capitalize">{f}</Button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <Card className="lg:col-span-4 border-none shadow-xl bg-background overflow-hidden">
                    <CardHeader className="bg-neutral-900 text-white py-3 px-4">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" /> Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex justify-center overflow-x-auto">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="p-3"
                        />
                    </CardContent>
                </Card>

                <div className="lg:col-span-8 space-y-5">
                    <Card className="border-none shadow-xl bg-background overflow-hidden">
                        <CardHeader className="bg-muted/50 border-b py-3 px-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest">
                                {date ? format(date, 'PPP') : 'Timeline'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {selectedDayEvents.length > 0 ? selectedDayEvents.map(e => (
                                    <div key={e.id} className="p-4 flex items-center gap-3 hover:bg-muted/20">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.type === 'match' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600'}`}>
                                            {e.type === 'match' ? <Trophy className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-black uppercase truncate">
                                                    {e.type === 'match' ? `vs ${(e as any).opponent}` : (e as any).name}
                                                </h3>
                                                <Badge className={`${e.type === 'match' ? 'bg-primary' : 'bg-orange-600'} text-white border-none font-black text-[8px] h-4 uppercase`}>
                                                    {e.type}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                                                {(e as any).location}{(e as any).time ? ` • ${(e as any).time}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-10 text-center text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">
                                        No events on this date
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {allEvents.filter(e => isAfter(new Date(e.date), today)).slice(0, 4).map(e => (
                                <Card key={e.id} className="border-none shadow-sm bg-background p-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${e.type === 'match' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600'}`}>
                                            {e.type === 'match' ? <Trophy className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black uppercase leading-none truncate">
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