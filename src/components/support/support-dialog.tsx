
'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Headphones, Send, Loader2, User, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function SupportDialog() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setStep] = useState<'list' | 'chat'>('list');
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch available admins
  const adminsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'users'), where('role', '==', 'admin')) : null
  ), [firestore]);
  const { data: admins, isLoading: isAdminsLoading } = useCollection<UserAccount>(adminsQuery);

  // 2. Track existing thread with selected admin
  const threadId = user && selectedAdminId ? `${user.uid}_${selectedAdminId}` : null;
  const threadRef = useMemoFirebase(() => (firestore && threadId ? doc(firestore, 'support_threads', threadId) : null), [firestore, threadId]);
  const { data: thread, isLoading: isThreadLoading } = useDoc<SupportThread>(threadRef);

  // 3. Fetch messages for the active thread
  const messagesQuery = useMemoFirebase(() => (
    firestore && threadId ? query(collection(firestore, 'support_threads', threadId, 'messages'), orderBy('timestamp', 'asc')) : null
  ), [firestore, threadId]);
  const { data: messages, isLoading: isMsgsLoading } = useCollection<SupportMessage>(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSelectAdmin = (adminId: string) => {
    setSelectedAdminId(adminId);
    setStep('chat');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !selectedAdminId || !threadId || !newMessage.trim()) return;

    const now = new Date().toISOString();

    // Initialize or update thread
    if (!thread) {
      setDocumentNonBlocking(doc(firestore, 'support_threads', threadId), {
        id: threadId,
        userId: user.uid,
        adminId: selectedAdminId,
        status: 'pending',
        updatedAt: now,
        lastMessage: newMessage,
      });
    } else {
      setDocumentNonBlocking(doc(firestore, 'support_threads', threadId), {
        lastMessage: newMessage,
        updatedAt: now,
      }, { merge: true });
    }

    addDocumentNonBlocking(collection(firestore, 'support_threads', threadId, 'messages'), {
      senderId: user.uid,
      content: newMessage,
      timestamp: now,
    });

    setNewMessage('');
  };

  const activeAdmin = admins?.find(a => a.id === selectedAdminId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setStep('list'); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Headphones className="h-4 w-4" />
          Support
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            {view === 'chat' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep('list')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                {view === 'list' ? 'Platform Support' : `Chat with ${activeAdmin?.firstName || 'Admin'}`}
              </DialogTitle>
              <DialogDescription>
                {view === 'list' ? 'Choose an available administrator to talk to.' : 'Your conversation is private and secure.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'list' ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {isAdminsLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
                ) : admins?.length ? (
                  admins.map((admin) => (
                    <div 
                      key={admin.id} 
                      className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={() => handleSelectAdmin(admin.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${admin.firstName}`} />
                          <AvatarFallback><User /></AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">{admin.firstName} {admin.lastName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Platform Admin</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  ))
                ) : (
                  <p className="text-center py-12 text-muted-foreground text-sm">No administrators available at this time.</p>
                )}
              </div>
            </ScrollArea>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                <div className="space-y-4">
                  {thread?.status === 'pending' && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-dashed">
                      <Clock className="h-3 w-3" />
                      Waiting for connection approval...
                    </div>
                  )}
                  {messages?.map((msg) => (
                    <div key={msg.id} className={cn("flex flex-col", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                        msg.senderId === user?.uid ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {format(new Date(msg.timestamp), 'p')}
                      </span>
                    </div>
                  ))}
                  {(isThreadLoading || isMsgsLoading) && (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t bg-background flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
