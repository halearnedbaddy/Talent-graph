'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import type { UserAccount } from '@/lib/types';

interface Props {
  mode: 'login' | 'signup';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleAuthButton({ mode }: Props) {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
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
        trackEvent('sign_up', { method: 'google' });
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
        trackEvent('login', { method: 'google' });

        const role = data?.role;
        router.push(role === 'coach' ? '/coach-dashboard' : role === 'scout' ? '/scout-dashboard' : '/');
      }
    } catch (err: unknown) {
      const code = (err as any)?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      toast({
        variant: 'destructive',
        title: 'Google sign-in failed',
        description: code === 'auth/account-exists-with-different-credential'
          ? 'An account already exists with this email using a different sign-in method.'
          : 'Could not sign in with Google. Please try again.',
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
      onClick={handleGoogle}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {loading
        ? 'Signing in…'
        : mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
    </Button>
  );
}
