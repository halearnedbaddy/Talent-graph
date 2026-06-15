'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { OAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import type { UserAccount } from '@/lib/types';

interface Props {
  mode: 'login' | 'signup';
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.23.74 3 .8 1.13-.19 2.21-.9 3.41-.77 1.44.17 2.52.74 3.23 1.87-3.03 1.8-2.29 5.77.28 6.9-.57 1.52-1.32 3.02-1.92 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function AppleAuthButton({ mode }: Props) {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleApple = async () => {
    setLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const info = getAdditionalUserInfo(result);
      const isNew = info?.isNewUser ?? false;

      if (isNew) {
        const nameParts = (user.displayName ?? '').split(' ');
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts.slice(1).join(' ') ?? '';
        const userDocRef = doc(firestore, 'users', user.uid);
        setDocumentNonBlocking(userDocRef, {
          id: user.uid,
          email: user.email,
          firstName,
          lastName,
          photoUrl: user.photoURL ?? null,
          creationTimestamp: new Date().toISOString(),
          isEmailVerified: true,
          subscribeToEmails: false,
          loginHistory: [new Date().toISOString()],
        }, { merge: true });
        trackEvent('sign_up', { method: 'apple' });
        router.push('/');
      } else {
        const userDocRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        const data = snap.data() as UserAccount | undefined;

        const now = new Date().toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
        const history = (data?.loginHistory ?? []).filter((ts: string) => ts >= thirtyDaysAgo);
        history.push(now);
        setDocumentNonBlocking(userDocRef, { loginHistory: history, isEmailVerified: true }, { merge: true });
        trackEvent('login', { method: 'apple' });

        const role = data?.role;
        router.push(role === 'coach' ? '/coach-dashboard' : role === 'scout' ? '/scout-dashboard' : '/');
      }
    } catch (err: unknown) {
      const code = (err as any)?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      toast({
        variant: 'destructive',
        title: 'Apple sign-in failed',
        description: code === 'auth/account-exists-with-different-credential'
          ? 'An account already exists with this email using a different sign-in method.'
          : 'Could not sign in with Apple. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full rounded-2xl border-border/60 bg-background font-semibold text-sm gap-3 hover:bg-muted/60 transition-colors"
      onClick={handleApple}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
      {loading
        ? 'Signing in…'
        : mode === 'signup' ? 'Sign up with Apple' : 'Sign in with Apple'}
    </Button>
  );
}
