'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Conversation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Plus, Search, ArrowLeft } from 'lucide-react';
import { UserSearchDialog } from '@/components/messaging/user-search-dialog';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function getInitials(name: string) {
  const parts = (name || '').trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || '?').substring(0, 2).toUpperCase();
}

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserPhoto, setCurrentUserPhoto] = useState('');

  // Fetch current user's info for chat creation
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(firestore, 'users', user.uid));
        const userData = userSnap.data() as any;
        const role = userData?.role || 'user';
        setCurrentUserRole(role);

        if (role === 'scout' || role === 'coach') {
          const snap = await getDoc(doc(firestore, 'scouts', user.uid));
          const p = snap.data() as any;
          setCurrentUserName(p?.name || userData?.firstName || 'User');
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
      } catch (e) {
        setCurrentUserName(user.displayName || 'User');
      }
    })();
  }, [firestore, user]);

  const conversationsQuery = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(
          collection(firestore, 'conversations'),
          where('participants', 'array-contains', user.uid),
          orderBy('updatedAt', 'desc')
        )
      : null
  ), [firestore, user?.uid]);

  const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);

  const filteredConversations = conversations?.filter(conv => {
    if (!searchTerm.trim()) return true;
    const otherId = conv.participants.find(p => p !== user?.uid);
    const otherInfo = otherId ? conv.participantInfo?.[otherId] : null;
    return otherInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  }) ?? [];

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-black uppercase tracking-tight text-lg flex-1">Messages</h1>
          <Button
            size="sm"
            onClick={() => setNewChatOpen(true)}
            className="font-black uppercase tracking-widest text-xs h-8 gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations…"
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Conversations list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-bold text-lg">
              {searchTerm ? 'No conversations match' : 'No messages yet'}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchTerm
                ? 'Try a different name'
                : 'Start a conversation with any athlete, scout, coach, or club.'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setNewChatOpen(true)} className="font-black uppercase tracking-widest text-xs mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Start First Chat
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map(conv => {
              const otherId = conv.participants.find(p => p !== user.uid);
              const otherInfo = otherId ? conv.participantInfo?.[otherId] : null;
              const isUnread = conv.lastSenderId && conv.lastSenderId !== user.uid;

              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={otherInfo?.photoUrl} />
                    <AvatarFallback className="font-bold text-sm">
                      {getInitials(otherInfo?.name || '?')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={cn('font-semibold text-sm truncate', isUnread && 'font-black')}>
                        {otherInfo?.name || 'Unknown'}
                      </p>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-xs truncate flex-1', isUnread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                      {otherInfo?.role && (
                        <Badge variant="outline" className="text-[10px] font-bold capitalize shrink-0 h-4 px-1.5">
                          {otherInfo.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {user && currentUserName && (
        <UserSearchDialog
          open={newChatOpen}
          onClose={() => setNewChatOpen(false)}
          currentUserId={user.uid}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
          currentUserPhoto={currentUserPhoto}
        />
      )}
    </div>
  );
}
