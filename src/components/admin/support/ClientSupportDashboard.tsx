'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Send, Search, MessageSquare, AlertCircle, Clock, CheckCircle2,
  Tag, StickyNote, Filter, Plus, ThumbsUp, ThumbsDown, X, ChevronDown,
  TicketCheck, Users, Timer, TrendingUp, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import type { SupportTicket, SupportMessage, InternalNote, TicketStatus, TicketPriority } from '@/lib/types';

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: AlertCircle },
  pending_user: { label: 'Pending User', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200', icon: Clock },
  pending_internal: { label: 'Pending Internal', color: 'bg-orange-500/10 text-orange-600 border-orange-200', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-muted text-muted-foreground border-border', icon: X },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high: { label: 'High', color: 'bg-red-100 text-red-700' },
};

const TAGS = ['billing', 'verification', 'technical', 'onboarding', 'other'];
const ALL_STATUSES: TicketStatus[] = ['open', 'pending_user', 'pending_internal', 'resolved', 'closed'];

function SlaTimer({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const breached = isPast(deadlineDate);
  return (
    <span className={cn('text-[10px] font-bold flex items-center gap-1', breached ? 'text-red-500' : 'text-muted-foreground')}>
      <Timer className="w-3 h-3" />
      {breached ? 'SLA Breached' : `SLA: ${formatDistanceToNow(deadlineDate, { addSuffix: true })}`}
    </span>
  );
}

function NewTicketForm({ onClose, agentId, agentName }: { onClose: () => void; agentId: string; agentName: string }) {
  const firestore = useFirestore();
  const [form, setForm] = useState({ senderEmail: '', senderName: '', subject: '', message: '', priority: 'medium' as TicketPriority });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !form.senderEmail || !form.subject || !form.message) return;
    setSaving(true);
    const now = new Date();
    const slaHours = form.priority === 'high' ? 1 : form.priority === 'medium' ? 4 : 24;
    const slaDeadline = new Date(now.getTime() + slaHours * 3600000).toISOString();

    const ticketRef = await addDoc(collection(firestore, 'support_tickets'), {
      senderUserId: null,
      senderEmail: form.senderEmail,
      senderName: form.senderName || form.senderEmail,
      source: 'in_app',
      subject: form.subject,
      status: 'open',
      priority: form.priority,
      tags: [],
      assignedAgentId: agentId,
      slaDeadline,
      csatRating: null,
      accountProvisioned: false,
      provisionedUserId: null,
      lastMessage: form.message.slice(0, 100),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await addDoc(collection(firestore, 'support_tickets', ticketRef.id, 'messages'), {
      senderType: 'user',
      body: form.message,
      sentVia: 'in_app',
      sentAt: now.toISOString(),
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-bold">Create Support Ticket</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                <Input value={form.senderEmail} onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))} placeholder="user@email.com" required />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Name</label>
                <Input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} placeholder="Full name" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Subject *</label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Describe the issue" required />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TicketPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Initial Message *</label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe the issue in detail..." rows={4} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Ticket'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientSupportDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [activePanel, setActivePanel] = useState<'thread' | 'notes'>('thread');
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [tagDropdown, setTagDropdown] = useState(false);

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'support_tickets'), orderBy('updatedAt', 'desc'));
  }, [firestore]);

  const { data: allTickets, isLoading: ticketsLoading } = useCollection<SupportTicket>(ticketsQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedId) return null;
    return query(collection(firestore, 'support_tickets', selectedId, 'messages'), orderBy('sentAt', 'asc'));
  }, [firestore, selectedId]);
  const { data: messages, isLoading: msgsLoading } = useCollection<SupportMessage>(messagesQuery);

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedId) return null;
    return query(collection(firestore, 'support_tickets', selectedId, 'internalNotes'), orderBy('createdAt', 'asc'));
  }, [firestore, selectedId]);
  const { data: notes } = useCollection<InternalNote>(notesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, notes]);

  const filtered = (allTickets || []).filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.senderName.toLowerCase().includes(search.toLowerCase()) && !t.senderEmail.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedTicket = allTickets?.find(t => t.id === selectedId);

  const openCount = (allTickets || []).filter(t => t.status === 'open').length;
  const highPriorityCount = (allTickets || []).filter(t => t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedTodayCount = (allTickets || []).filter(t => {
    if (t.status !== 'resolved') return false;
    const updated = new Date(t.updatedAt);
    const today = new Date();
    return updated.toDateString() === today.toDateString();
  }).length;

  const csatRatings = (allTickets || [])
    .map(t => parseInt(t.csatRating ?? '', 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= 5);
  const csatAvg = csatRatings.length
    ? (csatRatings.reduce((a, b) => a + b, 0) / csatRatings.length)
    : null;
  const csatColor = csatAvg === null ? 'text-muted-foreground'
    : csatAvg >= 4 ? 'text-green-500'
    : csatAvg >= 3 ? 'text-yellow-500'
    : 'text-red-500';

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !selectedId || !replyText.trim()) return;
    setSending(true);
    const now = new Date().toISOString();
    await addDoc(collection(firestore, 'support_tickets', selectedId, 'messages'), {
      senderType: 'agent',
      senderName: user.displayName || user.email || 'Support Agent',
      body: replyText,
      sentVia: 'app',
      sentAt: now,
    });
    await updateDoc(doc(firestore, 'support_tickets', selectedId), {
      status: 'pending_user',
      updatedAt: now,
      lastMessage: replyText.slice(0, 100),
    });
    setReplyText('');
    setSending(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !selectedId || !noteText.trim()) return;
    await addDoc(collection(firestore, 'support_tickets', selectedId, 'internalNotes'), {
      agentId: user.uid,
      agentName: user.displayName || user.email || 'Agent',
      note: noteText,
      createdAt: new Date().toISOString(),
    });
    setNoteText('');
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!firestore || !selectedId) return;
    await updateDoc(doc(firestore, 'support_tickets', selectedId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!firestore || !selectedId) return;
    await updateDoc(doc(firestore, 'support_tickets', selectedId), {
      priority,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleTag = async (tag: string) => {
    if (!firestore || !selectedId || !selectedTicket) return;
    const current = selectedTicket.tags || [];
    const next = current.includes(tag as any)
      ? current.filter(t => t !== tag)
      : [...current, tag as any];
    await updateDoc(doc(firestore, 'support_tickets', selectedId), {
      tags: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const agentName = user?.displayName || user?.email || 'Agent';

  return (
    <div className="space-y-4">
      {showNewTicket && user && (
        <NewTicketForm
          onClose={() => setShowNewTicket(false)}
          agentId={user.uid}
          agentName={agentName}
        />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Open Tickets', value: openCount, icon: TicketCheck, color: 'text-blue-500' },
          { label: 'High Priority', value: highPriorityCount, icon: AlertCircle, color: 'text-red-500' },
          { label: 'Total Tickets', value: allTickets?.length ?? 0, icon: Users, color: 'text-purple-500' },
          { label: 'Resolved Today', value: resolvedTodayCount, icon: TrendingUp, color: 'text-green-500' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-3xl font-black mt-1', stat.color)}>{stat.value}</p>
              </div>
              <stat.icon className={cn('w-8 h-8 opacity-20', stat.color)} />
            </div>
          </Card>
        ))}

        {/* CSAT Score card */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg CSAT</p>
              {csatAvg === null ? (
                <p className="text-sm font-bold text-muted-foreground mt-1">No ratings yet</p>
              ) : (
                <>
                  <p className={cn('text-3xl font-black mt-1', csatColor)}>
                    {csatAvg.toFixed(1)}<span className="text-base font-bold text-muted-foreground">/5</span>
                  </p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={cn('w-3 h-3', n <= Math.round(csatAvg!) ? csatColor : 'text-muted-foreground/30')}
                        fill={n <= Math.round(csatAvg!) ? 'currentColor' : 'none'} />
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">({csatRatings.length})</span>
                  </div>
                </>
              )}
            </div>
            <Star className={cn('w-8 h-8 opacity-20', csatColor)} />
          </div>
        </Card>
      </div>

      {/* Main Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-320px)] min-h-[500px]">
        {/* Ticket List */}
        <Card className="lg:col-span-1 overflow-hidden flex flex-col">
          <CardHeader className="border-b bg-muted/30 p-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…" className="pl-8 h-8 text-xs bg-background" />
              </div>
              <Button size="sm" className="h-8 px-2 shrink-0" onClick={() => setShowNewTicket(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {ticketsLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">No tickets found.</p>
              ) : filtered.map(ticket => {
                const sc = STATUS_CONFIG[ticket.status];
                const pc = PRIORITY_CONFIG[ticket.priority];
                const isSelected = selectedId === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-transparent hover:border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold truncate leading-tight">{ticket.subject}</p>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0', pc.color)}>{pc.label}</span>
                    </div>
                    <p className={cn('text-[11px] truncate mb-1', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {ticket.senderName} · {ticket.senderEmail}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', sc.color)}>{sc.label}</span>
                      <SlaTimer deadline={ticket.slaDeadline} />
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Ticket Detail */}
        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {!selectedTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
              <p className="font-bold text-foreground">Select a ticket</p>
              <p className="text-sm mt-1">Choose a support ticket from the list to view the conversation.</p>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <CardHeader className="border-b py-3 px-4 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight truncate">{selectedTicket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedTicket.senderName} · {selectedTicket.senderEmail}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <SlaTimer deadline={selectedTicket.slaDeadline} />
                      {(selectedTicket.tags || []).map(tag => (
                        <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={selectedTicket.priority} onValueChange={v => handlePriorityChange(v as TicketPriority)}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedTicket.status} onValueChange={v => handleStatusChange(v as TicketStatus)}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTagDropdown(v => !v)}>
                        <Tag className="w-3 h-3 mr-1" /> Tags <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                      {tagDropdown && (
                        <div className="absolute right-0 top-8 z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[140px]">
                          {TAGS.map(tag => (
                            <button key={tag} onClick={() => handleToggleTag(tag)}
                              className={cn('w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between capitalize',
                                (selectedTicket.tags || []).includes(tag as any) && 'font-bold text-primary'
                              )}>
                              {tag}
                              {(selectedTicket.tags || []).includes(tag as any) && <CheckCircle2 className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Thread / Notes Tabs */}
              <div className="border-b px-4 shrink-0">
                <div className="flex gap-4">
                  {(['thread', 'notes'] as const).map(panel => (
                    <button key={panel} onClick={() => setActivePanel(panel)}
                      className={cn('text-xs font-bold uppercase tracking-wider py-2 border-b-2 transition-colors',
                        activePanel === panel ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}>
                      {panel === 'thread' ? <><MessageSquare className="w-3 h-3 inline mr-1" />Thread</> : <><StickyNote className="w-3 h-3 inline mr-1" />Internal Notes</>}
                    </button>
                  ))}
                </div>
              </div>

              {activePanel === 'thread' ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef as any}>
                    {msgsLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                    ) : messages?.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
                    ) : messages?.map(msg => (
                      <div key={msg.id} className={cn('flex flex-col', msg.senderType === 'agent' ? 'items-end' : 'items-start')}>
                        <p className="text-[10px] text-muted-foreground mb-1 px-1">
                          {msg.senderName || (msg.senderType === 'agent' ? 'Agent' : selectedTicket.senderName)}
                        </p>
                        <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          msg.senderType === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {msg.sentAt ? format(new Date(msg.sentAt), 'PPp') : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleReply} className="p-3 border-t bg-muted/10 flex gap-2 shrink-0">
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your reply…"
                      className="bg-background resize-none text-sm min-h-[60px] max-h-[120px]"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                    />
                    <Button type="submit" size="icon" className="self-end h-10 w-10 shrink-0" disabled={!replyText.trim() || sending}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-amber-50/30" ref={scrollRef as any}>
                    {!notes?.length ? (
                      <p className="text-center text-xs text-muted-foreground py-8">No internal notes. These are only visible to agents.</p>
                    ) : notes.map(note => (
                      <div key={note.id} className="bg-amber-100/60 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-amber-500 text-white">{(note.agentName || 'A')[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold">{note.agentName || 'Agent'}</span>
                          <span className="text-[10px] text-muted-foreground">{note.createdAt ? format(new Date(note.createdAt), 'PPp') : ''}</span>
                        </div>
                        <p className="text-sm text-amber-900">{note.note}</p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddNote} className="p-3 border-t bg-amber-50/20 flex gap-2 shrink-0">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add internal note (only visible to agents)…"
                      className="bg-background resize-none text-sm min-h-[60px] max-h-[120px] border-amber-200 focus-visible:ring-amber-400"
                    />
                    <Button type="submit" size="icon" className="self-end h-10 w-10 shrink-0 bg-amber-500 hover:bg-amber-600" disabled={!noteText.trim()}>
                      <StickyNote className="w-4 h-4" />
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
