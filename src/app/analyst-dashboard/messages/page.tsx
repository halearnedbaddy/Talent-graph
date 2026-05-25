'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MessageSquare, Send, Plus, Info, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ClubMember } from '@/lib/types';
import { format } from 'date-fns';
import { SquadChatWidget } from '@/components/squad-chat/squad-chat-widget';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  content: string;
  subject?: string;
  isRead: boolean;
  threadId: string;
  createdAt: string;
}

export default function AnalystMessagesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState<ClubMember | null>(null);
  const [composeContent, setComposeContent] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const coachQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active'), where('role', '==', 'coach')) : null
  ), [firestore, clubId]);
  const { data: coaches } = useCollection<ClubMember>(coachQuery);

  const adminQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active'), where('role', '==', 'admin')) : null
  ), [firestore, clubId]);
  const { data: admins } = useCollection<ClubMember>(adminQuery);

  const inboxQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'messages'), where('recipientId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: inbox } = useCollection<Message>(inboxQuery);

  const sentQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'messages'), where('senderId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: sent } = useCollection<Message>(sentQuery);

  const allMessages = (() => {
    const combined = [...(inbox ?? []), ...(sent ?? [])];
    const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
    return unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  })();

  const threads = (() => {
    const threadMap = new Map<string, Message[]>();
    allMessages.forEach(m => {
      const key = m.threadId ?? m.id;
      if (!threadMap.has(key)) threadMap.set(key, []);
      threadMap.get(key)!.push(m);
    });
    return Array.from(threadMap.entries()).map(([id, msgs]) => ({
      id,
      messages: msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      latest: msgs[msgs.length - 1],
      unread: msgs.filter(m => !m.isRead && m.recipientId === user?.uid).length,
    })).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
  })();

  const selectedMsgs = threads.find(t => t.id === selectedThread)?.messages ?? [];
  const unreadCount = inbox?.filter(m => !m.isRead).length ?? 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMsgs]);

  const handleSelectThread = async (threadId: string) => {
    setSelectedThread(threadId);
    if (!firestore || !user) return;
    const unread = threads.find(t => t.id === threadId)?.messages.filter(m => !m.isRead && m.recipientId === user.uid) ?? [];
    await Promise.all(unread.map(m => updateDoc(doc(firestore, 'messages', m.id), { isRead: true })));
  };

  const handleSendReply = async () => {
    if (!firestore || !user || !selectedThread || !reply.trim()) return;
    setSending(true);
    try {
      const thread = threads.find(t => t.id === selectedThread);
      if (!thread) return;
      const lastMsg = thread.latest;
      const recipientId = lastMsg.senderId === user.uid ? lastMsg.recipientId : lastMsg.senderId;
      const recipientName = lastMsg.senderId === user.uid ? lastMsg.recipientName : lastMsg.senderName;
      await addDoc(collection(firestore, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Analyst',
        senderRole: 'analyst',
        recipientId,
        recipientName,
        content: reply,
        isRead: false,
        threadId: selectedThread,
        createdAt: new Date().toISOString(),
      });
      setReply('');
    } catch {
      toast({ title: 'Error sending message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSendNew = async () => {
    if (!firestore || !user || !composeRecipient || !composeContent.trim()) return;
    setSending(true);
    try {
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await addDoc(collection(firestore, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Analyst',
        senderRole: 'analyst',
        recipientId: composeRecipient.userId,
        recipientName: composeRecipient.displayName ?? composeRecipient.userId,
        subject: composeSubject.trim(),
        content: composeContent.trim(),
        isRead: false,
        threadId: msgId,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Message sent ✓' });
      setComposeOpen(false);
      setComposeRecipient(null);
      setComposeContent('');
      setComposeSubject('');
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const staff = [...(coaches ?? []), ...(admins ?? [])].filter(m => m.userId !== user?.uid);

  const getInitials = (name: string) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Communications</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message coaching staff & squad chat</p>
      </div>

      <Tabs defaultValue="messages">
        <TabsList className="mb-4">
          <TabsTrigger value="messages" className="font-black text-[10px] uppercase gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Messages
            {unreadCount > 0 && <Badge className="h-4 min-w-4 text-[9px] font-black ml-1">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="squad-chat" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Squad Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="squad-chat">
          <SquadChatWidget />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Staff Messages</p>
            <Button onClick={() => setComposeOpen(!composeOpen)} size="sm" className="font-black uppercase tracking-widest gap-2">
              <Plus className="w-4 h-4" /> New Message
            </Button>
          </div>
      {/* Role notice */}
      <Card className="border border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-muted-foreground">As an analyst you can message coaches and club admins. Direct athlete contact is managed by the coaching staff.</p>
        </CardContent>
      </Card>

      {/* Compose panel */}
      {composeOpen && (
        <Card className="border-none shadow-xl bg-background">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">New Message</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-muted-foreground">To (Coach / Admin)</p>
              <div className="flex flex-wrap gap-2">
                {staff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No coaching staff found</p>
                ) : staff.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setComposeRecipient(composeRecipient?.id === m.id ? null : m)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all',
                      composeRecipient?.id === m.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted/50'
                    )}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] font-black">{getInitials(m.displayName ?? '')}</AvatarFallback>
                    </Avatar>
                    {m.displayName ?? m.userId}
                    <Badge variant="secondary" className="text-[8px] h-4 px-1 font-black uppercase">{m.role}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Subject</p>
              <Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="e.g. Match analysis — vs Gor Mahia" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Message</p>
              <Textarea value={composeContent} onChange={e => setComposeContent(e.target.value)} placeholder="Write your message..." className="font-medium min-h-[100px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSendNew} disabled={sending || !composeRecipient || !composeContent.trim()} className="font-black uppercase tracking-widest gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thread list + conversation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thread list */}
        <Card className="border-none shadow-xl bg-background lg:col-span-1">
          <CardHeader className="bg-muted/50 border-b py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Messages</CardTitle>
            {unreadCount > 0 && <Badge className="h-5 min-w-5 text-[10px] font-black">{unreadCount}</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                <p className="font-bold text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground">Start a conversation with coaching staff.</p>
              </div>
            ) : (
              <div className="divide-y">
                {threads.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectThread(t.id)}
                    className={cn('w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30', selectedThread === t.id && 'bg-muted/40')}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-black">
                        {getInitials(t.latest.senderId === user?.uid ? t.latest.recipientName : t.latest.senderName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs truncate', t.unread > 0 ? 'font-black' : 'font-bold')}>
                          {t.latest.senderId === user?.uid ? t.latest.recipientName : t.latest.senderName}
                        </p>
                        {t.unread > 0 && <Badge className="h-4 min-w-4 text-[9px] font-black shrink-0">{t.unread}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{t.latest.content}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{format(new Date(t.latest.createdAt), 'PPp')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation */}
        <Card className="border-none shadow-xl bg-background lg:col-span-2 flex flex-col" style={{ minHeight: '400px' }}>
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
              <p className="font-bold text-muted-foreground">Select a conversation</p>
            </div>
          ) : (
            <>
              <CardHeader className="bg-muted/50 border-b py-3 px-4 shrink-0">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest">
                    {selectedMsgs[0]?.senderId === user?.uid ? selectedMsgs[0]?.recipientName : selectedMsgs[0]?.senderName}
                  </CardTitle>
                  {selectedMsgs[0]?.subject && <p className="text-[10px] text-muted-foreground mt-0.5">{selectedMsgs[0].subject}</p>}
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {selectedMsgs.map(msg => (
                  <div key={msg.id} className={cn('flex flex-col', msg.senderId === user?.uid ? 'items-end' : 'items-start')}>
                    <div className={cn('flex items-center gap-2 mb-1 px-1', msg.senderId === user?.uid && 'flex-row-reverse')}>
                      <span className="text-[9px] font-black uppercase text-muted-foreground">{msg.senderName}</span>
                      <span className="text-[8px] text-muted-foreground/50">{format(new Date(msg.createdAt), 'p, PP')}</span>
                    </div>
                    <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm break-words', msg.senderId === user?.uid ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted/50 border rounded-tl-none')}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 bg-muted/10 border-t flex gap-2 shrink-0">
                <Input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); }}} placeholder="Reply..." className="bg-background h-11 font-medium" />
                <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSendReply} disabled={sending || !reply.trim()}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
