'use client';

import { useState, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, writeBatch, addDoc,
} from 'firebase/firestore';
import { Search, Building2, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AthleteProfile, UserAccount, ClubProfile } from '@/lib/types';

interface Props {
  athleteProfile: AthleteProfile;
  userAccount: UserAccount;
  onSuccess: (clubId: string, clubName: string) => void;
}

export function ReapplyClubDialog({ athleteProfile, userAccount, onSuccess }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedClubName, setSelectedClubName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clubsQuery = useMemoFirebase(
    () =>
      firestore && clubSearch.trim().length > 1
        ? query(
            collection(firestore, 'clubs'),
            where('clubName', '>=', clubSearch.trim()),
            where('clubName', '<=', clubSearch.trim() + '\uf8ff')
          )
        : null,
    [firestore, clubSearch]
  );
  const { data: searchedClubs } = useCollection<ClubProfile>(clubsQuery);

  const handleSelect = useCallback((club: ClubProfile) => {
    setSelectedClubId(club.uid);
    setSelectedClubName(club.clubName);
  }, []);

  const handleSubmit = async () => {
    if (!firestore || !selectedClubId || !selectedClubName) return;
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const batch = writeBatch(firestore);

      const athleteRef = doc(firestore, 'athletes', athleteProfile.uid);
      batch.update(athleteRef, {
        affiliatedClubId: selectedClubId,
        clubName: selectedClubName,
        clubStatus: 'pending',
        updatedAt: now,
      });

      const pendingRef = doc(
        firestore,
        'clubs',
        selectedClubId,
        'pendingMembers',
        athleteProfile.uid
      );
      batch.set(pendingRef, {
        uid: athleteProfile.uid,
        fullName: `${userAccount.firstName} ${userAccount.lastName}`,
        email: userAccount.email || '',
        phone: athleteProfile.phone || null,
        position: athleteProfile.position || null,
        jerseyNumber: athleteProfile.jerseyNumber || null,
        clubId: selectedClubId,
        clubName: selectedClubName,
        status: 'pending',
        requestedAt: now,
      });

      await batch.commit();

      // Notify the club admin — clubId is always 'club_{adminUid}'
      const adminUid = selectedClubId.replace(/^club_/, '');
      if (adminUid) {
        const fullName = `${userAccount.firstName} ${userAccount.lastName}`.trim();
        await addDoc(collection(firestore, 'notifications', adminUid, 'items'), {
          type: 'club_join_request',
          actorName: fullName || 'An athlete',
          actorRole: 'athlete',
          athleteId: athleteProfile.uid,
          message: `${fullName || 'An athlete'} has sent a join request to ${selectedClubName}.`,
          isRead: false,
          createdAt: now,
        });
      }

      toast({
        title: 'Request sent!',
        description: `Your join request has been sent to ${selectedClubName}. You'll be notified once the admin approves you.`,
      });

      onSuccess(selectedClubId, selectedClubName);
      setOpen(false);
    } catch (err) {
      console.error('[ReapplyClubDialog] submit error', err);
      toast({
        variant: 'destructive',
        title: 'Could not send request',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setClubSearch('');
      setSelectedClubId('');
      setSelectedClubName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px] font-black uppercase tracking-widest px-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
        >
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Re-apply
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black uppercase tracking-widest">
            Apply to a Club
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search for a club and send them a join request. Your previous request to{' '}
            <span className="font-semibold text-foreground">{athleteProfile.clubName}</span>{' '}
            was not approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clubs by name…"
              className="pl-9 text-sm"
              value={clubSearch}
              onChange={(e) => {
                setClubSearch(e.target.value);
                setSelectedClubId('');
                setSelectedClubName('');
              }}
              autoComplete="off"
            />
          </div>

          {clubSearch.trim().length > 1 && (
            <div className="rounded-xl border bg-muted/30 overflow-hidden">
              {!searchedClubs || searchedClubs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground text-center">
                  No clubs found for &ldquo;{clubSearch}&rdquo;
                </p>
              ) : (
                <ul className="divide-y divide-border max-h-48 overflow-y-auto">
                  {searchedClubs.map((club) => (
                    <li key={club.uid}>
                      <button
                        onClick={() => handleSelect(club)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                          selectedClubId === club.uid && 'bg-primary/10'
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{club.clubName}</p>
                          {club.location && (
                            <p className="text-[11px] text-muted-foreground truncate">{club.location}</p>
                          )}
                        </div>
                        {selectedClubId === club.uid && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedClubId && selectedClubName && (
            <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              Selecting <span className="font-semibold text-foreground">{selectedClubName}</span> will
              send a join request to their admin team. You&rsquo;ll be notified when approved.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedClubId || isSubmitting}
            className="text-xs font-black uppercase tracking-widest"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Sending…
              </>
            ) : (
              'Send Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
