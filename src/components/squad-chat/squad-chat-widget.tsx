'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, doc, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ClubMember, ClubProfile } from '@/lib/types';
import { sendClubNotification } from '@/hooks/usePushNotifications';
import { smsSend } from '@/hooks/useSMS';

interface SquadChatWidgetProps {
  /** Pre-known clubId (skip the membership lookup if already available). */
  clubId?: string;
  /** Max height of the message scroll area (CSS value). */
  scrollHeight?: string;
}

export function SquadChatWidget({ clubId: propClubId, scrollHeight = '320px' }: SquadChatWidgetProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve club membership when clubId is not passed as a prop
  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user && !propClubId
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user, propClubId]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const resolvedClubId = propClubId ?? userMemberships?.[0]?.clubId;

  const clubRef = useMemoFirebase(
    () => (firestore && resolvedClubId ? doc(firestore, 'clubs', resolvedClubId) : null),
    [firestore, resolvedClubId]
  );
  const { data: club } = useDoc<ClubProfile>(clubRef);

  const messagesQuery = useMemoFirebase(() => (
    firestore && resolvedClubId
      ? query(collection(firestore, 'clubs', resolvedClubId, 'squad_messages'), orderBy('timestamp', 'asc'), limit(60))
      : null
  ), [firestore, resolvedClubId]);
  const { data: messages, isLoading: msgsLoading } = useCollection<any>(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !resolvedClubId || !newMessage.trim()) return;

    const senderName = user.displayName || 'Squad Member';
    const body = newMessage.trim();
    await addDoc(collection(firestore, 'clubs', resolvedClubId, 'squad_messages'), {
      senderId: user.uid,
      senderName,
      content: body,
      timestamp: new Date().toISOString(),
    });

    sendClubNotification({
      clubId: resolvedClubId,
      title: `${senderName} — Squad Chat`,
      body: body.length > 80 ? body.slice(0, 80) + '…' : body,
      url: '/club-dashboard/squad-chat',
      tag: 'squad-chat',
      excludeUserId: user.uid,
      firestore,
    });

    smsSend('squad-chat', {
      memberPhones: (club as any)?.squadPhones ?? [],
      senderName,
      message: body,
    });

    setNewMessage('');
  };

  if (!resolvedClubId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest">Squad chat is available to active club members</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-xl border-none">
      <Card className="flex flex-col border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-neutral-900 text-white flex flex-row items-center gap-3 py-3 px-4 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-black uppercase tracking-widest truncate">
              {club?.clubName || 'Squad'} — General
            </CardTitle>
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
              Admins · Staff · Players
            </p>
          </div>
        </CardHeader>

        <ScrollArea style={{ height: scrollHeight }} ref={scrollRef as any}>
          <div className="space-y-4 px-4 py-4">
            {msgsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            )}
            {messages?.map((msg: any) => {
              const isMine = msg.senderId === user?.uid;
              const initials = (msg.senderName as string)
                .split(' ')
                .map((p: string) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return (
                <div key={msg.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                  <div className={cn('flex items-center gap-2 mb-1 px-1', isMine && 'flex-row-reverse')}>
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[9px] font-black uppercase text-muted-foreground">{msg.senderName}</span>
                    <span className="text-[8px] text-muted-foreground/50">
                      {format(new Date(msg.timestamp), 'p')}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm break-words',
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted/50 border rounded-tl-none'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {!msgsLoading && !messages?.length && (
              <p className="text-center text-xs text-muted-foreground py-6 font-bold uppercase tracking-widest">
                No messages yet — say hi to the squad!
              </p>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSend} className="p-3 bg-muted/10 border-t flex gap-2 shrink-0">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Message the squad…"
            className="bg-background h-11 min-h-[44px] font-medium"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0"
            disabled={!newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
