'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export function initializeFirebase(): { firebaseApp: FirebaseApp } {
  let firebaseApp: FirebaseApp;
  if (!getApps().length) {
    // Only attempt no-args init when Firebase App Hosting defaults are present.
    // On Replit (and other non-Firebase-App-Hosting environments) the global is
    // never injected, so we fall straight through to the explicit config object.
    const hasAppHostingDefaults =
      typeof globalThis !== 'undefined' &&
      !!(globalThis as Record<string, unknown>)['__FIREBASE_DEFAULTS__'];

    if (hasAppHostingDefaults) {
      try {
        firebaseApp = initializeApp();
      } catch (e) {
        console.warn('Firebase App Hosting init failed. Falling back to config object.', e);
        firebaseApp = initializeApp(firebaseConfig);
      }
    } else {
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  return { firebaseApp };
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
