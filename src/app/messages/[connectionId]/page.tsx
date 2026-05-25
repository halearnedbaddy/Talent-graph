'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { ScoutConnection, AthleteProfile, ScoutProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Send, ShieldAlert, AlertTriangle, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface ScoutMsg {
  id: string;
  senderId: string;
  senderName?: string;
  content?: string;
  text?: string;
  timestamp?: string;
  createdAt?: any;
  isDeleted?: boolean;
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

function getMessageTime(msg: ScoutMsg): Date | null {
  if (msg.timestamp) return new Date(msg.timestamp);
  if (msg.createdAt?.toDate) return msg.createdAt.toDate();
  if (msg.createdAt && typeof msg.createdAt === 'string') return new Date(msg.createdAt);
  return null;
}

function groupByDate(messages: ScoutMsg[]) {
  const groups: { date: string; messages: ScoutMsg[] }[] = [];
  for (const msg of messages) {
    const d = getMessageTime(msg);
    const dateKey = d ? format(d, 'MMMM d, yyyy') : 'Unknown date';
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) last.messages.push(msg);
    else groups.push({ date: dateKey, messages: [msg] });
  }
  return groups;
}

export default function MessagingPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connectionId as string;
  const { user: authUser, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [newMessage, setNewMessage] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const connectionDocRef = useMemoFirebase(() => (
    firestore && connectionId ? doc(firestore, 'scout_connections', connectionId) : null
  ), [firestore, connectionId]);
  const { data: connection, isLoading: isConnectionLoading } = useDoc<ScoutConnection>(connectionDocRef);

  const otherUserId = useMemo(() => {
    if (!connection || !authUser) return null;
    return authUser.uid === connection.athleteId ? connection.scoutId : connection.athleteId;
  }, [connection, authUser]);

  const otherUserRole = useMemo(() => {
    if (!connection || !authUser) return null;
    return authUser.uid === connection.athleteId ? 'scout' : 'athlete';
  }, [connection, authUser]);

  const otherUserDocRef = useMemoFirebase(() => {
    if (firestore && otherUserId && otherUserRole) {
      return doc(firestore, otherUserRole === 'scout' ? 'scouts' : 'athletes', otherUserId);
    }
    return null;
  }, [firestore, otherUserId, otherUserRole]);
  const { data: otherUserProfile } = useDoc<AthleteProfile | ScoutProfile>(otherUserDocRef);

  const messagesQuery = useMemoFirebase(() => (
    firestore && connectionId
      ? query(
          collection(firestore, 'scout_connections', connectionId, 'messages'),
          orderBy('timestamp', 'asc')
        )
      : null
  ), [firestore, connectionId]);
  const { data: messages, isLoading: areMessagesLoading } = useCollection<ScoutMsg>(messagesQuery);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!firestore || !authUser || !connectionId || !newMessage.trim() || connection?.isReported || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    const now = new Date().toISOString();
    try {
      await addDoc(collection(firestore, 'scout_connections', connectionId, 'messages'), {
        senderId: authUser.uid,
        content,
        timestamp: now,
      });
      // Notify the other party
      if (otherUserId) {
        const myName = authUser.displayName || 'User';
        try {
          await addDoc(collection(firestore, 'notifications', otherUserId, 'items'), {
            type: 'scout_message',
            actorName: myName,
            message: content.slice(0, 80),
            senderId: authUser.uid,
            connectionId,
            isRead: false,
            createdAt: now,
          });
        } catch { /* non-critical */ }
      }
    } catch {
      toast({ title: 'Error', description: 'Could not send message.', variant: 'destructive' });
      setNewMessage(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [firestore, authUser, connectionId, newMessage, connection?.isReported, isSending, otherUserId, toast]);

  const handleDeleteMessage = async (msgId: string) => {
    if (!firestore) return;
    setDeletingId(msgId);
    try {
      await updateDoc(doc(firestore, 'scout_connections', connectionId, 'messages', msgId), {
        isDeleted: true,
        content: '',
        text: '',
      });
    } catch {
      toast({ title: 'Error', description: 'Could not delete message.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReport = async () => {
    if (!firestore || !authUser || !connectionId || !reportReason.trim()) return;
    setIsReporting(true);
    try {
      await updateDoc(doc(firestore, 'scout_connections', connectionId), {
        isReported: true,
        reportReason,
        reportedBy: authUser.uid,
        reportedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Report submitted', description: 'The conversation has been disabled.', variant: 'destructive' });
      setIsReportDialogOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Could not submit report.', variant: 'destructive' });
    } finally {
      setIsReporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isLoading = isUserLoading || isConnectionLoading || areMessagesLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!connection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center px-4">
        <p className="font-bold">Connection not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!authUser || (authUser.uid !== connection.athleteId && authUser.uid !== connection.scoutId)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center px-4">
        <p className="font-bold">You don't have permission to view this conversation.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const otherUserName = otherUserProfile
    ? ('name' in otherUserProfile ? otherUserProfile.name : `${(otherUserProfile as AthleteProfile).firstName} ${(otherUserProfile as AthleteProfile).lastName}`)
    : 'User';

  const messageGroups = groupByDate((messages ?? []).filter(m => !m.isDeleted));

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b flex-shrink-0">
        <div className="flex items-center justify-between px-4 h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={(otherUserProfile as any)?.photoUrl} />
              <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">
                {getInitials(otherUserName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{otherUserName}</p>
              <Badge variant="outline" className="text-[9px] font-bold capitalize h-4 px-1.5">
                {otherUserRole === 'scout' ? 'Scout' : 'Athlete'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {connection.status === 'accepted' && (
              <Badge className="bg-green-500/10 text-green-600 border-green-400/30 font-bold text-[10px]">
                Active
              </Badge>
            )}
            {connection.status === 'pending' && (
              <Badge variant="secondary" className="font-bold text-[10px]">
                Pending
              </Badge>
            )}
            {!connection.isReported && (
              <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <div className="flex items-center gap-2 text-destructive mb-1">
                      <AlertTriangle className="w-5 h-5" />
                      <DialogTitle>Report Misconduct</DialogTitle>
                    </div>
                    <DialogDescription>
                      Describe the inappropriate behavior. This will permanently disable messaging for this connection.
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Enter reason for report..."
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleReport} disabled={isReporting || !reportReason.trim()}>
                      {isReporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Submit Report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {messageGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Send className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-bold text-lg">Start the conversation</p>
            <p className="text-sm text-muted-foreground mt-1">
              {connection.status === 'pending'
                ? 'Your message has been sent. Waiting for a reply.'
                : `Say hi to ${otherUserName}!`}
            </p>
          </div>
        )}

        {messageGroups.map(group => (
          <div key={group.date} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest shrink-0">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {group.messages.map(msg => {
              const isMine = msg.senderId === authUser.uid;
              const content = msg.content || (msg as any).text || '';
              const time = getMessageTime(msg);
              const isDeleting = deletingId === msg.id;
              return (
                <div key={msg.id} className={cn('flex items-end gap-2 group', isMine ? 'flex-row-reverse' : 'flex-row')}>
                  {!isMine && (
                    <Avatar className="h-8 w-8 shrink-0 mb-1">
                      <AvatarImage src={(otherUserProfile as any)?.photoUrl} />
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {getInitials(otherUserName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn('max-w-[75%] space-y-1', isMine ? 'items-end' : 'items-start', 'flex flex-col')}>
                    <div className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative',
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm'
                    )}>
                      {content}
                    </div>
                    <div className={cn('flex items-center gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                      <p className="text-[10px] text-muted-foreground">
                        {time ? formatDistanceToNow(time, { addSuffix: true }) : ''}
                      </p>
                      {isMine && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          {isDeleting
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3 flex-shrink-0">
        {connection.isReported ? (
          <div className="flex items-center justify-center gap-2 text-destructive bg-destructive/5 p-3 rounded-xl border border-destructive/20 text-sm font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            This conversation has been disabled due to a misconduct report.
          </div>
        ) : connection.status === 'pending' && authUser.uid === connection.scoutId ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground bg-muted/40 p-3 rounded-xl text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for athlete to accept your request…
          </div>
        ) : (
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className={cn(
                  'w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                  'transition-all duration-200 max-h-32 overflow-y-auto',
                  'placeholder:text-muted-foreground'
                )}
                style={{ minHeight: '44px' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                }}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              size="icon"
              className="h-11 w-11 rounded-full shrink-0"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
