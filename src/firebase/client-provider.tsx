'use client';

import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, getSdks } from '@/firebase';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Loader2, RefreshCw, WifiOff, Wifi } from 'lucide-react';
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

/** Max automatic reconnect attempts before showing the manual screen. */
const MAX_AUTO_RETRIES = 3;
/** Base delay in ms — doubles on each retry (exponential back-off). */
const BASE_RETRY_DELAY_MS = 1500;

type ReconnectState = 'idle' | 'reconnecting' | 'reconnected' | 'failed';

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [reconnectState, setReconnectState] = useState<ReconnectState>('idle');
  const [retryCount, setRetryCount] = useState(0);

  // Refs so callbacks can reference latest values without stale closures.
  const recovering = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Forward-ref so doReinit can schedule itself recursively without circular deps.
  const triggerReconnectRef = useRef<() => void>(() => {});

  /** Null out services (drops every onSnapshot), then rebuild after 300ms. */
  const doReinit = useCallback(() => {
    setServices(null);
    setTimeout(() => {
      try {
        setServices(buildServices());
        // Success
        recovering.current = false;
        retryCountRef.current = 0;
        setRetryCount(0);
        setReconnectState('reconnected');
        if (reconnectedTimer.current) clearTimeout(reconnectedTimer.current);
        reconnectedTimer.current = setTimeout(() => setReconnectState('idle'), 2500);
      } catch (e) {
        console.error('[TG] Firebase reinitialization failed', e);
        recovering.current = false;
        retryCountRef.current += 1;
        setRetryCount(retryCountRef.current);

        if (retryCountRef.current >= MAX_AUTO_RETRIES) {
          setReconnectState('failed');
        } else {
          // Exponential back-off: 1.5 s → 3 s → 6 s
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => triggerReconnectRef.current(), delay);
        }
      }
    }, 300);
  }, []);

  /** Start an auto-reconnect cycle (no-op if one is already in progress). */
  const triggerReconnect = useCallback(() => {
    if (recovering.current) return;
    recovering.current = true;
    setReconnectState('reconnecting');
    doReinit();
  }, [doReinit]);

  // Keep forward-ref current so doReinit can call the latest triggerReconnect.
  useEffect(() => {
    triggerReconnectRef.current = triggerReconnect;
  }, [triggerReconnect]);

  /** Shown only after MAX_AUTO_RETRIES exhausted. */
  const manualReconnect = useCallback(() => {
    retryCountRef.current = 0;
    setRetryCount(0);
    triggerReconnect();
  }, [triggerReconnect]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    setServices(buildServices());
  }, []);

  // ── Detect Firebase stream assertion (redirected to console.warn by layout script) ──
  useEffect(() => {
    if (!isMounted) return;

    const originalWarn = console.warn.bind(console);
    console.warn = (...args: Parameters<typeof console.warn>) => {
      originalWarn(...args);
      const msg = args.map(a => String(a ?? '')).join(' ');
      if (FIRESTORE_FATAL_PATTERNS.some(p => msg.includes(p)) && !recovering.current) {
        // Debounce by 800 ms so a burst of identical errors triggers only one cycle.
        setTimeout(() => triggerReconnectRef.current(), 800);
      }
    };

    return () => { console.warn = originalWarn; };
  }, [isMounted]);

  // ── Auto-reconnect when the browser comes back online ────────────────────
  useEffect(() => {
    if (!isMounted) return;
    const handleOnline = () => {
      // Only kick off a reconnect if we're in a degraded/failed state.
      if (!recovering.current && reconnectState !== 'idle' && reconnectState !== 'reconnected') {
        retryCountRef.current = 0;
        setRetryCount(0);
        triggerReconnectRef.current();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isMounted, reconnectState]);

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (reconnectedTimer.current) clearTimeout(reconnectedTimer.current);
    };
  }, []);

  // ── Render states ─────────────────────────────────────────────────────────
  if (!isMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // After MAX_AUTO_RETRIES, escalate to a full-screen manual prompt.
  if (reconnectState === 'failed') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 bg-[#0A0E1A]" suppressHydrationWarning>
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-bold text-lg text-white">Connection lost</p>
          <p className="text-sm text-muted-foreground mt-1">
            Could not reconnect after {MAX_AUTO_RETRIES} attempts. Tap below to try again.
          </p>
        </div>
        <Button onClick={manualReconnect} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
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

      {/* ── Non-blocking floating reconnect banner ── */}
      {(reconnectState === 'reconnecting' || reconnectState === 'reconnected') && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-semibold text-white shadow-2xl transition-all duration-300"
          style={{
            background: '#1E293B',
            borderColor: reconnectState === 'reconnected' ? 'rgba(0,200,83,0.4)' : 'rgba(51,65,85,0.8)',
          }}
          suppressHydrationWarning
        >
          {reconnectState === 'reconnecting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#00C853]" />
              <span>Reconnecting…</span>
              {retryCount > 0 && (
                <span className="text-xs text-[#94A3B8]">
                  attempt {retryCount + 1}/{MAX_AUTO_RETRIES}
                </span>
              )}
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-[#00C853]" />
              <span>Reconnected</span>
            </>
          )}
        </div>
      )}
    </FirebaseProvider>
  );
}
