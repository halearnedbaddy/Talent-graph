'use client';

import { useState, useMemo } from 'react';
import type { AthleteProfile, ScoutProfile, SavedAthlete } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ScoutAthleteCard } from './scout-athlete-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bookmark, FileText, Trash2, Loader2, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  scoutProfile: ScoutProfile;
  compareList: AthleteProfile[];
  onCompare: (a: AthleteProfile) => void;
  savedIds: Set<string>;
  onUnsave: (athleteId: string) => void;
  onSendMessage: (a: AthleteProfile) => void;
}

export function SavedAthletesTab({ scoutProfile, compareList, onCompare, savedIds, onUnsave, onSendMessage }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [notesAthlete, setNotesAthlete] = useState<{ id: string; name: string; notes: string } | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const allAthletesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'athletes') : null), [firestore]);
  const { data: allAthletes } = useCollection<AthleteProfile>(allAthletesQuery);

  const savedAthletesQuery = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedAthletes') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedRecords, isLoading } = useCollection<SavedAthlete>(savedAthletesQuery);

  const notesQuery = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'privateNotes') : null
  ), [firestore, scoutProfile.uid]);
  const { data: privateNotes } = useCollection<{ id: string; notes?: string }>(notesQuery);
  const notesMap = useMemo(() => {
    const map: Record<string, string> = {};
    privateNotes?.forEach(n => { if (n.id && n.notes) map[n.id] = n.notes; });
    return map;
  }, [privateNotes]);

  const savedAthletes = useMemo(() => {
    if (!allAthletes || !savedRecords) return [];
    const savedSet = new Set(savedRecords.map(r => r.athleteId));
    return allAthletes.filter(a => savedSet.has(a.uid));
  }, [allAthletes, savedRecords]);

  const compareIds = new Set(compareList.map(a => a.uid));

  function openNotes(a: AthleteProfile) {
    setNotesAthlete({ id: a.uid, name: `${a.firstName} ${a.lastName}`, notes: notesMap[a.uid] || '' });
    setNotesDraft(notesMap[a.uid] || '');
  }

  async function saveNotes() {
    if (!firestore || !notesAthlete) return;
    setSavingNotes(true);
    try {
      await setDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'privateNotes', notesAthlete.id), { id: notesAthlete.id, notes: notesDraft }, { merge: true });
      toast({ title: 'Notes saved' });
      setNotesAthlete(null);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save notes.' });
    } finally { setSavingNotes(false); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Saved Athletes</h2>
          <Badge variant="secondary">{savedAthletes.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">Your private shortlist</p>
      </div>

      {savedAthletes.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <Bookmark className="w-10 h-10 text-muted-foreground/20" />
            <p className="font-medium text-muted-foreground">No saved athletes yet</p>
            <p className="text-sm text-muted-foreground">Tap the bookmark icon on any athlete card to save them here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {savedAthletes.map(a => (
            <div key={a.uid} className="space-y-1">
              <ScoutAthleteCard
                athlete={a}
                isInCompare={compareIds.has(a.uid)}
                compareDisabled={compareList.length >= 5}
                isSaved={true}
                onCompare={() => onCompare(a)}
                onSave={() => onUnsave(a.uid)}
                onSendMessage={() => onSendMessage(a)}
              />
              <div className="flex gap-1 px-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-xs h-7 text-muted-foreground"
                  onClick={() => openNotes(a)}
                >
                  <StickyNote className="w-3 h-3 mr-1.5" />
                  {notesMap[a.uid] ? 'Edit notes' : 'Add notes'}
                </Button>
              </div>
              {notesMap[a.uid] && (
                <p className="text-xs text-muted-foreground italic px-1 truncate">
                  &ldquo;{notesMap[a.uid]}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!notesAthlete} onOpenChange={o => { if (!o) setNotesAthlete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes — {notesAthlete?.name}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder="Strengths, weaknesses, game observations, trial readiness..."
            className="h-32 text-sm"
            maxLength={500}
          />
          <p className="text-xs text-right text-muted-foreground">{notesDraft.length}/500 · Private, only you can see this</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesAthlete(null)}>Cancel</Button>
            <Button onClick={saveNotes} disabled={savingNotes}>
              {savingNotes && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
