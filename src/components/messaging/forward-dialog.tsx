'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import type { Conversation, DirectMessage } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Forward } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  message: DirectMessage | null;
  currentUserId: string;
  currentUserName: string;
  currentConversationId: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

function getOtherParticipantInfo(conv: Conversation, currentUserId: string) {
  const otherId = conv.participants.find(p => p !== currentUserId);
  if (!otherId) return null;
  return { uid: otherId, ...conv.participantInfo[otherId] };
}

export function ForwardDialog({
  open,
  onClose,
  message,
  currentUserId,
  currentUserName,
  currentConversationId,
}: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [forwarding, setForwarding] = useState<string | null>(null);

  const conversationsQuery = useMemoFirebase(() => (
    firestore && currentUserId
      ? query(collection(firestore, 'conversations'), where('participants', 'array-contains', currentUserId))
      : null
  ), [firestore, currentUserId]);

  const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);

  const otherConversations = conversations?.filter(c => c.id !== currentConversationId) ?? [];

  const handleForward = async (targetConvId: string) => {
    if (!firestore || !message) return;
    setForwarding(targetConvId);
    try {
      const messagesRef = collection(firestore, 'conversations', targetConvId, 'messages');
      const now = new Date().toISOString();
      await addDoc(messagesRef, {
        senderId: currentUserId,
        senderName: currentUserName,
        content: message.content,
        timestamp: now,
        forwardedFrom: {
          originalSenderName: message.senderName,
          originalContent: message.content,
        },
      });

      await updateDoc(doc(firestore, 'conversations', targetConvId), {
        lastMessage: `📨 Forwarded: ${message.content.slice(0, 40)}`,
        lastMessageAt: now,
        lastSenderId: currentUserId,
        updatedAt: now,
      });

      toast({ title: 'Message forwarded' });
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not forward message.' });
    } finally {
      setForwarding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
            <Forward className="w-4 h-4" />
            Forward Message
          </DialogTitle>
          <DialogDescription>
            Choose a conversation to forward this message to.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className="px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground border-l-4 border-primary/30 mb-2">
            <p className="font-semibold text-xs text-primary/80 mb-0.5">{message.senderName}</p>
            <p className="truncate">{message.content}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : otherConversations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No other conversations to forward to.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {otherConversations.map(conv => {
              const other = getOtherParticipantInfo(conv, currentUserId);
              if (!other) return null;
              const isForwarding = forwarding === conv.id;
              return (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={other.photoUrl} />
                      <AvatarFallback className="text-xs font-bold">{getInitials(other.name || '?')}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{other.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{other.role}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleForward(conv.id)}
                    disabled={isForwarding}
                    className="h-8 shrink-0 font-black uppercase tracking-widest text-xs"
                  >
                    {isForwarding
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Forward className="h-3.5 w-3.5 mr-1" />Send</>
                    }
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
