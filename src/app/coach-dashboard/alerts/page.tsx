'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection as col, query as q, where as wh } from 'firebase/firestore';
import { Bell, Megaphone, CheckCheck, Loader2, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ClubMember } from '@/lib/types';

interface AlertItem {
  id: string;
  actorName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  conversationId?: string;
}

export default function CoachAlertsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? q(col(firestore, 'club_members'), wh('userId', '==', user.uid), wh('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubName = memberships?.[0]?.clubName ?? '';

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    setLoading(true);

    getDocs(
      query(
        collection(firestore, 'notifications', user.uid, 'items'),
        where('type', '==', 'club_announcement'),
        orderBy('createdAt', 'desc')
      )
    )
      .then(snap => {
        setAlerts(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AlertItem, 'id'>) })));
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [firestore, user?.uid]);

  const markAllRead = async () => {
    if (!firestore || !user?.uid || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.all(
        alerts
          .filter(a => !a.isRead)
          .map(a =>
            updateDoc(doc(firestore, 'notifications', user.uid, 'items', a.id), { isRead: true })
          )
      );
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const markOne = async (id: string) => {
    if (!firestore || !user?.uid) return;
    await updateDoc(doc(firestore, 'notifications', user.uid, 'items', id), { isRead: true }).catch(() => {});
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const unreadCount = alerts.filter(a => !a.isRead).length;

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD}d ago`;
      return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#00C853]/15 flex items-center justify-center">
            <Bell className="h-5 w-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-base font-black text-white uppercase tracking-tight">Club Alerts</h1>
            <p className="text-[11px] text-[#94A3B8] font-medium">
              Announcements from {clubName || 'your club'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-[#00C853]/20 text-[#00C853] border-none font-black text-[10px] h-5 px-2">
              {unreadCount} new
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={markAllRead}
            disabled={markingAll}
            className="text-[#94A3B8] hover:text-white font-bold text-xs gap-1.5 h-8"
          >
            {markingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CheckCheck className="h-3.5 w-3.5" />
            }
            Mark all read
          </Button>
        )}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#00C853]" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-[#1C2333] flex items-center justify-center">
            <Megaphone className="h-7 w-7 text-[#4B5563]" />
          </div>
          <p className="text-[#94A3B8] font-bold text-sm">No announcements yet</p>
          <p className="text-[#4B5563] text-xs text-center max-w-xs">
            When your club admin sends a broadcast, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              onClick={() => !alert.isRead && markOne(alert.id)}
              className={cn(
                'relative rounded-xl border p-4 transition-all cursor-default',
                alert.isRead
                  ? 'bg-[#0F1623] border-[#1E293B]'
                  : 'bg-[#111827] border-[#00C853]/30 cursor-pointer hover:border-[#00C853]/50'
              )}
            >
              {/* Unread dot */}
              {!alert.isRead && (
                <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-[#00C853]" />
              )}

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#1C2333] flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="h-4 w-4 text-[#94A3B8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn(
                      'text-[11px] font-black uppercase tracking-widest',
                      alert.isRead ? 'text-[#4B5563]' : 'text-[#00C853]'
                    )}>
                      {alert.actorName || 'Club Admin'}
                    </p>
                    <span className="text-[10px] text-[#4B5563] font-medium ml-auto shrink-0">
                      {formatTime(alert.createdAt)}
                    </span>
                  </div>
                  <p className={cn(
                    'text-sm leading-relaxed',
                    alert.isRead ? 'text-[#64748B]' : 'text-[#CBD5E1]'
                  )}>
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Read-only note */}
      {alerts.length > 0 && (
        <p className="text-center text-[10px] text-[#4B5563] font-medium pb-2">
          Alerts are read-only — replies available in v2
        </p>
      )}
    </div>
  );
}
