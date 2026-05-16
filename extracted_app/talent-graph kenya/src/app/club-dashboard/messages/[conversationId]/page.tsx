'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { ClubConversation, ClubMessage, ClubProfile, ClubMember } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

export default function ClubChatPage() {
    const params = useParams();
    const router = useRouter();
    const conversationId = params.conversationId as string;
    const { user } = useUser();
    const firestore = useFirestore();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [newMessage, setNewMessage] = useState('');

    const clubMemberQuery = useMemoFirebase(() => (
        firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin')) : null
    ), [firestore, user]);
    const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
    const myClubId = userMemberships?.[0]?.clubId;

    const convRef = useMemoFirebase(() => (firestore ? doc(firestore, 'club_conversations', conversationId) : null), [firestore, conversationId]);
    const { data: conversation, isLoading: convLoading } = useDoc<ClubConversation>(convRef);

    const otherClubId = conversation?.participants.find(p => p !== myClubId);
    const otherClubRef = useMemoFirebase(() => (firestore && otherClubId ? doc(firestore, 'clubs', otherClubId) : null), [firestore, otherClubId]);
    const { data: otherClub } = useDoc<ClubProfile>(otherClubRef);

    const messagesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'club_conversations', conversationId, 'messages'), orderBy('timestamp', 'asc')) : null
    ), [firestore, conversationId]);
    const { data: messages, isLoading: msgLoading } = useCollection<ClubMessage>(messagesQuery);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !myClubId || !newMessage.trim()) return;

        const messagesCol = collection(firestore, 'club_conversations', conversationId, 'messages');
        const now = new Date().toISOString();

        addDocumentNonBlocking(messagesCol, {
            senderId: user.uid,
            clubId: myClubId,
            content: newMessage,
            timestamp: now,
        });

        if (convRef) {
            setDocumentNonBlocking(convRef, { 
                lastMessage: newMessage,
                updatedAt: now 
            }, { merge: true });
        }

        setNewMessage('');
    };

    if (convLoading || msgLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-muted/20 border rounded-xl overflow-hidden">
            <header className="bg-background border-b p-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <Avatar>
                    <AvatarImage src={otherClub?.logoUrl} />
                    <AvatarFallback>{getInitials(otherClub?.clubName || '??')}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-bold">{otherClub?.clubName || 'Loading...'}</p>
                    <p className="text-xs text-muted-foreground">Club Networking</p>
                </div>
            </header>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef as any}>
                <div className="space-y-4">
                    {messages?.map(msg => (
                        <div key={msg.id} className={cn('flex flex-col', msg.clubId === myClubId ? 'items-end' : 'items-start')}>
                            <div className={cn('max-w-[70%] rounded-2xl px-4 py-2 text-sm', msg.clubId === myClubId ? 'bg-primary text-primary-foreground' : 'bg-background border')}>
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                {format(new Date(msg.timestamp), 'p')}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <form onSubmit={handleSend} className="p-4 bg-background border-t flex gap-2">
                <Input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type a message to the other club..." 
                />
                <Button type="submit" size="icon"><Send className="w-4 h-4" /></Button>
            </form>
        </div>
    );
}