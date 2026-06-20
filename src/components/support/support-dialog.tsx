'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, where, addDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { SupportThread, SupportMessage, UserAccount } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Headphones, Send, Loader2, ChevronRight, ArrowLeft,
  Clock, Mail, Phone, Plus, MessageSquare, CheckCircle2, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SupportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

type View = 'menu' | 'new-ticket' | 'my-tickets' | 'ticket-chat';

const TAG_OPTIONS = ['billing', 'verification', 'technical', 'onboarding', 'other'];
const PRIORITY_SLA: Record<string, number> = { high: 1, medium: 4, low: 24 };

export function SupportDialog({ open: externalOpen, onOpenChange: externalOnOpenChange, trigger }: SupportDialogProps = {}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [internalOpen, setInternalOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New ticket form state
  const [form, setForm] = useState({
    subject: '',
    message: '',
    priority: 'medium',
    tag: 'technical',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled) externalOnOpenChange?.(val);
    else setInternalOpen(val);
  };

  // Fetch this user's tickets
  const ticketsQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'support_tickets'), where('senderUserId', '==', user.uid), orderBy('updatedAt', 'desc'))
      : null
  ), [firestore, user?.uid]);
  const { data: myTickets, isLoading: ticketsLoading } = useCollection<any>(ticketsQuery);

  // Fetch messages for selected ticket
  const messagesQuery = useMemoFirebase(() => (
    firestore && selectedTicketId
      ? query(collection(firestore, 'support_tickets', selectedTicketId, 'messages'), orderBy('sentAt', 'asc'))
      : null
  ), [firestore, selectedTicketId]);
  const { data: messages, isLoading: msgsLoading } = useCollection<any>(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleReset = () => {
    setView('menu');
    setSelectedTicketId(null);
    setReplyText('');
    setSubmitted(false);
    setForm({ subject: '', message: '', priority: 'medium', tag: 'technical' });
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.subject.trim() || !form.message.trim()) return;
    setSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          senderEmail: user.email ?? '',
          senderName: user.displayName ?? user.email ?? 'User',
          subject: form.subject,
          message: form.message,
          priority: form.priority,
          tag: form.tag,
          source: 'in_app',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch (err) {
      console.error('[SupportDialog] ticket submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !selectedTicketId || !replyText.trim()) return;
    setSending(true);
    const now = new Date().toISOString();

    await addDoc(collection(firestore, 'support_tickets', selectedTicketId, 'messages'), {
      senderType: 'user',
      senderName: user.displayName ?? user.email ?? 'User',
      body: replyText,
      sentVia: 'in_app',
      sentAt: now,
    });

    setDocumentNonBlocking(
      doc(firestore, 'support_tickets', selectedTicketId),
      { status: 'pending_internal', updatedAt: now, lastMessage: replyText.slice(0, 100) },
      { merge: true }
    );

    setReplyText('');
    setSending(false);
  };

  const openTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView('ticket-chat');
  };

  const selectedTicket = myTickets?.find((t: any) => t.id === selectedTicketId);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'Open', color: 'text-blue-500' },
    pending_user: { label: 'Awaiting Your Reply', color: 'text-amber-500' },
    pending_internal: { label: 'Under Review', color: 'text-purple-500' },
    resolved: { label: 'Resolved', color: 'text-green-500' },
    closed: { label: 'Closed', color: 'text-muted-foreground' },
  };

  const getHeaderContent = () => {
    switch (view) {
      case 'new-ticket': return { title: 'New Support Request', desc: 'Describe your issue and we\'ll get back to you.' };
      case 'my-tickets': return { title: 'My Requests', desc: 'Track your open and past support tickets.' };
      case 'ticket-chat': return { title: selectedTicket?.subject ?? 'Conversation', desc: selectedTicket?.status ? STATUS_LABELS[selectedTicket.status]?.label : '' };
      default: return { title: 'Platform Support', desc: 'How can we help you today?' };
    }
  };

  const { title, desc } = getHeaderContent();
  const canGoBack = view !== 'menu';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) handleReset(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
              <Headphones className="h-4 w-4" />
              Contact Support
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[460px] h-[580px] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => view === 'ticket-chat' ? setView('my-tickets') : handleReset()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Headphones className="h-4 w-4 text-primary shrink-0" />
                {title}
              </DialogTitle>
              {desc && <DialogDescription className="text-xs mt-0.5 truncate">{desc}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* MENU */}
          {view === 'menu' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Direct contact */}
              <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Direct Contact</p>
                <a href="mailto:billionaireomenda@gmail.com" className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                  billionaireomenda@gmail.com
                </a>
                <a href="tel:+254727946012" className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                  +254 727 946 012
                </a>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setView('new-ticket')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-background hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Open a Support Ticket</p>
                    <p className="text-xs text-muted-foreground">Report an issue · billing · account help</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>

                <button
                  onClick={() => setView('my-tickets')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-background hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">My Requests</p>
                    <p className="text-xs text-muted-foreground">
                      {ticketsLoading ? 'Loading…' : myTickets?.length ? `${myTickets.length} ticket${myTickets.length !== 1 ? 's' : ''}` : 'No open tickets'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* NEW TICKET FORM */}
          {view === 'new-ticket' && (
            submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <p className="font-black text-lg">Ticket submitted!</p>
                  <p className="text-sm text-muted-foreground mt-1">Our team will respond within {PRIORITY_SLA[form.priority]}h. Check <strong>My Requests</strong> for updates.</p>
                </div>
                <Button onClick={() => setView('my-tickets')} size="sm">
                  <MessageSquare className="h-3.5 w-3.5 mr-2" />View My Tickets
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Subject *</label>
                  <Input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Briefly describe your issue"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Category</label>
                    <Select value={form.tag} onValueChange={v => setForm(f => ({ ...f, tag: v }))}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TAG_OPTIONS.map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Priority</label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High (urgent)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Describe the issue *</label>
                  <Textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Include as much detail as possible — what happened, what you expected, any error messages…"
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !form.subject.trim() || !form.message.trim()}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Ticket
                </Button>
              </form>
            )
          )}

          {/* MY TICKETS LIST */}
          {view === 'my-tickets' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {ticketsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
              ) : !myTickets?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <MessageSquare className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-bold">No support tickets yet</p>
                  <p className="text-xs text-muted-foreground">Open a ticket and we'll respond within a few hours.</p>
                  <Button size="sm" variant="outline" onClick={() => setView('new-ticket')}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Open a ticket
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="w-full mb-1" onClick={() => setView('new-ticket')}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />New ticket
                  </Button>
                  {myTickets.map((ticket: any) => {
                    const sc = STATUS_LABELS[ticket.status] ?? { label: ticket.status, color: 'text-muted-foreground' };
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openTicket(ticket.id)}
                        className="w-full text-left p-3 rounded-xl border bg-background hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold leading-tight truncate">{ticket.subject}</p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.lastMessage || 'No messages yet'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn('text-[10px] font-bold', sc.color)}>{sc.label}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground capitalize">{ticket.priority}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* TICKET CHAT */}
          {view === 'ticket-chat' && selectedTicket && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef as any}>
                {msgsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : !messages?.length ? (
                  <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
                ) : messages.map((msg: any) => {
                  const isUser = msg.senderType === 'user';
                  return (
                    <div key={msg.id} className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
                      <p className="text-[10px] text-muted-foreground mb-0.5 px-1">
                        {isUser ? 'You' : (msg.senderName || 'Support Agent')}
                      </p>
                      <div className={cn(
                        'max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        {msg.body}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {msg.sentAt ? format(new Date(msg.sentAt), 'p') : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? (
                <div className="p-4 border-t bg-muted/10 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    This ticket is {selectedTicket.status}. Open a new ticket if you need further help.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReply} className="p-3 border-t bg-background flex gap-2 shrink-0">
                  <Input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Add a reply…"
                    className="flex-1"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                  />
                  <Button type="submit" size="icon" disabled={!replyText.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
