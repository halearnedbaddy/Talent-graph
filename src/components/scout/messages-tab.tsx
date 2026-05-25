'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { ScoutProfile, ScoutConnection, AthleteProfile } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  MessageSquare, Send, Plus, Loader2, Clock, CheckCircle,
  ArrowRight, Search, X, ChevronLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface ScoutMsg {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content?: string;
  text?: string;
  timestamp?: string;
  createdAt?: any;
}

interface Props {
  scoutProfile: ScoutProfile;
  composeTarget?: AthleteProfile | null;
  onComposeClose?: () => void;
}

export function MessagesTab({ scoutProfile, composeTarget, onComposeClose }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteProfile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'accepted' | 'pending'>('all');
  const [activeChatConn, setActiveChatConn] = useState<ScoutConnection | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connectionsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', scoutProfile.uid)) : null
  ), [firestore, scoutProfile.uid]);
  const { data: connections, isLoading: connectionsLoading } = useCollection<ScoutConnection>(connectionsQuery);

  const activeChatMessagesQuery = useMemoFirebase(() => (
    firestore && activeChatConn
      ? query(
          collection(firestore, 'scout_connections', activeChatConn.id, 'messages'),
          orderBy('timestamp', 'asc')
        )
      : null
  ), [firestore, activeChatConn?.id]);
  const { data: activeChatMessages } = useCollection<ScoutMsg>(activeChatMessagesQuery);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  const athletesSearchQuery = useMemoFirebase(() => (
    firestore && athleteSearch.length > 1 ? collection(firestore, 'athletes') : null
  ), [firestore, athleteSearch]);
  const { data: searchAthletes } = useCollection<AthleteProfile>(athletesSearchQuery);

  const filteredSearchAthletes = useMemo(() => {
    if (!searchAthletes || athleteSearch.length < 2) return [];
    const q = athleteSearch.toLowerCase();
    return searchAthletes.filter(a =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchAthletes, athleteSearch]);

  const connectionAthleteIds = useMemo(() => new Set(connections?.map(c => c.athleteId) || []), [connections]);

  const allAthletesQuery = useMemoFirebase(() => (
    firestore && (connections?.length ?? 0) > 0 ? collection(firestore, 'athletes') : null
  ), [firestore, connections]);
  const { data: allAthletes } = useCollection<AthleteProfile>(allAthletesQuery);

  const athleteMap = useMemo(() => {
    const map: Record<string, AthleteProfile> = {};
    allAthletes?.forEach(a => { map[a.uid] = a; });
    return map;
  }, [allAthletes]);

  const filteredConnections = useMemo(() => {
    if (!connections) return [];
    let list = connections;
    if (activeFilter === 'accepted') list = list.filter(c => c.status === 'accepted');
    if (activeFilter === 'pending') list = list.filter(c => c.status === 'pending');
    return list;
  }, [connections, activeFilter]);

  async function handleSendMessage() {
    const target = selectedAthlete || composeTarget;
    if (!firestore || !target || !messageText.trim()) return;
    const existing = connections?.find(c => c.athleteId === target.uid);
    if (existing && existing.status === 'pending') {
      toast({ variant: 'destructive', title: 'Awaiting reply', description: 'This athlete has not replied yet.' });
      return;
    }
    setIsSending(true);
    try {
      const connId = `${target.uid}_${scoutProfile.uid}`;
      const now = new Date().toISOString();
      await setDoc(doc(firestore, 'scout_connections', connId), {
        id: connId,
        scoutId: scoutProfile.uid,
        athleteId: target.uid,
        status: existing?.status === 'accepted' ? 'accepted' : 'pending',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      await addDoc(collection(firestore, 'scout_connections', connId, 'messages'), {
        senderId: scoutProfile.uid,
        senderName: scoutProfile.name,
        senderRole: 'scout',
        content: messageText.trim(),
        timestamp: now,
      });
      // Notify athlete
      try {
        await addDoc(collection(firestore, 'notifications', target.uid, 'items'), {
          type: 'scout_message',
          actorName: scoutProfile.name,
          message: `sent you a message: "${messageText.trim().slice(0, 60)}${messageText.length > 60 ? '…' : ''}"`,
          senderId: scoutProfile.uid,
          connectionId: connId,
          isRead: false,
          createdAt: now,
        });
      } catch { /* non-critical */ }
      toast({ title: 'Message sent!', description: `Your message to ${target.firstName} has been sent.` });
      setComposeOpen(false);
      setSelectedAthlete(null);
      setMessageText('');
      setAthleteSearch('');
      onComposeClose?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message. Please try again.' });
    } finally { setIsSending(false); }
  }

  async function handleReply() {
    if (!firestore || !activeChatConn || !replyText.trim()) return;
    setIsReplying(true);
    const now = new Date().toISOString();
    try {
      await addDoc(collection(firestore, 'scout_connections', activeChatConn.id, 'messages'), {
        senderId: scoutProfile.uid,
        senderName: scoutProfile.name,
        senderRole: 'scout',
        content: replyText.trim(),
        timestamp: now,
      });
      // Notify athlete
      try {
        await addDoc(collection(firestore, 'notifications', activeChatConn.athleteId, 'items'), {
          type: 'scout_message',
          actorName: scoutProfile.name,
          message: replyText.trim().slice(0, 80),
          senderId: scoutProfile.uid,
          connectionId: activeChatConn.id,
          isRead: false,
          createdAt: now,
        });
      } catch { /* non-critical */ }
      setReplyText('');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send reply.' });
    } finally { setIsReplying(false); }
  }

  const openComposeWith = (a: AthleteProfile) => {
    setSelectedAthlete(a);
    setMessageText('');
    setAthleteSearch('');
    setComposeOpen(true);
  };

  const pendingCount = connections?.filter(c => c.status === 'pending').length ?? 0;
  const acceptedCount = connections?.filter(c => c.status === 'accepted').length ?? 0;

  // ── Inline chat view ──
  if (activeChatConn) {
    const athlete = athleteMap[activeChatConn.athleteId];
    return (
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b bg-muted/30 rounded-t-xl shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveChatConn(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {athlete?.photoUrl ? (
            <Image src={athlete.photoUrl} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8 border" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {athlete?.firstName?.[0]}{athlete?.lastName?.[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">
              {athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Athlete'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">{athlete?.position}</p>
          </div>
          <Badge
            variant={activeChatConn.status === 'accepted' ? 'default' : 'secondary'}
            className="text-[9px] shrink-0"
          >
            {activeChatConn.status === 'accepted' ? '✓ Active' : 'Pending reply'}
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!activeChatMessages?.length ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-bold text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            activeChatMessages.map(msg => {
              const isMine = msg.senderId === scoutProfile.uid;
              const content = msg.content || (msg as any).text || '';
              const time = msg.timestamp
                ? formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })
                : msg.createdAt?.toDate
                ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true })
                : '';
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  }`}>
                    {content}
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {time}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        <div className="border-t p-3 shrink-0">
          {activeChatConn.status !== 'accepted' ? (
            <p className="text-xs text-center text-muted-foreground py-2 bg-muted/40 rounded-lg">
              Waiting for athlete to accept before you can continue the conversation.
            </p>
          ) : (
            <div className="flex gap-2">
              <Textarea
                placeholder="Type a message…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                rows={1}
                className="resize-none text-sm flex-1"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleReply}
                disabled={isReplying || !replyText.trim()}
              >
                {isReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Messages</h2>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => { setSelectedAthlete(null); setComposeOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          New Message
        </Button>
      </div>

      {/* Universal Direct Messages Banner */}
      <Link href="/chat" className="flex items-center justify-between p-3 rounded-xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm">Direct Messages</p>
            <p className="text-xs text-muted-foreground">Message any scout, club, coach, or athlete</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
      </Link>

      <div className="flex gap-1 bg-muted p-0.5 rounded-lg">
        {(['all', 'accepted', 'pending'] as const).map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors capitalize ${activeFilter === f ? 'bg-background shadow text-foreground font-medium' : 'text-muted-foreground'}`}
          >
            {f === 'all' ? `All (${connections?.length ?? 0})` : f === 'accepted' ? `Active (${acceptedCount})` : `Pending (${pendingCount})`}
          </button>
        ))}
      </div>

      {connectionsLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filteredConnections.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center text-center gap-2">
            <MessageSquare className="w-10 h-10 text-muted-foreground/20" />
            <p className="font-medium text-muted-foreground">
              {activeFilter === 'all' ? 'No messages yet' : `No ${activeFilter} conversations`}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeFilter === 'all' && 'Send a message to any athlete from Search or Marketplace.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredConnections.map(conn => {
            const athlete = athleteMap[conn.athleteId];
            return (
              <Card key={conn.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setActiveChatConn(conn)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {athlete?.photoUrl ? (
                      <Image src={athlete.photoUrl} alt="" width={44} height={44} className="rounded-full object-cover w-11 h-11 border" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/10 border flex items-center justify-center text-sm font-bold text-primary">
                        {athlete?.firstName?.[0]}{athlete?.lastName?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Loading...'}
                      </p>
                      <Badge
                        variant={conn.status === 'accepted' ? 'default' : conn.status === 'declined' ? 'destructive' : 'secondary'}
                        className="text-[10px] px-1.5 py-0 flex-shrink-0"
                      >
                        {conn.status === 'accepted' ? '✓ Active' : conn.status === 'declined' ? 'Declined' : 'Pending reply'}
                      </Badge>
                    </div>
                    {athlete && (
                      <p className="text-xs text-muted-foreground">{athlete.position} · {athlete.country || 'Kenya'}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={composeOpen || !!composeTarget} onOpenChange={o => { if (!o) { setComposeOpen(false); onComposeClose?.(); setSelectedAthlete(null); }}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Send Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedAthlete && !composeTarget ? (
              <div>
                <Label className="text-sm mb-1.5 block">Search athlete</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Athlete name..."
                    className="pl-9"
                    value={athleteSearch}
                    onChange={e => setAthleteSearch(e.target.value)}
                  />
                </div>
                {filteredSearchAthletes.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1">
                    {filteredSearchAthletes.map(a => {
                      const existing = connections?.find(c => c.athleteId === a.uid);
                      const isPending = existing?.status === 'pending';
                      return (
                        <button
                          key={a.uid}
                          disabled={isPending}
                          onClick={() => { setSelectedAthlete(a); setAthleteSearch(''); }}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {a.firstName[0]}{a.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{a.firstName} {a.lastName}</p>
                            <p className="text-[10px] text-muted-foreground">{a.position} · {a.country}</p>
                          </div>
                          {isPending && <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(selectedAthlete || composeTarget)?.firstName?.[0]}{(selectedAthlete || composeTarget)?.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{(selectedAthlete || composeTarget)?.firstName} {(selectedAthlete || composeTarget)?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{(selectedAthlete || composeTarget)?.position}</p>
                </div>
                {!composeTarget && (
                  <button onClick={() => setSelectedAthlete(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">Change</button>
                )}
              </div>
            )}

            {(selectedAthlete || composeTarget) && (
              <div>
                <Label className="text-sm mb-1.5 block">Message</Label>
                <Textarea
                  placeholder="Introduce yourself and explain your interest..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  className="h-28 text-sm"
                  maxLength={500}
                />
                <p className="text-xs text-right text-muted-foreground mt-1">{messageText.length}/500</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComposeOpen(false); onComposeClose?.(); setSelectedAthlete(null); }}>Cancel</Button>
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !(selectedAthlete || composeTarget) || !messageText.trim()}
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
