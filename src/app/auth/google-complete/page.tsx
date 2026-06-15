'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { trackEvent } from '@/lib/analytics';
import type { UserAccount } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function GoogleCompletePage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const googleToken = searchParams.get('googleToken');
    const uid = searchParams.get('uid');
    const email = searchParams.get('email') ?? '';
    const name = searchParams.get('name') ?? '';
    const photo = searchParams.get('photo') ?? '';
    const isNew = searchParams.get('isNew') === '1';
    const error = searchParams.get('error');

    if (error) {
      const msg =
        error === 'google_cancelled' ? 'Sign-in was cancelled.' :
        error === 'google_failed' ? 'Could not connect to Google. Please try again.' :
        error === 'firebase_failed' ? 'Could not authenticate with Firebase. Please try again.' :
        'Something went wrong. Please try again.';
      toast({ variant: 'destructive', title: 'Google sign-in failed', description: msg });
      router.replace('/login');
      return;
    }

    if (!googleToken || !uid) {
      toast({ variant: 'destructive', title: 'Google sign-in failed', description: 'Invalid response. Please try again.' });
      router.replace('/login');
      return;
    }

    async function finish() {
      try {
        // Use the Google ID token to create a Firebase session — no domain authorization needed
        const credential = GoogleAuthProvider.credential(googleToken!);
        await signInWithCredential(auth, credential);

        if (isNew) {
          const nameParts = name.split(' ');
          const firstName = nameParts[0] ?? '';
          const lastName = nameParts.slice(1).join(' ') ?? '';
          const userDocRef = doc(firestore, 'users', uid!);
          setDocumentNonBlocking(userDocRef, {
            id: uid,
            email,
            firstName,
            lastName,
            photoUrl: photo || null,
            creationTimestamp: new Date().toISOString(),
            isEmailVerified: true,
            subscribeToEmails: false,
            loginHistory: [new Date().toISOString()],
          }, { merge: true });
          trackEvent('sign_up', { method: 'google' });
          router.replace('/onboarding');
        } else {
          const userDocRef = doc(firestore, 'users', uid!);
          const snap = await getDoc(userDocRef);
          const data = snap.data() as UserAccount | undefined;

          const now = new Date().toISOString();
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
          const history = (data?.loginHistory ?? []).filter((ts: string) => ts >= thirtyDaysAgo);
          history.push(now);
          setDocumentNonBlocking(userDocRef, { loginHistory: history, isEmailVerified: true }, { merge: true });
          trackEvent('login', { method: 'google' });

          const role = data?.role;
          router.replace(role === 'coach' ? '/coach-dashboard' : role === 'scout' ? '/scout-dashboard' : '/');
        }
      } catch (err: any) {
        console.error('[google-complete] error:', err);
        const description = err?.code === 'auth/invalid-credential'
          ? 'Google token has expired. Please try signing in again.'
          : err?.message || 'Could not complete sign-in. Please try again.';
        toast({ variant: 'destructive', title: 'Google sign-in failed', description });
        router.replace('/login');
      }
    }

    finish();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
