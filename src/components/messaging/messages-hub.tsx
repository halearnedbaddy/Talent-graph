'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, orderBy, addDoc, updateDoc, doc,
  getDoc, setDoc, writeBatch, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserSearchDialog } from '@/components/messaging/user-search-dialog';
import {
  ArrowLeft, Search, Send, Plus, Users, Loader2,
  MessageSquare, Hash, Pencil, Trash2, MoreHorizontal, Copy, Check, X,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  type?: 'group' | 'direct';
  name?: string;
  clubId?: string;
  participants: string[];
  participantInfo?: Record<string, { name: string; role?: string; photoUrl?: string }>;
  participantRoles?: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  lastSenderName?: string;
  lastReadAt?: Record<string, string>;
  updatedAt?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  isDeleted?: boolean;
  editedAt?: string;
}

const ROLE_COLORS: Record<string, string> = {
  club:            '#00C853',
  club_admin:      '#00C853',
  coach:           '#3B82F6',
  assistant_coach: '#60A5FA',
  analyst:         '#A855F7',
  scout:           '#FF6D00',
  athlete:         '#F9FAFB',
};

function getInitials(name: string) {
  const parts = (name || '').trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || '?').substring(0, 2).toUpperCase();
}

function formatConvTime(ts?: string) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isToday(d)) return format(d, 'p');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'dd/MM/yy');
  } catch { return ''; }
}

function formatMsgTime(ts: string) {
  try { return format(new Date(ts), 'p'); } catch { return ''; }
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    let label = 'Today';
    try {
      const d = new Date(msg.timestamp);
      if (isToday(d)) label = 'Today';
      else if (isYesterday(d)) label = 'Yesterday';
      else label = format(d, 'MMMM d, yyyy');
    } catch {}
    const last = groups[groups.length - 1];
    if (last && last.label === label) { last.messages.push(msg); }
    else { groups.push({ label, messages: [msg] }); }
  }
  return groups;
}

function isUnread(conv: Conversation, userId: string) {
  if (!conv.lastMessageAt || !conv.lastSenderId) return false;
  if (conv.lastSenderId === userId) return false;
  const lastRead = conv.lastReadAt?.[userId];
  if (!lastRead) return true;
  return conv.lastMessageAt > lastRead;
}

function ConvItem({
  conv, userId, isActive, onClick,
}: {
  conv: Conversation; userId: string; isActive: boolean; onClick: () => void;
}) {
  const isGroup = conv.type === 'group';
  const otherId = !isGroup ? conv.participants.find(p => p !== userId) : undefined;
  const otherInfo = otherId ? conv.participantInfo?.[otherId] : undefined;
  const displayName = isGroup ? (conv.name || 'Club Chat') : (otherInfo?.name || 'Unknown');
  const displayPhoto = isGroup ? undefined : otherInfo?.photoUrl;
  const unread = isUnread(conv, userId);

  const preview = conv.lastMessage
    ? (conv.lastSenderId === userId ? `You: ${conv.lastMessage}` : conv.lastMessage)
    : 'No messages yet';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#1E293B]',
        isActive ? 'bg-[#1C2333]' : 'hover:bg-[#111827]'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11">
          {displayPhoto && <AvatarImage src={displayPhoto} className="object-cover" />}
          <AvatarFallback className={cn('font-black text-sm', isGroup ? 'bg-[#00C853]/20 text-[#00C853]' : 'bg-[#1C2333] text-[#94A3B8]')}>
            {isGroup ? <Hash className="h-5 w-5" /> : getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        {isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#00C853] flex items-center justify-center">
            <Users className="h-2.5 w-2.5 text-black" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={cn('text-sm truncate', unread ? 'font-black text-white' : 'font-semibold text-[#94A3B8]')}>
            {displayName}
          </p>
          <span className="text-[10px] text-[#94A3B8] shrink-0">{formatConvTime(conv.lastMessageAt || conv.updatedAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-xs truncate flex-1', unread ? 'text-white' : 'text-[#4B5563]')}>
            {preview}
          </p>
          {unread && (
            <span className="h-5 min-w-5 rounded-full bg-[#00C853] text-black text-[10px] font-black flex items-center justify-center px-1.5 shrink-0">
              ●
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatThread({
  conv,
  userId,
  userProfile,
  onBack,
}: {
  conv: Conversation;
  userId: string;
  userProfile: { name: string; role: string; photoUrl?: string };
  onBack: () => void;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isGroup = conv.type === 'group';
  const otherId = !isGroup ? conv.participants.find(p => p !== userId) : undefined;
  const otherInfo = otherId ? conv.participantInfo?.[otherId] : undefined;
  const displayName = isGroup ? (conv.name || 'Club Chat') : (otherInfo?.name || 'Chat');
  const displayPhoto = isGroup ? undefined : otherInfo?.photoUrl;
  const displayRole = !isGroup && otherInfo?.role;

  const msgsQuery = useMemoFirebase(() => (
    firestore
      ? query(collection(firestore, 'conversations', conv.id, 'messages'), orderBy('timestamp', 'asc'))
      : null
  ), [firestore, conv.id]);
  const { data: messages, isLoading } = useCollection<Message>(msgsQuery);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages?.length]);

  useEffect(() => {
    if (!firestore || !userId || !conv.id) return;
    updateDoc(doc(firestore, 'conversations', conv.id), {
      [`lastReadAt.${userId}`]: new Date().toISOString(),
    }).catch(() => {});
  }, [firestore, userId, conv.id]);

  const handleSend = useCallback(async () => {
    if (!firestore || !input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(firestore);

      const msgRef = doc(collection(firestore, 'conversations', conv.id, 'messages'));
      batch.set(msgRef, {
        senderId: userId,
        senderName: userProfile.name,
        senderRole: userProfile.role,
        content,
        timestamp: now,
        isDeleted: false,
      });

      // Use setDoc merge so participants field is always in sync even for older
      // conversations that were created before the participants array was enforced.
      batch.set(doc(firestore, 'conversations', conv.id), {
        lastMessage: content,
        lastMessageAt: now,
        lastSenderId: userId,
        lastSenderName: userProfile.name,
        updatedAt: now,
        [`lastReadAt.${userId}`]: now,
        // Ensure the sender is always in the participants array
        ...(conv.participants?.includes(userId) ? {} : { participants: [...(conv.participants ?? []), userId] }),
      }, { merge: true });

      await batch.commit();

      if (!isGroup && otherId) {
        addDoc(collection(firestore, 'notifications', otherId, 'items'), {
          type: 'new_message',
          actorName: userProfile.name,
          actorRole: userProfile.role,
          message: content.length > 80 ? content.slice(0, 80) + '…' : content,
          conversationId: conv.id,
          url: `/chat/${conv.id}`,
          isRead: false,
          createdAt: now,
        }).catch(() => {});
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
      setInput(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [firestore, input, sending, userId, userProfile, conv.id, isGroup, otherId, toast]);

  const handleDelete = async (msgId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'conversations', conv.id, 'messages', msgId), {
      isDeleted: true, content: '',
    }).catch(() => {});
  };

  const handleEditSave = async (msgId: string) => {
    if (!firestore || !editText.trim()) return;
    await updateDoc(doc(firestore, 'conversations', conv.id, 'messages', msgId), {
      content: editText.trim(),
      editedAt: new Date().toISOString(),
    }).catch(() => {});
    setEditingId(null);
  };

  const groups = groupByDate(messages ?? []);

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E293B] bg-[#111827] shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-[#94A3B8] hover:text-white h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            {displayPhoto && <AvatarImage src={displayPhoto} className="object-cover" />}
            <AvatarFallback className={cn('font-black text-xs', isGroup ? 'bg-[#00C853]/20 text-[#00C853]' : 'bg-[#1C2333] text-[#94A3B8]')}>
              {isGroup ? <Hash className="h-4 w-4" /> : getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-white truncate">{displayName}</p>
          {isGroup && (
            <p className="text-[10px] text-[#94A3B8]">{conv.participants.length} members</p>
          )}
          {displayRole && (
            <p className="text-[10px] text-[#94A3B8] capitalize">{displayRole}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#00C853]" />
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1C2333] flex items-center justify-center mb-4">
              <MessageSquare className="h-7 w-7 text-[#94A3B8]" />
            </div>
            <p className="font-black text-white">Start the conversation</p>
            <p className="text-sm text-[#94A3B8] mt-1">
              {isGroup ? 'Send a message to the whole club' : `Say hi to ${displayName}!`}
            </p>
          </div>
        )}

        {groups.map(group => (
          <div key={group.label} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#1E293B]" />
              <span className="text-[10px] text-[#4B5563] font-bold uppercase tracking-widest shrink-0">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-[#1E293B]" />
            </div>

            <div className="space-y-1">
              {group.messages.map((msg, i) => {
                const isOwn = msg.senderId === userId;
                const prevMsg = group.messages[i - 1];
                const showSenderInfo = !isOwn && (i === 0 || prevMsg?.senderId !== msg.senderId);
                const roleColor = ROLE_COLORS[msg.senderRole || ''] || '#94A3B8';

                if (msg.isDeleted) {
                  return (
                    <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-dashed border-[#1E293B] text-[#4B5563] text-xs italic">
                        <Trash2 className="h-3 w-3" /> Message deleted
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={cn('flex items-end gap-2 group', isOwn ? 'justify-end' : 'justify-start')}
                  >
                    {!isOwn && (
                      <div className="w-7 h-7 rounded-full bg-[#1C2333] border border-[#1E293B] flex items-center justify-center text-[9px] font-black text-[#94A3B8] shrink-0 mb-1">
                        {getInitials(msg.senderName)}
                      </div>
                    )}

                    <div className={cn('flex flex-col max-w-[72%]', isOwn ? 'items-end' : 'items-start')}>
                      {isGroup && !isOwn && showSenderInfo && (
                        <span className="text-[11px] font-black mb-1 px-1" style={{ color: roleColor }}>
                          {msg.senderName}
                          {msg.senderRole && (
                            <span className="font-normal text-[#94A3B8]"> · {msg.senderRole}</span>
                          )}
                        </span>
                      )}

                      <div className="flex items-end gap-1">
                        {isOwn && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                            <MsgActions
                              isOwn={isOwn}
                              onCopy={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                              onEdit={() => { setEditingId(msg.id); setEditText(msg.content); }}
                              onDelete={() => handleDelete(msg.id)}
                            />
                          </div>
                        )}

                        <div>
                          {editingId === msg.id ? (
                            <div className="space-y-1.5 min-w-[200px]">
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#1E293B] rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#00C853] min-h-[60px]"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <div className="flex gap-1.5 justify-end">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[#94A3B8]" onClick={() => setEditingId(null)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" className="h-7 px-3 bg-[#00C853] text-black hover:bg-[#00C853]/90 font-black text-xs" onClick={() => handleEditSave(msg.id)}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                              isOwn
                                ? 'bg-[#00C853] text-black rounded-br-sm'
                                : 'bg-[#1C2333] text-white rounded-bl-sm'
                            )}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <div className={cn('flex items-center gap-1.5 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
                                <span className={cn('text-[10px]', isOwn ? 'text-black/60' : 'text-[#4B5563]')}>
                                  {formatMsgTime(msg.timestamp)}
                                </span>
                                {msg.editedAt && (
                                  <span className={cn('text-[10px] italic', isOwn ? 'text-black/50' : 'text-[#4B5563]')}>
                                    · edited
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!isOwn && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                            <MsgActions
                              isOwn={isOwn}
                              onCopy={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                              onEdit={() => {}}
                              onDelete={() => {}}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {isOwn && (
                      <div className="w-7 h-7 rounded-full bg-[#00C853]/20 flex items-center justify-center text-[9px] font-black text-[#00C853] shrink-0 mb-1">
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-[#1E293B] bg-[#111827] shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Message…"
              rows={1}
              className="w-full bg-[#1C2333] border border-[#1E293B] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-[#4B5563] resize-none focus:outline-none focus:border-[#00C853] max-h-32 overflow-y-auto transition-colors"
              style={{ minHeight: '44px' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
              }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="h-11 w-11 rounded-full bg-[#00C853] hover:bg-[#00C853]/90 text-black shrink-0 p-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MsgActions({
  isOwn, onCopy, onEdit, onDelete,
}: { isOwn: boolean; onCopy: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-[#4B5563] hover:text-white">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-36 bg-[#1C2333] border-[#1E293B] text-white">
        <DropdownMenuItem onClick={onCopy} className="gap-2 text-xs hover:bg-[#0A0E1A] cursor-pointer">
          <Copy className="h-3.5 w-3.5" /> Copy
        </DropdownMenuItem>
        {isOwn && (
          <>
            <DropdownMenuSeparator className="bg-[#1E293B]" />
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs hover:bg-[#0A0E1A] cursor-pointer">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-xs text-red-400 hover:bg-[#0A0E1A] cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MessagesHubProps {
  defaultConversationId?: string;
}

export function MessagesHub({ defaultConversationId }: MessagesHubProps = {}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeConvId, setActiveConvId] = useState<string | null>(defaultConversationId || null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState<{ name: string; role: string; photoUrl?: string }>({ name: '', role: '' });

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(firestore, 'users', user.uid));
        const userData = userSnap.data() as any;
        const role = userData?.role || 'user';
        let name = user.displayName || 'User';
        let photoUrl = '';

        if (role === 'athlete') {
          const snap = await getDoc(doc(firestore, 'athletes', user.uid));
          const p = snap.data() as any;
          name = `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || name;
          photoUrl = p?.photoUrl || '';
        } else if (role === 'scout' || role === 'coach' || role === 'assistant_coach' || role === 'analyst' || role === 'gk_coach') {
          const snap = await getDoc(doc(firestore, 'scouts', user.uid));
          const p = snap.data() as any;
          if (p?.name) { name = p.name; photoUrl = p.photoUrl || ''; }
          else {
            const cm = await getDocs(query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')));
            if (!cm.empty) name = cm.docs[0].data().displayName || name;
          }
        } else if (role === 'club') {
          const snap = await getDoc(doc(firestore, 'clubs', `club_${user.uid}`));
          const p = snap.data() as any;
          name = p?.clubName || name;
          photoUrl = p?.logoUrl || '';
        }
        setUserProfile({ name, role, photoUrl });
      } catch {}
    })();
  }, [firestore, user]);

  const convQuery = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(
          collection(firestore, 'conversations'),
          where('participants', 'array-contains', user.uid),
          orderBy('updatedAt', 'desc')
        )
      : null
  ), [firestore, user?.uid]);
  const { data: conversations, isLoading } = useCollection<Conversation>(convQuery);

  const filtered = (conversations ?? []).filter(c => {
    if (!searchTerm.trim()) return true;
    const isGroup = c.type === 'group';
    if (isGroup) return (c.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const otherId = c.participants.find(p => p !== user?.uid);
    const name = otherId ? c.participantInfo?.[otherId]?.name || '' : '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const groups = filtered.filter(c => c.type === 'group');
  const directs = filtered.filter(c => c.type !== 'group');
  const activeConv = (conversations ?? []).find(c => c.id === activeConvId);
  const totalUnread = (conversations ?? []).filter(c => isUnread(c, user?.uid || '')).length;

  if (isUserLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0A0E1A] rounded-xl overflow-hidden border border-[#1E293B]" style={{ minHeight: '600px' }}>
      <div className={cn(
        'flex flex-col bg-[#0D1117] border-r border-[#1E293B]',
        activeConvId ? 'hidden md:flex md:w-80 lg:w-96' : 'flex w-full'
      )}>
        <div className="px-4 py-4 border-b border-[#1E293B] bg-[#111827] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-tight">Messages</h2>
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-[#00C853] text-black text-[10px] font-black flex items-center justify-center px-1.5">
                  {totalUnread}
                </span>
              )}
            </div>
            <Button
              size="icon"
              onClick={() => setShowNewDM(true)}
              className="h-8 w-8 bg-[#1C2333] hover:bg-[#00C853] hover:text-black text-[#94A3B8] rounded-full border border-[#1E293B]"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4B5563]" />
            <Input
              placeholder="Search conversations…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#4B5563] text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#00C853]" />
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[#0A0E1A]">
                    <p className="text-[10px] font-black text-[#4B5563] uppercase tracking-widest">Groups</p>
                  </div>
                  {groups.map(c => (
                    <ConvItem key={c.id} conv={c} userId={user?.uid || ''} isActive={activeConvId === c.id} onClick={() => setActiveConvId(c.id)} />
                  ))}
                </>
              )}

              {directs.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[#0A0E1A]">
                    <p className="text-[10px] font-black text-[#4B5563] uppercase tracking-widest">Direct Messages</p>
                  </div>
                  {directs.map(c => (
                    <ConvItem key={c.id} conv={c} userId={user?.uid || ''} isActive={activeConvId === c.id} onClick={() => setActiveConvId(c.id)} />
                  ))}
                </>
              )}

              {groups.length === 0 && directs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-[#1C2333] flex items-center justify-center mb-4">
                    <MessageSquare className="h-7 w-7 text-[#4B5563]" />
                  </div>
                  <p className="font-black text-white text-sm">
                    {searchTerm ? 'No conversations match' : 'No messages yet'}
                  </p>
                  <p className="text-xs text-[#4B5563] mt-1">
                    {searchTerm ? 'Try a different name' : 'Tap + to start a conversation'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={cn('flex-1 flex flex-col', activeConvId ? 'flex' : 'hidden md:flex')}>
        {activeConv && user ? (
          <ChatThread
            conv={activeConv}
            userId={user.uid}
            userProfile={userProfile}
            onBack={() => setActiveConvId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#0A0E1A]">
            <div className="w-20 h-20 rounded-full bg-[#1C2333] flex items-center justify-center mb-5">
              <MessageSquare className="h-9 w-9 text-[#4B5563]" />
            </div>
            <p className="font-black text-white text-lg">Your Messages</p>
            <p className="text-sm text-[#4B5563] mt-2 max-w-xs">
              Select a conversation from the left, or start a new one with the + button.
            </p>
          </div>
        )}
      </div>

      {user && userProfile.name && (
        <UserSearchDialog
          open={showNewDM}
          onClose={() => setShowNewDM(false)}
          currentUserId={user.uid}
          currentUserName={userProfile.name}
          currentUserRole={userProfile.role}
          currentUserPhoto={userProfile.photoUrl}
          onConversationCreated={id => { setShowNewDM(false); setActiveConvId(id); }}
        />
      )}
    </div>
  );
}
