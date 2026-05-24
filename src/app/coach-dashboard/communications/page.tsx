'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Send, Search, Inbox, Bell, Users, Shield,
  Loader2, CheckCheck, Clock, ChevronRight, Plus, X
} from 'lucide-react';
import type { ClubMember, AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  subject?: string;
  content: string;
  isRead: boolean;
  threadId?: string;
  createdAt: string;
}

interface Announcement {
  id: string;
  clubId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  audience: 'all' | 'squad' | 'staff';
  createdAt: string;
}

export default function CoachCommunicationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'inbox' | 'squad' | 'staff' | 'announcements' | 'compose'>('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [composeForm, setComposeForm] = useState({ recipient: '', subject: '', content: '' });
  const [announcement, setAnnouncement] = useState({ title: '', content: '', audience: 'squad' as Announcement['audience'] });

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  const inboxQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'messages'), where('recipientId', '==', user.uid), orderBy('createdAt', 'desc'))
      : null
  ), [firestore, user]);
  const { data: inbox } = useCollection<Message>(inboxQuery);

  const sentQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'messages'), where('senderId', '==', user.uid), orderBy('createdAt', 'desc'))
      : null
  ), [firestore, user]);
  const { data: sent } = useCollection<Message>(sentQuery);

  const announcementsQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'announcements'), where('clubId', '==', clubId), orderBy('createdAt', 'desc'))
      : null
  ), [firestore, clubId]);
  const { data: announcements } = useCollection<Announcement>(announcementsQuery);

  const athletesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: athletes } = useCollection<AthleteProfile>(athletesQuery);

  const staffQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active'))
      : null
  ), [firestore, clubId]);
  const { data: staffMembers } = useCollection<ClubMember>(staffQuery);
  const otherStaff = (staffMembers ?? []).filter(m => m.userId !== user?.uid && m.role !== 'athlete');

  const allMessages = useMemo(() => {
    const combined = [...(inbox ?? []), ...(sent ?? [])];
    const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
    return unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [inbox, sent]);

  // Group by thread
  const threads = useMemo(() => {
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
  }, [allMessages, user]);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.latest.senderName.toLowerCase().includes(q) ||
      t.latest.content.toLowerCase().includes(q) ||
      (t.latest.subject ?? '').toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selectedThreadMsgs = useMemo(() => {
    if (!selectedThread) return [];
    return threads.find(t => t.id === selectedThread)?.messages ?? [];
  }, [threads, selectedThread]);

  const unreadCount = useMemo(() => inbox?.filter(m => !m.isRead).length ?? 0, [inbox]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadMsgs]);

  const handleSelectThread = async (threadId: string) => {
    setSelectedThread(threadId);
    // Mark as read
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
        senderName: user.displayName || user.email || 'Coach',
        senderRole: 'coach',
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

  const handleSendCompose = async () => {
    if (!firestore || !user || !composeForm.content.trim() || !composeForm.recipient) return;
    setSending(true);
    try {
      const athlete = athletes?.find(a => a.uid === composeForm.recipient);
      const staffMember = otherStaff.find(s => s.userId === composeForm.recipient);
      const recipientName = athlete
        ? `${athlete.firstName} ${athlete.lastName}`
        : staffMember?.displayName ?? composeForm.recipient;
      const msgId = `msg-${Date.now()}`;
      const now = new Date().toISOString();
      await addDoc(collection(firestore, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Coach',
        senderRole: 'coach',
        recipientId: composeForm.recipient,
        recipientName,
        subject: composeForm.subject,
        content: composeForm.content,
        isRead: false,
        threadId: msgId,
        createdAt: now,
      });
      // Create notification for recipient
      try {
        await addDoc(collection(firestore, 'notifications', composeForm.recipient, 'items'), {
          type: 'message',
          title: 'New message from coach',
          body: composeForm.subject ? `${composeForm.subject}: ${composeForm.content.slice(0, 80)}` : composeForm.content.slice(0, 100),
          senderId: user.uid,
          senderName: user.displayName || 'Coach',
          threadId: msgId,
          isRead: false,
          createdAt: now,
        });
      } catch { /* non-critical */ }
      toast({ title: 'Message Sent ✓' });
      setComposeForm({ recipient: '', subject: '', content: '' });
      setActiveTab('inbox');
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!firestore || !user || !clubId || !announcement.title.trim() || !announcement.content.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(firestore, 'announcements'), {
        clubId,
        authorId: user.uid,
        authorName: user.displayName || user.email || 'Coach',
        title: announcement.title,
        content: announcement.content,
        audience: announcement.audience,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Announcement Posted ✓' });
      setAnnouncement({ title: '', content: '', audience: 'squad' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Communications</h1>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Unified inbox · Squad messages · Announcements
          </p>
        </div>
        <Button
          onClick={() => setActiveTab('compose')}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2"
        >
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as any); setSelectedThread(null); }} className="space-y-4">
        <TabsList className="bg-[#1C2333] border border-[#1E293B] p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="inbox" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Inbox className="h-3 w-3" /> Inbox
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white font-black text-[8px] h-4 px-1 ml-1">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="squad" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Users className="h-3 w-3" /> Squad
          </TabsTrigger>
          <TabsTrigger value="staff" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Shield className="h-3 w-3" /> Staff
          </TabsTrigger>
          <TabsTrigger value="announcements" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Bell className="h-3 w-3" /> Announce
          </TabsTrigger>
          <TabsTrigger value="compose" className="data-[state=active]:bg-[#00C853] data-[state=active]:text-black font-black text-[10px] uppercase gap-1.5">
            <Plus className="h-3 w-3" /> New Message
          </TabsTrigger>
        </TabsList>

        {/* INBOX */}
        <TabsContent value="inbox" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <Input
              placeholder="Search messages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
            />
          </div>

          {!selectedThread ? (
            <div className="space-y-2">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-16">
                  <Inbox className="h-12 w-12 text-[#94A3B8] mx-auto mb-3 opacity-30" />
                  <p className="text-white font-black">No messages yet</p>
                  <p className="text-[#94A3B8] text-sm mt-1">Your inbox will populate as you communicate with athletes and staff.</p>
                </div>
              ) : (
                filteredThreads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-[#00C853]/30',
                      thread.unread > 0 ? 'bg-[#00C853]/5 border-[#00C853]/20' : 'bg-[#111827] border-[#1E293B]'
                    )}
                  >
                    <Avatar className="h-10 w-10 rounded-xl shrink-0">
                      <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-sm font-black">
                        {thread.latest.senderName[0]?.toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm truncate', thread.unread > 0 ? 'font-black text-white' : 'font-bold text-white')}>
                          {thread.latest.senderId === user?.uid ? `To: ${thread.latest.recipientName}` : thread.latest.senderName}
                        </p>
                        <p className="text-[9px] font-bold text-[#94A3B8] shrink-0">
                          {formatDistanceToNow(parseISO(thread.latest.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {thread.latest.subject && (
                        <p className="text-[10px] font-bold text-[#00C853] truncate">{thread.latest.subject}</p>
                      )}
                      <p className="text-[11px] text-[#94A3B8] truncate">{thread.latest.content}</p>
                    </div>
                    {thread.unread > 0 && (
                      <Badge className="bg-[#00C853] text-black font-black text-[9px] shrink-0">{thread.unread}</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Thread view */
            <div className="space-y-3">
              <Button
                variant="ghost" size="sm"
                onClick={() => setSelectedThread(null)}
                className="text-[#94A3B8] hover:text-white font-black text-[10px] uppercase gap-2"
              >
                <ChevronRight className="h-3 w-3 rotate-180" /> Back to inbox
              </Button>

              <Card className="border border-[#1E293B] bg-[#111827]">
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                    {selectedThreadMsgs.map(m => {
                      const isMine = m.senderId === user?.uid;
                      return (
                        <div key={m.id} className={cn('flex gap-3', isMine ? 'flex-row-reverse' : 'flex-row')}>
                          <Avatar className="h-8 w-8 rounded-xl shrink-0">
                            <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                              {m.senderName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn('max-w-[75%] space-y-1', isMine ? 'items-end' : 'items-start')}>
                            <div className={cn(
                              'p-3 rounded-xl text-sm',
                              isMine ? 'bg-[#00C853]/15 border border-[#00C853]/30 text-white' : 'bg-[#1C2333] border border-[#1E293B] text-white'
                            )}>
                              {m.content}
                            </div>
                            <p className="text-[9px] font-bold text-[#94A3B8]">
                              {formatDistanceToNow(parseISO(m.createdAt), { addSuffix: true })}
                              {isMine && (m.isRead ? ' · Read' : ' · Sent')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t border-[#1E293B] p-3 flex gap-2">
                    <Textarea
                      placeholder="Type a reply..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                      rows={2}
                      className="flex-1 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none text-sm"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !reply.trim()}
                      className="self-end bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black h-9 w-9 p-0"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* SQUAD MESSAGES */}
        <TabsContent value="squad" className="space-y-3">
          <p className="text-[11px] font-bold text-[#94A3B8]">
            Messages between you and your squad athletes appear here.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {athletes?.map(a => {
              const athleteThreads = threads.filter(t =>
                t.latest.senderId === a.uid || t.latest.recipientId === a.uid
              );
              const unread = athleteThreads.reduce((s, t) => s + t.unread, 0);
              return (
                <button
                  key={a.uid}
                  onClick={() => {
                    if (athleteThreads.length > 0) {
                      setActiveTab('inbox');
                      handleSelectThread(athleteThreads[0].id);
                    } else {
                      setComposeForm(f => ({ ...f, recipient: a.uid }));
                      setActiveTab('compose');
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 rounded-xl shrink-0">
                    <AvatarImage src={a.photoUrl} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
                      {a.firstName[0]}{a.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase">{a.position}</p>
                  </div>
                  {unread > 0
                    ? <Badge className="bg-[#00C853] text-black font-black text-[9px] shrink-0">{unread}</Badge>
                    : <MessageSquare className="h-4 w-4 text-[#94A3B8] shrink-0" />
                  }
                </button>
              );
            })}
            {!athletes?.length && (
              <div className="col-span-2 text-center py-12">
                <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
                <p className="text-[#94A3B8] font-bold">No squad athletes yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* STAFF MESSAGES */}
        <TabsContent value="staff" className="space-y-3">
          <p className="text-[11px] font-bold text-[#94A3B8]">
            Direct message analysts, assistant coaches, and other technical staff.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherStaff.map(s => {
              const staffThreads = threads.filter(t =>
                t.latest.senderId === s.userId || t.latest.recipientId === s.userId
              );
              const unread = staffThreads.reduce((sum, t) => sum + t.unread, 0);
              const ROLE_LABELS: Record<string, string> = {
                admin: 'Admin', coach: 'Head Coach', assistant_coach: 'Asst. Coach',
                analyst: 'Analyst', gk_coach: 'GK Coach', scout: 'Scout',
              };
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (staffThreads.length > 0) {
                      setActiveTab('inbox');
                      handleSelectThread(staffThreads[0].id);
                    } else {
                      setComposeForm(f => ({ ...f, recipient: s.userId }));
                      setActiveTab('compose');
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#111827] hover:border-[#00C853]/30 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-[#1C2333] flex items-center justify-center shrink-0 font-black text-[#94A3B8] text-sm">
                    {(s.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{s.displayName || 'Staff'}</p>
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">
                      {ROLE_LABELS[s.role] ?? s.role}
                    </p>
                  </div>
                  {unread > 0
                    ? <Badge className="bg-[#00C853] text-black font-black text-[9px] shrink-0">{unread}</Badge>
                    : <MessageSquare className="h-4 w-4 text-[#94A3B8] shrink-0" />
                  }
                </button>
              );
            })}
            {!otherStaff.length && (
              <div className="col-span-2 text-center py-12">
                <Shield className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
                <p className="text-[#94A3B8] font-bold">No other staff yet</p>
                <p className="text-[11px] text-[#94A3B8] mt-1">Add analysts and coaches from the club dashboard.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="space-y-4">
          {/* Post new announcement */}
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">Post Announcement</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Input
                placeholder="Announcement title..."
                value={announcement.title}
                onChange={e => setAnnouncement(a => ({ ...a, title: e.target.value }))}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
              />
              <Textarea
                placeholder="Message for your squad..."
                value={announcement.content}
                onChange={e => setAnnouncement(a => ({ ...a, content: e.target.value }))}
                rows={3}
                className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  {(['all', 'squad', 'staff'] as const).map(aud => (
                    <button
                      key={aud}
                      onClick={() => setAnnouncement(a => ({ ...a, audience: aud }))}
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all capitalize',
                        announcement.audience === aud
                          ? 'bg-[#00C853] text-black border-[#00C853]'
                          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]'
                      )}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handlePostAnnouncement}
                  disabled={sending || !announcement.title.trim() || !announcement.content.trim()}
                  className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Announcement history */}
          <div className="space-y-2">
            {announcements?.map(ann => (
              <Card key={ann.id} className="border border-[#1E293B] bg-[#111827]">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white">{ann.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px] capitalize">{ann.audience}</Badge>
                        <span className="text-[9px] text-[#94A3B8] font-bold">
                          {formatDistanceToNow(parseISO(ann.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#94A3B8]">{ann.content}</p>
                </CardContent>
              </Card>
            ))}
            {!announcements?.length && (
              <div className="text-center py-8">
                <Bell className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
                <p className="text-[#94A3B8] font-bold">No announcements yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* COMPOSE */}
        <TabsContent value="compose" className="space-y-3">
          <Card className="border border-[#1E293B] bg-[#111827]">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">New Message</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-[#94A3B8] uppercase">To</p>
                {athletes && athletes.length > 0 && (
                  <>
                    <p className="text-[9px] text-[#94A3B8] font-bold uppercase tracking-widest pt-1">Athletes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {athletes.map(a => (
                        <button
                          key={a.uid}
                          onClick={() => setComposeForm(f => ({ ...f, recipient: f.recipient === a.uid ? '' : a.uid }))}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-xl border transition-all text-left',
                            composeForm.recipient === a.uid
                              ? 'border-[#00C853]/50 bg-[#00C853]/10'
                              : 'border-[#1E293B] bg-[#1C2333] hover:border-[#94A3B8]/30'
                          )}
                        >
                          <Avatar className="h-7 w-7 rounded-lg shrink-0">
                            <AvatarFallback className="rounded-lg bg-[#0A0E1A] text-[#94A3B8] text-[10px] font-black">
                              {a.firstName[0]}{a.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold text-white truncate">{a.firstName} {a.lastName}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {otherStaff.length > 0 && (
                  <>
                    <p className="text-[9px] text-[#94A3B8] font-bold uppercase tracking-widest pt-2">Staff</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {otherStaff.map(s => (
                        <button
                          key={s.userId}
                          onClick={() => setComposeForm(f => ({ ...f, recipient: f.recipient === s.userId ? '' : s.userId }))}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-xl border transition-all text-left',
                            composeForm.recipient === s.userId
                              ? 'border-[#00C853]/50 bg-[#00C853]/10'
                              : 'border-[#1E293B] bg-[#1C2333] hover:border-[#94A3B8]/30'
                          )}
                        >
                          <div className="h-7 w-7 rounded-lg bg-[#0A0E1A] flex items-center justify-center shrink-0">
                            <span className="text-[#94A3B8] text-[10px] font-black">{(s.displayName || '?')[0]}</span>
                          </div>
                          <span className="text-xs font-bold text-white truncate">{s.displayName || 'Staff'}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!athletes?.length && !otherStaff.length && (
                  <p className="text-[#94A3B8] text-sm py-2">No squad members yet</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-[#94A3B8] uppercase">Subject</p>
                <Input
                  placeholder="Subject (optional)..."
                  value={composeForm.subject}
                  onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))}
                  className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-[#94A3B8] uppercase">Message *</p>
                <Textarea
                  placeholder="Write your message..."
                  value={composeForm.content}
                  onChange={e => setComposeForm(f => ({ ...f, content: e.target.value }))}
                  rows={5}
                  className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#94A3B8] focus:border-[#00C853] resize-none"
                />
              </div>
              <Button
                onClick={handleSendCompose}
                disabled={sending || !composeForm.content.trim() || !composeForm.recipient}
                className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Message
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
