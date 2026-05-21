'use client';

import { useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection, query, where, getDocs, setDoc, doc, addDoc, limit,
} from 'firebase/firestore';
import type { ScoutProfile } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, UserPlus, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
  existingUserIds: string[];
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function InviteStaffDialog({ open, onClose, clubId, clubName, existingUserIds }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ScoutProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<'scout' | 'coach'>('scout');

  const handleSearch = useCallback(async () => {
    if (!firestore || !searchTerm.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const term = searchTerm.trim();
      const termLower = term.toLowerCase();
      const end = termLower + '\uf8ff';

      const [usernameSnap, nameSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'scouts'), where('username', '>=', termLower), where('username', '<=', end), limit(20))),
        getDocs(query(collection(firestore, 'scouts'), where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(20))),
      ]);

      const seen = new Set<string>();
      const merged: ScoutProfile[] = [];
      for (const snap of [usernameSnap, nameSnap]) {
        for (const d of snap.docs) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            merged.push({ uid: d.id, ...d.data() } as ScoutProfile);
          }
        }
      }
      setResults(merged);
    } catch (e) {
      console.error('[InviteStaffDialog] search error:', e);
    } finally {
      setIsSearching(false);
    }
  }, [firestore, searchTerm]);

  const handleInvite = async (scout: ScoutProfile) => {
    if (!firestore) return;
    setInvitingId(scout.uid);
    try {
      const memberId = `${scout.uid}_${clubId}`;
      await setDoc(doc(firestore, 'club_members', memberId), {
        userId: scout.uid,
        clubId,
        clubName,
        role,
        status: 'club_invited',
        invitedAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        displayName: scout.name,
        photoUrl: scout.photoUrl || null,
      });

      await addDoc(collection(firestore, 'notifications', scout.uid, 'items'), {
        type: 'club_invitation',
        actorName: clubName,
        actorRole: 'club',
        message: `${clubName} has invited you to join as a ${role}. Go to your profile to accept or decline.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      setInvitedIds(prev => new Set([...prev, scout.uid]));
      toast({ title: 'Invitation sent', description: `${scout.name} has been invited as a ${role}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not send invitation.' });
    } finally {
      setInvitingId(null);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    setInvitedIds(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Invite Staff</DialogTitle>
          <DialogDescription>
            Search for scouts or coaches by name or username and send them a club invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Select value={role} onValueChange={v => setRole(v as 'scout' | 'coach')}>
              <SelectTrigger className="w-[110px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scout">Scout</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Name or @username…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                size="icon"
                className="shrink-0"
              >
                {isSearching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {results.map(scout => {
                const isExisting = existingUserIds.includes(scout.uid);
                const isJustInvited = invitedIds.has(scout.uid);
                const isInviting = invitingId === scout.uid;

                return (
                  <div
                    key={scout.uid}
                    className="flex items-center justify-between p-3 border rounded-lg gap-3 bg-background"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={scout.photoUrl} />
                        <AvatarFallback className="text-xs font-bold">
                          {getInitials(scout.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm truncate">{scout.name}</p>
                          {scout.isVerified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">@{scout.username}</p>
                      </div>
                    </div>

                    {isExisting ? (
                      <Badge variant="outline" className="text-[10px] shrink-0 font-bold">
                        Already added
                      </Badge>
                    ) : isJustInvited ? (
                      <Badge className="bg-green-500/15 text-green-600 border-none text-[10px] shrink-0 font-bold">
                        ✓ Invited
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInvite(scout)}
                        disabled={isInviting}
                        className="h-8 shrink-0 font-black uppercase tracking-widest text-xs"
                      >
                        {isInviting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><UserPlus className="h-3.5 w-3.5 mr-1.5" />Invite</>
                        }
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {hasSearched && !isSearching && results.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No results found for &ldquo;{searchTerm}&rdquo;. Try a different name or username.
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
