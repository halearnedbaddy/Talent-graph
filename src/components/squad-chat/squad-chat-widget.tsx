'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, Lock, CheckCircle2, XCircle, MapPin, Calendar, Clock, Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ClubMember, ClubProfile, PracticeSession } from '@/lib/types';
import { sendClubNotification } from '@/hooks/usePushNotifications';
import { smsSend } from '@/hooks/useSMS';

// ── Inline RSVP card for session_announcement messages ───────────────────────

interface RsvpCardProps {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionTime: string;
  sessionLocation: string;
  timestamp: string;
  senderName: string;
}

function RsvpCard({ sessionId, sessionName, sessionDate, sessionTime, sessionLocation, timestamp, senderName }: RsvpCardProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);

  const sessionRef = useMemoFirebase(
    () => (firestore && sessionId ? doc(firestore, 'practices', sessionId) : null),
    [firestore, sessionId]
  );
  const { data: session } = useDoc<PracticeSession>(sessionRef);

  const attendance = session?.attendance ?? {};
  const myStatus = user?.uid ? attendance[user.uid] : undefined;
  const attendingCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  const handleRsvp = async (status: 'present' | 'absent') => {
    if (!firestore || !user || !sessionId || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'practices', sessionId), {
        [`attendance.${user.uid}`]: status,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-background shadow-md overflow-hidden">
      <div className="bg-neutral-900 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{senderName}</span>
        <span className="text-[8px] text-neutral-500">{format(new Date(timestamp), 'p')}</span>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-1.5">
        <p className="text-sm font-black uppercase tracking-tight">{sessionName}</p>
        <div className="flex flex-wrap gap-3 text-[10px] font-bold text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{sessionDate}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sessionTime}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sessionLocation}</span>
        </div>
      </div>

      <div className="px-4 pb-3 pt-1 flex gap-2">
        <Button
          size="sm"
          variant={myStatus === 'present' ? 'default' : 'outline'}
          className={cn(
            'flex-1 h-9 text-[10px] font-black uppercase tracking-wider gap-1.5 transition-all',
            myStatus === 'present' && 'bg-green-600 hover:bg-green-700 border-green-600 text-white'
          )}
          onClick={() => handleRsvp('present')}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Attending
        </Button>
        <Button
          size="sm"
          variant={myStatus === 'absent' ? 'destructive' : 'outline'}
          className="flex-1 h-9 text-[10px] font-black uppercase tracking-wider gap-1.5 transition-all"
          onClick={() => handleRsvp('absent')}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Not Attending
        </Button>
      </div>

      {(attendingCount > 0 || absentCount > 0) && (
        <div className="px-4 pb-3 flex items-center gap-3 border-t pt-2">
          {attendingCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest">
              <CheckCircle2 className="w-3 h-3" />{attendingCount} attending
            </span>
          )}
          {absentCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-black text-destructive uppercase tracking-widest">
              <XCircle className="w-3 h-3" />{absentCount} not attending
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reminder banner: sessions in next 24h without RSVP ───────────────────────

interface RsvpReminderBannerProps {
  clubId: string;
  userId: string;
}

function RsvpReminderBanner({ clubId, userId }: RsvpReminderBannerProps) {
  const firestore = useFirestore();
  const [dismissed, setDismissed] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const upcomingQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(
          collection(firestore, 'practices'),
          where('clubId', '==', clubId),
          where('date', '>=', today),
          where('date', '<=', tomorrow)
        )
      : null
  ), [firestore, clubId, today, tomorrow]);
  const { data: sessions } = useCollection<PracticeSession>(upcomingQuery);

  // Sessions where this user has NOT responded yet
  const pending = sessions?.filter(s => !s.attendance?.[userId]) ?? [];

  // Also check for sessions starting within 1 hour
  const now = new Date();
  const soonSessions = pending.filter(s => {
    if (s.date !== today) return false;
    const [h, m] = (s.time ?? '00:00').split(':').map(Number);
    const sessionStart = new Date(s.date);
    sessionStart.setHours(h, m, 0, 0);
    const diffMins = (sessionStart.getTime() - now.getTime()) / 60_000;
    return diffMins > 0 && diffMins <= 90; // starting within 90 minutes
  });

  if (dismissed || pending.length === 0) return null;

  const isUrgent = soonSessions.length > 0;
  const label = isUrgent
    ? `⏰ Training starts soon — have you responded?`
    : `📋 ${pending.length} upcoming session${pending.length > 1 ? 's' : ''} need${pending.length === 1 ? 's' : ''} your RSVP`;

  return (
    <div className={cn(
      'mx-4 mt-3 mb-1 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shrink-0',
      isUrgent
        ? 'bg-amber-500/10 border border-amber-500/30'
        : 'bg-primary/5 border border-primary/20'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Bell className={cn('w-3.5 h-3.5 shrink-0', isUrgent ? 'text-amber-500' : 'text-primary')} />
        <p className={cn('text-[10px] font-black uppercase tracking-widest truncate', isUrgent ? 'text-amber-700 dark:text-amber-400' : 'text-primary')}>
          {label}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

interface SquadChatWidgetProps {
  clubId?: string;
  scrollHeight?: string;
}

export function SquadChatWidget({ clubId: propClubId, scrollHeight = '320px' }: SquadChatWidgetProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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

        {/* Reminder banner — shows outside the scroll area so it's always visible */}
        {user && resolvedClubId && (
          <RsvpReminderBanner clubId={resolvedClubId} userId={user.uid} />
        )}

        <ScrollArea style={{ height: scrollHeight }} ref={scrollRef as any}>
          <div className="space-y-4 px-4 py-4">
            {msgsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            )}
            {messages?.map((msg: any) => {
              const isSessionAnnouncement = msg.type === 'session_announcement' && msg.sessionId;

              if (isSessionAnnouncement) {
                return (
                  <div key={msg.id} className="flex flex-col items-start">
                    <RsvpCard
                      sessionId={msg.sessionId}
                      sessionName={msg.sessionName ?? 'Training Session'}
                      sessionDate={msg.sessionDate ?? ''}
                      sessionTime={msg.sessionTime ?? ''}
                      sessionLocation={msg.sessionLocation ?? ''}
                      timestamp={msg.timestamp}
                      senderName={msg.senderName}
                    />
                  </div>
                );
              }

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
