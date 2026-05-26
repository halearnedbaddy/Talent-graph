'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import {
  collection, query, where, orderBy, addDoc, updateDoc, getDoc, getDocs,
  doc, writeBatch, setDoc,
} from 'firebase/firestore';
import type { Conversation, DirectMessage } from '@/lib/types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Send, Plus, Search, MessageSquare, CheckCheck } from 'lucide-react';
import { UserSearchDialog } from '@/components/messaging/user-search-dialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  athleteName: string;
  athletePhoto?: string;
}

function getInitials(name: string) {
  const parts = (name || '').trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || '?').substring(0, 2).toUpperCase();
}

function groupByDate(messages: DirectMessage[]) {
  const groups: { date: string; messages: DirectMessage[] }[] = [];
  for (const msg of messages) {
    const key = format(new Date(msg.timestamp), 'MMMM d, yyyy');
    const last = groups[groups.length - 1];
    if (last?.date === key) last.messages.push(msg);
    else groups.push({ date: key, messages: [msg] });
  }
  return groups;
}

export function DmSheet({ open, onClose, athleteName, athletePhoto }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [view, setView] = useState<'inbox' | 'chat'>('inbox');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const convsQuery = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(
          collection(firestore, 'conversations'),
          where('participants', 'array-contains', user.uid),
          orderBy('updatedAt', 'desc')
        )
      : null
  ), [firestore, user?.uid]);
  const { data: conversations, isLoading: convsLoading } = useCollection<Conversation>(convsQuery);

  const convRef = useMemoFirebase(() => (
    firestore && activeConvId ? doc(firestore, 'conversations', activeConvId) : null
  ), [firestore, activeConvId]);
  const { data: activeConv } = useDoc<Conversation>(convRef);

  const msgsQuery = useMemoFirebase(() => (
    firestore && activeConvId
      ? query(collection(firestore, 'conversations', activeConvId, 'messages'), orderBy('timestamp', 'asc'))
      : null
  ), [firestore, activeConvId]);
  const { data: messages, isLoading: msgsLoading } = useCollection<DirectMessage>(msgsQuery);

  const otherParticipantId = activeConv?.participants.find(p => p !== user?.uid);
  const otherInfo = otherParticipantId ? activeConv?.participantInfo?.[otherParticipantId] : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark notifications as read when opening a conversation
  useEffect(() => {
    if (!firestore || !user?.uid || !activeConvId) return;
    (async () => {
      try {
        const q = query(
          collection(firestore, 'notifications', user.uid, 'items'),
          where('type', '==', 'new_message'),
          where('conversationId', '==', activeConvId),
          where('isRead', '==', false)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;
        const batch = writeBatch(firestore);
        snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
        await batch.commit();
      } catch { }
    })();
  }, [firestore, user?.uid, activeConvId]);

  const openConversation = (convId: string) => {
    setActiveConvId(convId);
    setView('chat');
  };

  const handleSend = useCallback(async () => {
    if (!firestore || !user || !newMessage.trim() || !activeConvId || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(firestore, 'conversations', activeConvId, 'messages'), {
        senderId: user.uid,
        senderName: athleteName,
        content,
        timestamp: now,
      });
      await updateDoc(doc(firestore, 'conversations', activeConvId), {
        lastMessage: content,
        lastMessageAt: now,
        lastSenderId: user.uid,
        updatedAt: now,
      });
      const recipientId = activeConv?.participants.find(p => p !== user.uid);
      if (recipientId) {
        await addDoc(collection(firestore, 'notifications', recipientId, 'items'), {
          type: 'new_message',
          actorName: athleteName,
          actorRole: 'athlete',
          message: content.length > 100 ? content.slice(0, 100) + '…' : content,
          conversationId: activeConvId,
          url: `/chat/${activeConvId}`,
          isRead: false,
          createdAt: now,
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
      setNewMessage(content);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [firestore, user, newMessage, isSending, activeConvId, activeConv, athleteName, toast]);

  const filteredConvs = (conversations ?? []).filter(conv => {
    if (!searchTerm.trim()) return true;
    const otherId = conv.participants.find(p => p !== user?.uid);
    const otherInfo = otherId ? conv.participantInfo?.[otherId] : null;
    return otherInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const unreadCount = (conversations ?? []).filter(
    c => c.lastSenderId && c.lastSenderId !== user?.uid
  ).length;

  const handleClose = () => {
    setView('inbox');
    setActiveConvId(null);
    setSearchTerm('');
    setNewMessage('');
    onClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={o => { if (!o) handleClose(); }}>
        <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col overflow-hidden">
          {view === 'inbox' ? (
            <>
              <SheetHeader className="p-4 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-sm">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Messages
                    {unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground px-1.5">
                        {unreadCount}
                      </span>
                    )}
                  </SheetTitle>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 font-black uppercase tracking-widest text-[10px]"
                    onClick={() => setNewChatOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Chat
                  </Button>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {convsLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filteredConvs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-bold text-sm">
                      {searchTerm ? 'No conversations match' : 'No messages yet'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      {searchTerm
                        ? 'Try a different name'
                        : 'Start a conversation with any scout, coach, or club on the platform.'}
                    </p>
                    {!searchTerm && (
                      <Button
                        className="font-black uppercase tracking-widest text-xs mt-1"
                        onClick={() => setNewChatOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Start First Chat
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredConvs.map(conv => {
                      const otherId = conv.participants.find(p => p !== user?.uid);
                      const info = otherId ? conv.participantInfo?.[otherId] : null;
                      const isUnread = conv.lastSenderId && conv.lastSenderId !== user?.uid;

                      return (
                        <button
                          key={conv.id}
                          onClick={() => openConversation(conv.id)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                        >
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarImage src={info?.photoUrl} />
                            <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">
                              {getInitials(info?.name || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className={cn('text-sm truncate', isUnread ? 'font-black' : 'font-semibold')}>
                                {info?.name || 'Unknown'}
                              </p>
                              {conv.lastMessageAt && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                'text-xs truncate flex-1',
                                isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                              )}>
                                {conv.lastMessage || 'No messages yet'}
                              </p>
                              {info?.role && (
                                <Badge variant="outline" className="text-[9px] font-bold capitalize h-4 px-1.5 shrink-0">
                                  {info.role}
                                </Badge>
                              )}
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Chat view */}
              <div className="flex items-center gap-3 p-4 border-b shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => { setView('inbox'); setActiveConvId(null); }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={otherInfo?.photoUrl} />
                  <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                    {getInitials(otherInfo?.name || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate">{otherInfo?.name || 'Unknown'}</p>
                  {otherInfo?.role && (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest capitalize">
                      {otherInfo.role}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {msgsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-bold text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Say hello to {otherInfo?.name || 'them'}!</p>
                  </div>
                ) : (
                  groupByDate(messages).map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest shrink-0">
                          {group.date}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      {group.messages.map(msg => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                          <div
                            key={msg.id}
                            className={cn('flex mb-2', isMe ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted text-foreground rounded-tl-sm'
                              )}
                            >
                              <p>{msg.content}</p>
                              <div className={cn(
                                'flex items-center gap-1 mt-1',
                                isMe ? 'justify-end' : 'justify-start'
                              )}>
                                <span className={cn(
                                  'text-[9px] font-bold',
                                  isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                                )}>
                                  {format(new Date(msg.timestamp), 'HH:mm')}
                                </span>
                                {isMe && <CheckCheck className="h-3 w-3 text-primary-foreground/60" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-4 py-3 border-t shrink-0">
                <form
                  onSubmit={e => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                  <Input
                    ref={inputRef}
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    className="flex-1 h-11 text-sm rounded-full border-muted-foreground/20"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 rounded-full shrink-0"
                    disabled={isSending || !newMessage.trim()}
                  >
                    {isSending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </form>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {user && (
        <UserSearchDialog
          open={newChatOpen}
          onClose={() => setNewChatOpen(false)}
          currentUserId={user.uid}
          currentUserName={athleteName}
          currentUserRole="athlete"
          currentUserPhoto={athletePhoto}
          onConversationCreated={(convId) => {
            setNewChatOpen(false);
            setActiveConvId(convId);
            setView('chat');
          }}
        />
      )}
    </>
  );
}
