'use client';

import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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

// These substrings appear in the Firebase Logger message for the Firestore
// internal stream assertion failure. Firebase logs via console.error (through
// its Logger class), NOT as an uncaught exception, so window.addEventListener
// ('error') will NOT catch it. We must override console.error instead.
const FIRESTORE_FATAL_PATTERNS = [
  'INTERNAL ASSERTION FAILED',
  'FIRESTORE_INTERNAL',
  'ID: ca9',
];

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  // Ref guards: prevent multiple simultaneous recovery attempts.
  const recovering = useRef(false);

  const reinitialize = useCallback(() => {
    recovering.current = false;
    setStreamError(false);
    setServices(null);
    // Allow React to flush the null state (drops every onSnapshot listener cleanly)
    // before rebuilding services, so we start from a clean Firestore connection.
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

  // Override console.error to intercept Firebase Logger assertion messages.
  // Firebase SDK calls Logger.error → Logger.defaultLogHandler → console.error
  // for internal assertion failures. These are NOT uncaught exceptions, so the
  // window 'error' event never fires for them.
  useEffect(() => {
    if (!isMounted) return;

    const original = console.error.bind(console);

    console.error = (...args: Parameters<typeof console.error>) => {
      // Check BEFORE calling original — calling original(...args) would itself
      // be attributed to this file by Next.js devtools and increment the error
      // counter again, turning 13 issues into 19.
      const msg = args.map(a => String(a ?? '')).join(' ');
      const isFatal = FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p));

      if (isFatal) {
        // Redirect to warn: visible in console but not counted as a devtools
        // "Console Error". The recovery mechanism is the real response.
        // eslint-disable-next-line no-console
        console.warn('[TG] Firestore stream assertion (suppressed from error log):', msg.slice(0, 200));
        if (!recovering.current) {
          recovering.current = true;
          // Small delay: let Firebase finish its own internal error handling
          // (it will attempt stream restart) before we drop and rebuild services.
          setTimeout(() => setStreamError(true), 800);
        }
      } else {
        // All other errors pass through normally.
        original(...args);
      }
    };

    // Firebase SDK also *throws* the assertion error after calling console.error.
    // The throw fires window 'error'. Next.js devtools registers a bubble-phase
    // listener for this — registering ours in the CAPTURE phase means we run first.
    // Calling stopImmediatePropagation() then prevents Next.js's listener from
    // seeing it at all, eliminating the "Runtime Error" badge.
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = String(event.message || '');
      if (FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p))) {
        // Block ALL subsequent listeners (including Next.js devtools).
        event.stopImmediatePropagation();
        event.preventDefault();
        if (!recovering.current) {
          recovering.current = true;
          setTimeout(() => setStreamError(true), 800);
        }
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || '');
      if (FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p))) {
        event.preventDefault();
        if (!recovering.current) {
          recovering.current = true;
          setTimeout(() => setStreamError(true), 800);
        }
      }
    };

    // capture: true → runs before Next.js's bubble-phase error listeners
    window.addEventListener('error', handleGlobalError, { capture: true });
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.error = original;
      window.removeEventListener('error', handleGlobalError, { capture: true });
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
          <p className="text-sm text-muted-foreground mt-1">
            The database stream was lost. Tap below to reconnect.
          </p>
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
