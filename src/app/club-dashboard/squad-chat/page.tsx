'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, ShieldCheck, Users, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ClubMember, UserAccount, ClubProfile } from '@/lib/types';
import { sendClubNotification } from '@/hooks/usePushNotifications';
import { smsSend } from '@/hooks/useSMS';

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:          { label: 'Admin',     className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  coach:          { label: 'Coach',     className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  assistant_coach:{ label: 'Asst',      className: 'bg-blue-400/15 text-blue-400 border-blue-400/30' },
  analyst:        { label: 'Analyst',   className: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
  gk_coach:       { label: 'GK Coach',  className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' },
  athlete:        { label: 'Player',    className: 'bg-green-500/15 text-green-500 border-green-500/30' },
  scout:          { label: 'Scout',     className: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
};

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const cfg = ROLE_CONFIG[role] ?? { label: role, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border', cfg.className)}>
      {cfg.label}
    </span>
  );
}

export default function SquadChatPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const myMembership = userMemberships?.[0];
    const clubId = myMembership?.clubId;
    const myRole = myMembership?.role;
    const isAdmin = myRole === 'admin';

    const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
    const { data: club } = useDoc<ClubProfile>(clubRef);

    const allMembersQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active')) : null
    ), [firestore, clubId]);
    const { data: allMembers } = useCollection<ClubMember>(allMembersQuery);

    const memberRoleMap = (allMembers ?? []).reduce<Record<string, string>>((acc, m) => {
        acc[m.userId] = m.role;
        return acc;
    }, {});

    const messagesQuery = useMemoFirebase(() => (
        firestore && clubId ? query(collection(firestore, 'clubs', clubId, 'squad_messages'), orderBy('timestamp', 'asc'), limit(60)) : null
    ), [firestore, clubId]);
    const { data: messages, isLoading: msgsLoading } = useCollection<any>(messagesQuery);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !clubId || !newMessage.trim()) return;

        const senderName = user.displayName || 'Staff Member';
        const senderRole = myRole ?? 'unknown';
        const now = new Date().toISOString();

        await addDoc(collection(firestore, 'clubs', clubId, 'squad_messages'), {
            senderId: user.uid,
            senderName,
            senderRole,
            content: newMessage,
            timestamp: now,
        });

        sendClubNotification({
            clubId,
            title: `${senderName} — Squad Chat`,
            body: newMessage.length > 80 ? newMessage.slice(0, 80) + '…' : newMessage,
            url: '/club-dashboard/squad-chat',
            tag: 'squad-chat',
            excludeUserId: user.uid,
            firestore,
        });

        smsSend('squad-chat', {
            memberPhones: (club as any)?.squadPhones ?? [],
            senderName,
            message: newMessage,
        });

        setNewMessage('');
    };

    const handleDelete = async (msgId: string) => {
        if (!firestore || !clubId) return;
        setDeletingId(msgId);
        try {
            await deleteDoc(doc(firestore, 'clubs', clubId, 'squad_messages', msgId));
        } finally {
            setDeletingId(null);
        }
    };

    const memberCount = allMembers?.length ?? 0;

    if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col" style={{ height: 'calc(100dvh - 8rem)' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                    <h1 className="text-xl font-black tracking-tight uppercase">Squad Hub</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Internal organization network</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none gap-1 px-2.5 py-1 shrink-0">
                        <Users className="w-3 h-3" />
                        <span className="font-black text-[9px] uppercase tracking-widest hidden sm:inline">{memberCount} members</span>
                    </Badge>
                    {myRole && <RoleBadge role={myRole} />}
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-background min-h-0">
                <CardHeader className="bg-neutral-900 text-white flex flex-row items-center justify-between py-3 px-4 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-black uppercase tracking-widest truncate">{club?.clubName || 'Squad'} General</CardTitle>
                            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Admins · Staff · Players</p>
                        </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                </CardHeader>

                <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef as any}>
                    <div className="space-y-3">
                        {messages?.map((msg: any) => {
                            const isMe = msg.senderId === user?.uid;
                            const canDelete = isMe || isAdmin;
                            const resolvedRole = msg.senderRole ?? memberRoleMap[msg.senderId];

                            return (
                                <div key={msg.id} className={cn('flex flex-col group', isMe ? 'items-end' : 'items-start')}>
                                    <div className={cn('flex items-center gap-2 mb-1 px-1', isMe && 'flex-row-reverse')}>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground">{msg.senderName}</span>
                                        <RoleBadge role={resolvedRole} />
                                        <span className="text-[8px] text-muted-foreground/50">{format(new Date(msg.timestamp), 'p')}</span>
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(msg.id)}
                                                disabled={deletingId === msg.id}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-destructive"
                                                title="Delete message"
                                            >
                                                {deletingId === msg.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <Trash2 className="w-3 h-3" />}
                                            </button>
                                        )}
                                    </div>
                                    <div className={cn(
                                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm break-words',
                                        isMe
                                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                                            : 'bg-muted/50 border rounded-tl-none'
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}
                        {msgsLoading && <div className="flex justify-center"><Loader2 className="animate-spin" /></div>}
                        {!msgsLoading && messages?.length === 0 && (
                            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-center">
                                <MessageSquare className="w-8 h-8 opacity-30" />
                                <p className="font-bold text-sm">No messages yet</p>
                                <p className="text-xs">Be the first to say something to the squad.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSend} className="p-3 bg-muted/10 border-t flex gap-2 shrink-0">
                    <Input
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Message the squad..."
                        className="bg-background h-11 min-h-[44px] font-medium"
                    />
                    <Button type="submit" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0" disabled={!newMessage.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </Card>
        </div>
    );
}
