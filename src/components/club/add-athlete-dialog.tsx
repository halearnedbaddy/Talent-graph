'use client';

import { useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection, query, where, getDocs, limit, doc, writeBatch, addDoc, getDoc,
} from 'firebase/firestore';
import type { AthleteProfile, ClubProfile } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
}

interface SearchResult extends AthleteProfile {
  id: string;
}

function getInitials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '??';
}

export function AddAthleteDialog({ open, onClose, clubId, clubName }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!firestore || !searchTerm.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const term = searchTerm.trim();
      const variants = [
        term,
        term.toLowerCase(),
        term.charAt(0).toUpperCase() + term.slice(1).toLowerCase(),
        term.toUpperCase(),
      ];

      const snaps = await Promise.all(
        variants.flatMap(v => [
          getDocs(query(collection(firestore, 'athletes'), where('firstName', '>=', v), where('firstName', '<=', v + '\uf8ff'), limit(6))),
          getDocs(query(collection(firestore, 'athletes'), where('lastName', '>=', v), where('lastName', '<=', v + '\uf8ff'), limit(6))),
        ])
      );

      const seen = new Set<string>();
      const merged: SearchResult[] = [];
      for (const snap of snaps) {
        for (const d of snap.docs) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const data = d.data() as AthleteProfile;
          if (!data.clubStatus || data.clubStatus !== 'active') {
            merged.push({ ...data, id: d.id });
          }
        }
      }
      setResults(merged.slice(0, 10));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Search failed', description: err.message });
    } finally {
      setIsSearching(false);
    }
  }, [firestore, searchTerm, toast]);

  const handleAddDirectly = async (athlete: SearchResult) => {
    if (!firestore) return;
    setProcessingId(`add_${athlete.id}`);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', clubId));
      const resolvedClubName = (clubSnap.data() as ClubProfile | undefined)?.clubName || clubName;

      const batch = writeBatch(firestore);

      batch.set(doc(firestore, 'clubs', clubId, 'squad', athlete.uid), {
        uid: athlete.uid,
        fullName: `${athlete.firstName} ${athlete.lastName}`,
        email: athlete.email ?? null,
        position: athlete.position ?? null,
        jerseyNumber: athlete.jerseyNumber ?? null,
        status: 'active',
        joinedAt: new Date().toISOString(),
      });

      batch.update(doc(firestore, 'athletes', athlete.uid), {
        affiliatedClubId: clubId,
        clubName: resolvedClubName,
        clubStatus: 'active',
        updatedAt: new Date().toISOString(),
      });

      batch.set(doc(firestore, 'club_members', `${athlete.uid}_${clubId}`), {
        userId: athlete.uid,
        clubId,
        clubName: resolvedClubName,
        displayName: `${athlete.firstName} ${athlete.lastName}`,
        role: 'athlete',
        status: 'active',
        joinedAt: new Date().toISOString(),
      });

      await batch.commit();

      await addDoc(collection(firestore, 'notifications', athlete.uid, 'items'), {
        type: 'club_approved',
        actorName: resolvedClubName,
        actorRole: 'club',
        message: `You are now an official member of ${resolvedClubName}! Welcome to the squad.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      setDoneIds(prev => new Set([...prev, `add_${athlete.id}`]));
      toast({ title: 'Athlete added!', description: `${athlete.firstName} ${athlete.lastName} is now an official squad member.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not add athlete.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendInvite = async (athlete: SearchResult) => {
    if (!firestore) return;
    setProcessingId(`inv_${athlete.id}`);
    try {
      const clubSnap = await getDoc(doc(firestore, 'clubs', clubId));
      const resolvedClubName = (clubSnap.data() as ClubProfile | undefined)?.clubName || clubName;

      const memberId = `${athlete.uid}_${clubId}`;
      const batch = writeBatch(firestore);

      batch.set(doc(firestore, 'club_members', memberId), {
        userId: athlete.uid,
        clubId,
        clubName: resolvedClubName,
        displayName: `${athlete.firstName} ${athlete.lastName}`,
        photoUrl: athlete.photoUrl ?? null,
        role: 'athlete',
        status: 'club_invited',
        invitedAt: new Date().toISOString(),
      });

      await batch.commit();

      await addDoc(collection(firestore, 'notifications', athlete.uid, 'items'), {
        type: 'club_invite',
        actorName: resolvedClubName,
        actorRole: 'club',
        clubId,
        clubMemberId: memberId,
        message: `${resolvedClubName} has invited you to join their squad! Accept or decline in your notifications.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      setDoneIds(prev => new Set([...prev, `inv_${athlete.id}`]));
      toast({ title: 'Invite sent!', description: `Invitation sent to ${athlete.firstName} ${athlete.lastName}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Could not send invite.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    setDoneIds(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Add Athlete
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search for an athlete by name. Add them directly to the squad or send them an invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 h-11"
              autoFocus
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
              className="h-11 font-black uppercase tracking-widest text-xs px-4"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {isSearching && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">No athletes found</p>
              <p className="text-xs mt-1">Try a different name or spelling.</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto -mx-1 px-1">
              {results.map(athlete => {
                const isAddDone = doneIds.has(`add_${athlete.id}`);
                const isInvDone = doneIds.has(`inv_${athlete.id}`);
                const isDone = isAddDone || isInvDone;
                const isProcessingAdd = processingId === `add_${athlete.id}`;
                const isProcessingInv = processingId === `inv_${athlete.id}`;
                const isProcessing = isProcessingAdd || isProcessingInv;

                return (
                  <div
                    key={athlete.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-11 w-11 rounded-xl shrink-0">
                      <AvatarImage src={athlete.photoUrl} className="object-cover rounded-xl" />
                      <AvatarFallback className="rounded-xl bg-muted font-black text-muted-foreground text-sm uppercase">
                        {getInitials(athlete.firstName, athlete.lastName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase truncate">
                        {athlete.firstName} {athlete.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {athlete.position && (
                          <Badge variant="outline" className="text-[9px] font-bold uppercase h-4 px-1.5">
                            {athlete.position}
                          </Badge>
                        )}
                        {athlete.age && (
                          <span className="text-[10px] text-muted-foreground font-bold">{athlete.age}y</span>
                        )}
                        {athlete.isVerified && (
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        )}
                      </div>
                    </div>

                    {isDone ? (
                      <div className="flex items-center gap-1.5 text-green-600 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase">
                          {isAddDone ? 'Added' : 'Invited'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-wide bg-green-600 hover:bg-green-700 text-white gap-1"
                          onClick={() => handleAddDirectly(athlete)}
                          disabled={isProcessing}
                        >
                          {isProcessingAdd
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <UserPlus className="h-3 w-3" />
                          }
                          Add Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-wide gap-1"
                          onClick={() => handleSendInvite(athlete)}
                          disabled={isProcessing}
                        >
                          {isProcessingInv
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Send className="h-3 w-3" />
                          }
                          Invite
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-xs font-bold">Type a name above and press Search or Enter</p>
              <div className="mt-4 space-y-1.5 text-left max-w-xs mx-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Two ways to add:</p>
                <div className="flex items-start gap-2 text-[10px]">
                  <div className="h-4 w-4 rounded bg-green-600 flex items-center justify-center shrink-0 mt-0.5">
                    <UserPlus className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span><strong>Add Now</strong> — athlete joins squad immediately</span>
                </div>
                <div className="flex items-start gap-2 text-[10px]">
                  <div className="h-4 w-4 rounded border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <Send className="h-2.5 w-2.5" />
                  </div>
                  <span><strong>Invite</strong> — athlete receives a notification to accept or decline</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
