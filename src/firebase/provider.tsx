'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getRedirectResult, getAdditionalUserInfo } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { trackEvent } from '@/lib/analytics';
import type { UserAccount } from '@/lib/types';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const timeout = setTimeout(() => {
      setUserAuthState(prev =>
        prev.isUserLoading ? { user: null, isUserLoading: false, userError: null } : prev
      );
    }, 3000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        clearTimeout(timeout);
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        clearTimeout(timeout);
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );

    // Handle OAuth redirect result (Google / Apple sign-in)
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return;
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
          const provider = info?.providerId ?? 'oauth';
          trackEvent('sign_up', { method: provider });
          window.location.href = '/onboarding';
        } else {
          const userDocRef = doc(firestore, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          const data = snap.data() as UserAccount | undefined;

          const now = new Date().toISOString();
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
          const history = (data?.loginHistory ?? []).filter((ts: string) => ts >= thirtyDaysAgo);
          history.push(now);
          setDocumentNonBlocking(userDocRef, { loginHistory: history, isEmailVerified: true }, { merge: true });

          const provider = info?.providerId ?? 'oauth';
          trackEvent('login', { method: provider });

          const role = data?.role;
          window.location.href = role === 'coach' ? '/coach-dashboard' : role === 'scout' ? '/scout-dashboard' : '/';
        }
      })
      .catch((err) => {
        const code = err?.code ?? '';
        if (code !== 'auth/redirect-cancelled-by-user') {
          console.error("FirebaseProvider: getRedirectResult error:", err);
        }
      });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
