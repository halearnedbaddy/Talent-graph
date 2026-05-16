'use client';

import { useState } from 'react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import type { AthleteProfile } from '@/lib/types';

interface VerifyMetricsButtonProps {
  athlete: AthleteProfile;
  scoutId: string;
}

export function VerifyMetricsButton({ athlete, scoutId }: VerifyMetricsButtonProps) {
  const firestore = useFirestore();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyProfile = () => {
    if (!firestore) return;
    setIsVerifying(true);

    const athleteRef = doc(firestore, 'athletes', athlete.uid);
    const now = new Date().toISOString();

    // Verification now updates the global profile status
    updateDocumentNonBlocking(athleteRef, {
      isVerified: true,
      updatedAt: now,
    });

    setIsVerifying(false);
  };

  if (athlete.isVerified) return (
    <Button variant="ghost" disabled className="w-full text-green-500 font-bold opacity-100">
        <ShieldCheck className="w-4 h-4 mr-2" />
        Profile Verified
    </Button>
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" className="w-full bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 hover:text-green-400 font-bold">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Verify This Profile
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-yellow-500 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <AlertDialogTitle>Professional Endorsement</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="text-sm">
                You are about to verify the professional identity and performance data for <strong>{athlete.firstName} {athlete.lastName}</strong>.
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border text-sm italic text-foreground">
                "By verifying this profile, you are confirming that the reported metrics and career data are accurate based on your professional observation or official records."
              </div>
              <div className="text-sm">
                Once verified, the profile will carry a "SCOUT VERIFIED" badge visible to all institutional scouts and clubs.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleVerifyProfile} className="bg-green-600 hover:bg-green-700 text-white">
            {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            I Confirm and Verify
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}