'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, deleteDoc, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, MessageSquare, ShieldCheck, Zap, Trash2, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ClubMember, NotificationHistoryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PushNotificationToggle } from '@/components/club/push-notification-prompt';

const TAG_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  'squad-chat': {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    label: 'Squad Chat',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  'live-match-goal': {
    icon: <span className="text-xs">⚽</span>,
    label: 'Goal',
    color: 'bg-green-500/10 text-green-600 border-green-200',
  },
  'athlete-verified': {
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    label: 'Verified',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
  },
};

function NotifCard({
  item,
  onDelete,
}: {
  item: NotificationHistoryItem;
  onDelete: (id: string) => void;
}) {
  const meta = TAG_META[item.tag] ?? {
    icon: <Bell className="w-3.5 h-3.5" />,
    label: 'Alert',
    color: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Card className="border-none shadow-md bg-background overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                  {item.body}
                </p>
              </div>
              <button
                onClick={() => onDelete(item.id)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Badge
                variant="outline"
                className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0 h-5 gap-1', meta.color)}
              >
                {meta.icon}
                {meta.label}
              </Badge>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">
                {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}
              </span>
              {item.recipientCount > 0 && (
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">
                  · {item.recipientCount} recipient{item.recipientCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const clubMemberQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
        : null,
    [firestore, user]
  );
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  const historyQuery = useMemoFirebase(
    () =>
      firestore && clubId
        ? query(
            collection(firestore, 'clubs', clubId, 'notification_history'),
            orderBy('sentAt', 'desc'),
            limit(50)
          )
        : null,
    [firestore, clubId]
  );
  const { data: history, isLoading } = useCollection<NotificationHistoryItem>(historyQuery);

  const handleDelete = async (id: string) => {
    if (!firestore || !clubId) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(firestore, 'clubs', clubId, 'notification_history', id));
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete notification' });
    } finally {
      setDeleting(null);
    }
  };

  const grouped = history?.reduce<Record<string, NotificationHistoryItem[]>>((acc, item) => {
    const tag = item.tag in TAG_META ? item.tag : 'other';
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(item);
    return acc;
  }, {});

  const goalCount = grouped?.['live-match-goal']?.length ?? 0;
  const chatCount = grouped?.['squad-chat']?.length ?? 0;
  const verifyCount = grouped?.['athlete-verified']?.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Alerts</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Push notification history
          </p>
        </div>
        <PushNotificationToggle clubId={clubId} userId={user?.uid} />
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Goals', count: goalCount, color: 'bg-green-500/10 text-green-600 border-green-200', icon: '⚽' },
          { label: 'Chat', count: chatCount, color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: <MessageSquare className="w-3 h-3" /> },
          { label: 'Verified', count: verifyCount, color: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: <ShieldCheck className="w-3 h-3" /> },
        ].map(({ label, count, color, icon }) => (
          <Badge
            key={label}
            variant="outline"
            className={cn('gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 h-auto', color)}
          >
            {typeof icon === 'string' ? <span>{icon}</span> : icon}
            {count} {label}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : !history || history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <BellOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest">No alerts yet</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mt-1">
              Notifications will appear here once sent
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <NotifCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
