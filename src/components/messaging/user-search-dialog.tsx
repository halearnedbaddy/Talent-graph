'use client';

import { useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, setDoc, doc, limit, getDoc } from 'firebase/firestore';
import type { ScoutProfile, AthleteProfile, ClubProfile } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  uid: string;
  name: string;
  username?: string;
  role: string;
  photoUrl?: string;
  isVerified?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  currentUserPhoto?: string;
  /** If provided, called with the conversationId instead of navigating to /chat/{id} */
  onConversationCreated?: (conversationId: string) => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function UserSearchDialog({
  open,
  onClose,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserPhoto,
  onConversationCreated,
}: Props) {
  const firestore = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!firestore || !searchTerm.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const term = searchTerm.trim();
      const termLower = term.toLowerCase();
      const endLower = termLower + '\uf8ff';
      const endTerm = term + '\uf8ff';

      const [scoutsByUsername, scoutsByName, athletesByFirst, athletesByLast, clubsByName] = await Promise.all([
        getDocs(query(collection(firestore, 'scouts'), where('username', '>=', termLower), where('username', '<=', endLower), limit(8))),
        getDocs(query(collection(firestore, 'scouts'), where('name', '>=', term), where('name', '<=', endTerm), limit(8))),
        getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', term), where('firstName', '<=', endTerm), limit(8))),
        getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', term), where('lastName', '<=', endTerm), limit(8))),
        getDocs(query(collection(firestore, 'clubs'), where('clubName', '>=', term), where('clubName', '<=', endTerm), limit(6))),
      ]);

      const seen = new Set<string>();
      const merged: SearchResult[] = [];

      for (const d of [...scoutsByUsername.docs, ...scoutsByName.docs]) {
        if (seen.has(d.id) || d.id === currentUserId) continue;
        seen.add(d.id);
        const p = d.data() as ScoutProfile;
        merged.push({ uid: d.id, name: p.name, username: p.username, role: 'scout', photoUrl: p.photoUrl, isVerified: p.isVerified });
      }
      for (const d of [...athletesByFirst.docs, ...athletesByLast.docs]) {
        if (seen.has(d.id) || d.id === currentUserId) continue;
        seen.add(d.id);
        const p = d.data() as AthleteProfile;
        merged.push({ uid: d.id, name: `${p.firstName} ${p.lastName}`, role: 'athlete', photoUrl: p.photoUrl, isVerified: p.isVerified });
      }
      for (const d of clubsByName.docs) {
        if (seen.has(d.id) || d.id === currentUserId) continue;
        seen.add(d.id);
        const p = d.data() as ClubProfile;
        merged.push({ uid: d.id, name: p.clubName, role: 'club', photoUrl: p.logoUrl });
      }

      setResults(merged);
    } catch (e) {
      console.error('[UserSearch]', e);
    } finally {
      setIsSearching(false);
    }
  }, [firestore, searchTerm, currentUserId]);

  const handleStartChat = async (other: SearchResult) => {
    if (!firestore) return;
    setStartingChat(other.uid);
    try {
      const conversationId = [currentUserId, other.uid].sort().join('_');
      const convRef = doc(firestore, 'conversations', conversationId);
      const existing = await getDoc(convRef);

      if (!existing.exists()) {
        await setDoc(convRef, {
          type: 'direct',
          participants: [currentUserId, other.uid],
          participantInfo: {
            [currentUserId]: { name: currentUserName, role: currentUserRole, photoUrl: currentUserPhoto || null },
            [other.uid]: { name: other.name, role: other.role, photoUrl: other.photoUrl || null },
          },
          participantRoles: {
            [currentUserId]: currentUserRole,
            [other.uid]: other.role,
          },
          lastMessage: null,
          lastMessageAt: null,
          lastSenderId: null,
          lastReadAt: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      onClose();
      if (onConversationCreated) {
        onConversationCreated(conversationId);
      } else {
        router.push(`/chat/${conversationId}`);
      }
    } catch (e) {
      console.error('[StartChat]', e);
    } finally {
      setStartingChat(null);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    onClose();
  };

  const roleBadgeColor: Record<string, string> = {
    scout: 'bg-blue-500/10 text-blue-600 border-none',
    athlete: 'bg-green-500/10 text-green-600 border-none',
    club: 'bg-purple-500/10 text-purple-600 border-none',
    coach: 'bg-orange-500/10 text-orange-600 border-none',
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            New Message
          </DialogTitle>
          <DialogDescription>
            Search for any athlete, scout, coach, or club to start a conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or username…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
              size="icon"
              className="shrink-0"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {results.map(r => (
                <div
                  key={r.uid}
                  className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={r.photoUrl} />
                      <AvatarFallback className="text-xs font-bold">{getInitials(r.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">{r.name}</p>
                        {r.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
                        <Badge className={`text-[10px] h-4 px-1.5 font-bold capitalize shrink-0 ${roleBadgeColor[r.role] || ''}`}>
                          {r.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartChat(r)}
                    disabled={startingChat === r.uid}
                    className="h-8 shrink-0 font-black uppercase tracking-widest text-xs"
                  >
                    {startingChat === r.uid
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Chat</>
                    }
                  </Button>
                </div>
              ))}
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No users found for &ldquo;{searchTerm}&rdquo;. Try a different name or username.
            </div>
          )}

          {!hasSearched && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Type a name or username above and press Search or Enter.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
