'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, doc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ClubMember, UserAccount, ClubProfile } from '@/lib/types';

export default function SquadChatPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Get my club context
    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const clubId = userMemberships?.[0]?.clubId;

    const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
    const { data: club } = useDoc<ClubProfile>(clubRef);

    // 2. Fetch Squad Messages
    const messagesQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'clubs', clubId, 'squad_messages'), orderBy('timestamp', 'asc'), limit(50)) : null
    ), [firestore, clubId]);
    const { data: messages, isLoading: msgsLoading } = useCollection<any>(messagesQuery);

    // 3. Fetch sender details for names (Batch fetch optimization would be better, but simple for prototype)
    const [senders, setSenders] = useState<Record<string, UserAccount>>({});

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !clubId || !newMessage.trim()) return;

        const now = new Date().toISOString();
        await addDoc(collection(firestore, 'clubs', clubId, 'squad_messages'), {
            senderId: user.uid,
            senderName: user.displayName || 'Staff Member',
            content: newMessage,
            timestamp: now,
        });

        setNewMessage('');
    };

    if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Squad Hub</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Internal organization network</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none gap-1 px-3 py-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-black text-[10px] uppercase tracking-widest">Active Channel</span>
                    </Badge>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-background">
                <CardHeader className="bg-neutral-900 text-white flex flex-row items-center justify-between py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest">{club?.clubName} General</CardTitle>
                            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Admins • Staff • Players</p>
                        </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                </CardHeader>

                <ScrollArea className="flex-1 p-6" ref={scrollRef as any}>
                    <div className="space-y-6">
                        {messages?.map((msg: any) => (
                            <div key={msg.id} className={cn('flex flex-col', msg.senderId === user?.uid ? 'items-end' : 'items-start')}>
                                <div className={cn('flex items-center gap-2 mb-1 px-1', msg.senderId === user?.uid && 'flex-row-reverse')}>
                                    <span className="text-[9px] font-black uppercase text-muted-foreground">{msg.senderName}</span>
                                    <span className="text-[8px] text-muted-foreground/50">{format(new Date(msg.timestamp), 'p')}</span>
                                </div>
                                <div className={cn(
                                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm',
                                    msg.senderId === user?.uid 
                                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                        : 'bg-muted/50 border rounded-tl-none'
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {msgsLoading && <div className="flex justify-center"><Loader2 className="animate-spin" /></div>}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSend} className="p-4 bg-muted/10 border-t flex gap-2">
                    <Input 
                        value={newMessage} 
                        onChange={e => setNewMessage(e.target.value)} 
                        placeholder="Broadcast a message to the squad..." 
                        className="bg-background h-11 font-medium border-none shadow-inner"
                    />
                    <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!newMessage.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </Card>
        </div>
    );
}