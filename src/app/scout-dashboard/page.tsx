'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ScoutDashboardClient } from '@/components/scout/dashboard-client';
import type { ScoutProfile, UserAccount } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { VerificationBanner } from '@/components/verification/verification-banner';

export default function ScoutDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const scoutDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'scouts', user.uid) : null), [firestore, user?.uid]);
  const { data: scoutProfile, isLoading: isScoutProfileLoading } = useDoc<ScoutProfile>(scoutDocRef);

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount, isLoading: isAccountLoading } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!user.emailVerified) {
        router.push('/verify-email');
        return;
      }
    }
    if (!isUserLoading && !isAccountLoading && userAccount) {
      if (userAccount.role === 'coach') {
        router.push('/coach-dashboard');
      } else if (userAccount.role === 'athlete') {
        router.push('/');
      } else if (userAccount.role === 'club') {
        router.push('/club-dashboard/athletes');
      }
    }
  }, [user, isUserLoading, userAccount, isAccountLoading, router]);

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