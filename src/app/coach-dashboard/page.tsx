'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function CoachDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount, isLoading } = useDoc<UserAccount>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!user.emailVerified) {
        router.push('/verify-email');
        return;
      }
      if (userAccount?.role !== 'coach') {
        router.push(userAccount?.role === 'scout' ? '/scout-dashboard' : '/');
      }
    }
  }, [user, isUserLoading, isLoading, router, userAccount]);

  if (isUserLoading || isLoading || !user || userAccount?.role !== 'coach') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <div className="min-h-screen bg-background" />;
}