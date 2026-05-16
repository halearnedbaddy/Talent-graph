'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Search, User, MessageSquare, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { SupportThread, SupportMessage, UserAccount } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function SupportInbox() {
  const { user: adminUser } = useUser();
  const firestore = useFirestore();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch threads assigned to THIS admin
  const threadsQuery = useMemoFirebase(() => {
    if (!firestore || !adminUser) return null;
    return query(
      collection(firestore, 'support_threads'), 
      where('adminId', '==', adminUser.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, adminUser]);

  const { data: threads, isLoading: threadsLoading } = useCollection<SupportThread>(threadsQuery);

  // 2. Fetch messages for selected thread
  const messagesQuery = useMemoFirebase(() => (
    firestore && selectedThreadId ? query(collection(firestore, 'support_threads', selectedThreadId, 'messages'), orderBy('timestamp', 'asc')) : null
  ), [firestore, selectedThreadId]);

  const { data: messages, isLoading: msgsLoading } = useCollection<SupportMessage>(messagesQuery);

  // 3. Fetch user details for all threads to show names
  const userIds = Array.from(new Set(threads?.map(t => t.userId) || []));
  const usersQuery = useMemoFirebase(() => (
    firestore && userIds.length > 0 ? query(collection(firestore, 'users'), where('id', 'in', userIds)) : null
  ), [firestore, userIds.join(',')]);
  const { data: users } = useCollection<UserAccount>(usersQuery);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleAccept = async (threadId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'support_threads', threadId), {
      status: 'accepted',
      updatedAt: new Date().toISOString()
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !adminUser || !selectedThreadId || !newMessage.trim()) return;

    await addDoc(collection(firestore, 'support_threads', selectedThreadId, 'messages'), {
      senderId: adminUser.uid,
      content: newMessage,
      timestamp: new Date().toISOString(),
    });

    await updateDoc(doc(firestore, 'support_threads', selectedThreadId), {
      lastMessage: newMessage,
      updatedAt: new Date().toISOString()
    });

    setNewMessage('');
  };

  const activeThread = threads?.find(t => t.id === selectedThreadId);
  const activeUser = users?.find(u => u.id === activeThread?.userId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
      <Card className="lg:col-span-1 overflow-hidden flex flex-col">
        <CardHeader className="border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search requests..." className="pl-9 bg-background h-9" />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {threadsLoading ? <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div> : threads?.length ? (
              threads.map((thread) => {
                const user = users?.find(u => u.id === thread.userId);
                return (
                  <div 
                    key={thread.id} 
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all flex items-center gap-3 border", 
                      selectedThreadId === thread.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted bg-background"
                    )}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${user?.firstName || thread.userId}`} />
                      <AvatarFallback><User /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold truncate">{user?.firstName || 'User'} {user?.lastName || ''}</p>
                        {thread.status === 'pending' && <Badge variant="destructive" className="h-4 text-[8px] px-1 uppercase tracking-tighter">New</Badge>}
                      </div>
                      <p className={cn("text-xs truncate", selectedThreadId === thread.id ? "text-primary-foreground/70" : "text-muted-foreground")}>{thread.lastMessage || 'New request'}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">No active support threads.</p>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="lg:col-span-2 overflow-hidden flex flex-col">
        {selectedThreadId ? (
          <>
            <CardHeader className="border-b py-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${activeUser?.firstName}`} />
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-bold">{activeUser?.firstName} {activeUser?.lastName}</CardTitle>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{activeUser?.role || 'User'}</p>
                </div>
              </div>
              {activeThread?.status === 'pending' && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAccept(selectedThreadId)}>
                  <Check className="h-4 w-4 mr-2" />
                  Accept Request
                </Button>
              )}
            </CardHeader>
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              <div className="space-y-4">
                {messages?.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col", msg.senderId === adminUser?.uid ? "items-end" : "items-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", msg.senderId === adminUser?.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {format(new Date(msg.timestamp), 'p')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <form onSubmit={handleSend} className="p-4 border-t bg-muted/10 flex gap-2">
              <Input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder={activeThread?.status === 'pending' ? "Accept request to reply..." : "Reply to user..."} 
                className="bg-background"
                disabled={activeThread?.status === 'pending'}
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || activeThread?.status === 'pending'}><Send className="w-4 h-4" /></Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-bold text-foreground">Select a conversation</p>
            <p className="text-sm">Manage user inquiries and technical issues from the sidebar.</p>
          </div>
        )}
      </Card>
    </div>
  );
}