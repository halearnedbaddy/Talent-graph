'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  doc, collection, query, orderBy, addDoc, updateDoc, getDoc, getDocs, where, writeBatch,
} from 'firebase/firestore';
import type { Conversation, DirectMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Phone, MoreVertical, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { MessageBubble } from '@/components/messaging/message-bubble';
import { ForwardDialog } from '@/components/messaging/forward-dialog';
import { format } from 'date-fns';

function getInitials(name: string) {
  const parts = (name || '').trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || '?').substring(0, 2).toUpperCase();
}

function groupMessagesByDate(messages: DirectMessage[]) {
  const groups: { date: string; messages: DirectMessage[] }[] = [];
  for (const msg of messages) {
    const dateKey = format(new Date(msg.timestamp), 'MMMM d, yyyy');
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
  }
  return groups;
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserPhoto, setCurrentUserPhoto] = useState('');
  const [forwardMessage, setForwardMessage] = useState<DirectMessage | null>(null);

  // Fetch current user's name for sending messages
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(firestore, 'users', user.uid));
        const userData = userSnap.data() as any;
        const role = userData?.role || 'user';
        if (role === 'scout' || role === 'coach') {
          const snap = await getDoc(doc(firestore, 'scouts', user.uid));
          const p = snap.data() as any;
          setCurrentUserName(p?.name || 'User');
          setCurrentUserPhoto(p?.photoUrl || '');
        } else if (role === 'athlete') {
          const snap = await getDoc(doc(firestore, 'athletes', user.uid));
          const p = snap.data() as any;
          setCurrentUserName(`${p?.firstName || ''} ${p?.lastName || ''}`.trim() || 'User');
          setCurrentUserPhoto(p?.photoUrl || '');
        } else if (role === 'club') {
          const snap = await getDoc(doc(firestore, 'clubs', user.uid));
          const p = snap.data() as any;
          setCurrentUserName(p?.clubName || 'Club');
          setCurrentUserPhoto(p?.logoUrl || '');
        } else {
          setCurrentUserName(userData?.firstName || user.displayName || 'User');
        }
      } catch {
        setCurrentUserName(user.displayName || 'User');
      }
    })();
  }, [firestore, user]);

  // Conversation metadata
  const convRef = useMemoFirebase(() => (
    firestore ? doc(firestore, 'conversations', conversationId) : null
  ), [firestore, conversationId]);
  const { data: conversation, isLoading: convLoading } = useDoc<Conversation>(convRef);

  // Real-time messages
  const messagesQuery = useMemoFirebase(() => (
    firestore
      ? query(
          collection(firestore, 'conversations', conversationId, 'messages'),
          orderBy('timestamp', 'asc')
        )
      : null
  ), [firestore, conversationId]);
  const { data: messages, isLoading: msgsLoading } = useCollection<DirectMessage>(messagesQuery);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark new_message notifications for this conversation as read when the user opens it
  useEffect(() => {
    if (!firestore || !user?.uid || !conversationId) return;
    (async () => {
      try {
        const q = query(
          collection(firestore, 'notifications', user.uid, 'items'),
          where('type', '==', 'new_message'),
          where('conversationId', '==', conversationId),
          where('isRead', '==', false)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;
        const batch = writeBatch(firestore);
        snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
        await batch.commit();
      } catch {
        // Non-critical — don't surface errors
      }
    })();
  }, [firestore, user?.uid, conversationId]);

  const otherParticipantId = conversation?.participants.find(p => p !== user?.uid);
  const otherInfo = otherParticipantId ? conversation?.participantInfo?.[otherParticipantId] : null;

  // Send message
  const handleSend = useCallback(async () => {
    if (!firestore || !user || !newMessage.trim() || isSending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    try {
      const now = new Date().toISOString();
      const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: currentUserName || user.displayName || 'User',
        content,
        timestamp: now,
      });
      await updateDoc(doc(firestore, 'conversations', conversationId), {
        lastMessage: content,
        lastMessageAt: now,
        lastSenderId: user.uid,
        updatedAt: now,
      });

      // Notify the other participant so they see the message in their Alerts tab
      const recipientId = conversation?.participants.find(p => p !== user.uid);
      if (recipientId) {
        try {
          await addDoc(collection(firestore, 'notifications', recipientId, 'items'), {
            type: 'new_message',
            actorName: currentUserName || user.displayName || 'Someone',
            actorRole: 'user',
            message: content.length > 100 ? content.slice(0, 100) + '…' : content,
            conversationId,
            url: `/chat/${conversationId}`,
            isRead: false,
            createdAt: now,
          });
        } catch {
          // Notification failure is non-critical — don't block the message send
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
      setNewMessage(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [firestore, user, newMessage, isSending, currentUserName, conversationId, conversation, toast]);

  // Edit message
  const handleEdit = useCallback(async (messageId: string, newContent: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'conversations', conversationId, 'messages', messageId), {
        content: newContent,
        editedAt: new Date().toISOString(),
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not edit message.' });
    }
  }, [firestore, conversationId, toast]);

  // Delete message
  const handleDelete = useCallback(async (messageId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'conversations', conversationId, 'messages', messageId), {
        isDeleted: true,
        content: '',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete message.' });
    }
  }, [firestore, conversationId, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = isUserLoading || convLoading || msgsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation && !convLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center px-4">
        <p className="font-bold text-lg">Conversation not found</p>
        <Button onClick={() => router.push('/chat')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Messages
        </Button>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages ?? []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b flex-shrink-0">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => router.push('/chat')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={otherInfo?.photoUrl} />
            <AvatarFallback className="font-bold text-sm">
              {getInitials(otherInfo?.name || '?')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{otherInfo?.name || 'Chat'}</p>
            {otherInfo?.role && (
              <Badge variant="outline" className="text-[10px] font-bold capitalize h-4 px-1.5">
                {otherInfo.role}
              </Badge>
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
              Say hi to {otherInfo?.name || 'them'}!
            </p>
          </div>
        )}

        {messageGroups.map(group => (
          <div key={group.date} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest shrink-0">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              {group.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === user?.uid}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onForward={setForwardMessage}
                  senderInitials={getInitials(msg.senderName || otherInfo?.name || '?')}
                />
              ))}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className={cn(
                'w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                'transition-all duration-200 max-h-40 overflow-y-auto',
                'placeholder:text-muted-foreground'
              )}
              style={{ minHeight: '44px' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="h-11 w-11 rounded-full shrink-0"
          >
            {isSending
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Send className="h-5 w-5" />
            }
          </Button>
        </div>
      </div>

      {/* Forward dialog */}
      {user && currentUserName && (
        <ForwardDialog
          open={!!forwardMessage}
          onClose={() => setForwardMessage(null)}
          message={forwardMessage}
          currentUserId={user.uid}
          currentUserName={currentUserName}
          currentConversationId={conversationId}
        />
      )}
    </div>
  );
}
