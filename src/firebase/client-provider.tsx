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

  // The beforeInteractive script in layout.tsx handles suppressing the Firebase
  // assertion error from the Next.js dev overlay (console.error override +
  // capture-phase window error handler). Here we only need to detect the error
  // and trigger the reconnection banner — we do this by watching console.warn
  // for the pattern our early script redirects fatal errors to.
  useEffect(() => {
    if (!isMounted) return;

    const originalWarn = console.warn.bind(console);
    console.warn = (...args: Parameters<typeof console.warn>) => {
      originalWarn(...args);
      const msg = args.map(a => String(a ?? '')).join(' ');
      if (
        FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p)) &&
        !recovering.current
      ) {
        recovering.current = true;
        setTimeout(() => setStreamError(true), 800);
      }
    };

    return () => {
      console.warn = originalWarn;
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
