'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, getSdks } from '@/firebase';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

function buildServices(): FirebaseServices {
  const { firebaseApp } = initializeFirebase();
  return getSdks(firebaseApp);
}

const FIRESTORE_FATAL_PATTERNS = [
  'INTERNAL ASSERTION FAILED',
  'Unexpected state',
  'FIRESTORE_INTERNAL',
];

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [streamError, setStreamError] = useState(false);

  const reinitialize = useCallback(() => {
    setStreamError(false);
    setServices(null);
    // Allow React to flush the null state (unmounts all Firestore hooks)
    // before rebuilding services so all onSnapshot listeners are dropped cleanly.
    setTimeout(() => {
      try {
        setServices(buildServices());
      } catch (e) {
        console.error('[TG] Firebase reinitialization failed', e);
        window.location.reload();
      }
    }, 300);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setServices(buildServices());
  }, []);

  // Global handler for Firestore SDK internal assertion failures.
  // These are thrown as uncaught errors — not surfaced through onSnapshot callbacks —
  // and will leave all active listeners in a broken state if not recovered.
  useEffect(() => {
    if (!isMounted) return;

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = String(event.message || '');
      const isFatal = FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p));
      if (isFatal) {
        console.warn('[TG] Firestore stream assertion error detected. Triggering recovery.', msg);
        event.preventDefault(); // suppress browser error overlay in dev
        setStreamError(true);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || '');
      const isFatal = FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p));
      if (isFatal) {
        console.warn('[TG] Firestore promise rejection detected. Triggering recovery.', msg);
        event.preventDefault();
        setStreamError(true);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isMounted]);

  if (!isMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (streamError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4" suppressHydrationWarning>
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-bold text-lg">Connection interrupted</p>
          <p className="text-sm text-muted-foreground mt-1">The database connection was lost. Tap below to reconnect.</p>
        </div>
        <Button onClick={reinitialize} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reconnect
        </Button>
      </div>
    );
  }

  if (!services) {
    return (
      <div className="flex h-screen w-full items-center justify-center" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
