'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ScoutDashboardClient } from '@/components/scout/dashboard-client';
import type { ScoutProfile } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { VerificationBanner } from '@/components/verification/verification-banner';

export default function ScoutDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const scoutDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'scouts', user.uid) : null), [firestore, user?.uid]);
  const { data: scoutProfile, isLoading: isScoutProfileLoading } = useDoc<ScoutProfile>(scoutDocRef);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.emailVerified) {
        router.push('/verify-email');
      }
    }
  }, [user, isUserLoading, router]);

  const isLoading = isUserLoading || isScoutProfileLoading;

  if (isLoading || !user || !user.emailVerified) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!scoutProfile) {
     return (
      <div className="flex h-screen flex-col items-center justify-center text-center">
        <p className="mb-4 text-lg">Scout profile not found. Redirecting to onboarding...</p>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 pt-4 -mb-4">
        <VerificationBanner uid={scoutProfile.uid} type="scout" isVerified={scoutProfile.isVerified} />
      </div>
      <ScoutDashboardClient scoutProfile={scoutProfile} />
    </>
  );
}