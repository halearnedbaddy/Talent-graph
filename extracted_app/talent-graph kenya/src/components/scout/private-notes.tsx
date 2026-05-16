'use client';

import { useState } from 'react';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import type { ScoutAthleteData } from '@/lib/types';

interface PrivateNotesProps {
  athleteId: string;
  scoutId: string;
  notesData: ScoutAthleteData | null;
}

export function PrivateNotes({ athleteId, scoutId, notesData }: PrivateNotesProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [notes, setNotes] = useState(notesData?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNotes = () => {
    if (!firestore) return;
    setIsSaving(true);
    
    const privateNotesDocRef = doc(firestore, 'scoutData', scoutId, 'privateNotes', athleteId);
    
    // Use set with merge to create the document if it doesn't exist, or update if it does.
    setDocumentNonBlocking(privateNotesDocRef, { notes: notes }, { merge: true });

    toast({
      title: 'Notes Saved',
      description: 'Your private notes for this athlete have been updated.',
    });
    
    // The non-blocking update is fast, so we can reset the state.
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Private Notes
        </CardTitle>
        <CardDescription>
          Your personal notes on this athlete. Only you can see this.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Strengths, weaknesses, game observations..."
          className="h-40"
        />
        <Button onClick={handleSaveNotes} disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Notes
        </Button>
      </CardContent>
    </Card>
  );
}
