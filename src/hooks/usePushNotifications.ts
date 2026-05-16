'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function endpointToId(endpoint: string) {
  return btoa(endpoint).slice(-40).replace(/[^a-zA-Z0-9]/g, '_');
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications(clubId: string | undefined, userId: string | undefined) {
  const firestore = useFirestore();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  useEffect(() => {
    if (!clubId || !userId || typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => setIsSubscribed(!!sub));
    });
  }, [clubId, userId]);

  const subscribe = useCallback(async () => {
    if (!clubId || !userId || !firestore) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return;

      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const subJson = sub.toJSON();
      const subId = endpointToId(subJson.endpoint!);

      await setDoc(
        doc(firestore, 'clubs', clubId, 'push_subscriptions', subId),
        {
          subscription: subJson,
          userId,
          clubId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setIsSubscribed(true);
    } catch (err) {
      console.error('[push] subscribe error', err);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, userId, firestore]);

  const unsubscribe = useCallback(async () => {
    if (!clubId || !firestore) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const subId = endpointToId(sub.endpoint);
        await deleteDoc(doc(firestore, 'clubs', clubId, 'push_subscriptions', subId));
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] unsubscribe error', err);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, firestore]);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}

export async function sendClubNotification(params: {
  clubId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  excludeUserId?: string;
  firestore: ReturnType<typeof useFirestore>;
}) {
  const { clubId, title, body, url, tag, excludeUserId, firestore } = params;
  if (!firestore) return;

  try {
    const snap = await getDocs(collection(firestore, 'clubs', clubId, 'push_subscriptions'));
    if (snap.empty) return;

    const subscriptions = snap.docs
      .filter((d) => !excludeUserId || d.data().userId !== excludeUserId)
      .map((d) => d.data().subscription);

    if (!subscriptions.length) return;

    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions, title, body, url, tag }),
    });
  } catch (err) {
    console.error('[push] sendClubNotification error', err);
  }
}
