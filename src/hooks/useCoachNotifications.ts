'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { AthleteProfile, ClubMatch } from '@/lib/types';

export interface CoachNotification {
  id: string;
  type: 'verification' | 'match' | 'message';
  title: string;
  body: string;
  href: string;
  createdAt: string;
  isRead: boolean;
}

interface RawMessage {
  id: string;
  recipientId: string;
  senderName: string;
  subject?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'coach_notifications_read';

function getReadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadSet(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function useCoachNotifications(clubId: string | null, userId: string | null) {
  const firestore = useFirestore();
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadSet());

  useEffect(() => {
    setReadIds(getReadSet());
  }, []);

  const pendingAthletesQuery = useMemoFirebase(
    () =>
      firestore && clubId
        ? query(
            collection(firestore, 'athletes'),
            where('affiliatedClubId', '==', clubId),
            where('isVerified', '==', false)
          )
        : null,
    [firestore, clubId]
  );

  const upcomingMatchesQuery = useMemoFirebase(
    () => {
      if (!firestore || !clubId) return null;
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const nowIso = now.toISOString();
      const in48hIso = in48h.toISOString();
      return query(
        collection(firestore, 'matches'),
        where('clubId', '==', clubId),
        where('date', '>=', nowIso),
        where('date', '<=', in48hIso)
      );
    },
    [firestore, clubId]
  );

  const unreadMessagesQuery = useMemoFirebase(
    () =>
      firestore && userId
        ? query(
            collection(firestore, 'messages'),
            where('recipientId', '==', userId),
            where('isRead', '==', false)
          )
        : null,
    [firestore, userId]
  );

  const { data: pendingAthletes } = useCollection<AthleteProfile>(pendingAthletesQuery);
  const { data: upcomingMatches } = useCollection<ClubMatch>(upcomingMatchesQuery);
  const { data: unreadMessages } = useCollection<RawMessage>(unreadMessagesQuery);

  const notifications = useMemo<CoachNotification[]>(() => {
    const items: CoachNotification[] = [];

    if (pendingAthletes && pendingAthletes.length > 0) {
      if (pendingAthletes.length === 1) {
        const a = pendingAthletes[0];
        const id = `verify-${a.uid}`;
        items.push({
          id,
          type: 'verification',
          title: 'Verification Request',
          body: `${a.firstName} ${a.lastName} is waiting for club verification.`,
          href: '/coach-dashboard/verify',
          createdAt: a.updatedAt || a.createdAt,
          isRead: readIds.has(id),
        });
      } else {
        const id = `verify-bulk-${clubId}`;
        items.push({
          id,
          type: 'verification',
          title: 'Verification Requests',
          body: `${pendingAthletes.length} athletes are waiting for club verification.`,
          href: '/coach-dashboard/verify',
          createdAt: new Date().toISOString(),
          isRead: readIds.has(id),
        });
      }
    }

    if (upcomingMatches) {
      for (const match of upcomingMatches) {
        const id = `match-${match.id}`;
        const matchDate = new Date(match.date);
        const diffH = Math.round((matchDate.getTime() - Date.now()) / 3_600_000);
        const timeLabel = diffH <= 1 ? 'in less than 1 hour' : diffH < 24 ? `in ${diffH}h` : 'tomorrow';
        items.push({
          id,
          type: 'match',
          title: 'Upcoming Match',
          body: `${match.competition} vs ${match.opponent} — ${timeLabel}.`,
          href: '/coach-dashboard/match-entry',
          createdAt: match.date,
          isRead: readIds.has(id),
        });
      }
    }

    if (unreadMessages) {
      for (const msg of unreadMessages) {
        const id = `msg-${msg.id}`;
        items.push({
          id,
          type: 'message',
          title: `Message from ${msg.senderName}`,
          body: msg.subject || msg.content.slice(0, 60) + (msg.content.length > 60 ? '…' : ''),
          href: '/coach-dashboard/communications',
          createdAt: msg.createdAt,
          isRead: readIds.has(id),
        });
      }
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [pendingAthletes, upcomingMatches, unreadMessages, readIds, clubId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadSet(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveReadSet(next);
      return next;
    });
  }, [notifications]);

  return { notifications, unreadCount, markRead, markAllRead };
}
