'use client';

import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, doc, writeBatch } from 'firebase/firestore';
import type { ProfileView, AthleteNotification } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  scout: 'Scout',
  club: 'Club',
  athlete: 'Athlete',
  admin: 'Admin',
};

interface ProfileViewsCardProps {
  athleteId: string;
}

export function ProfileViewsCard({ athleteId }: ProfileViewsCardProps) {
  const firestore = useFirestore();

  const viewsQuery = useMemoFirebase(
    () =>
      firestore && athleteId
        ? query(
            collection(firestore, 'profile_views', athleteId, 'viewers'),
            orderBy('viewedAt', 'desc'),
            limit(10)
          )
        : null,
    [firestore, athleteId]
  );
  const { data: views, isLoading: viewsLoading } = useCollection<ProfileView>(viewsQuery);

  const notificationsQuery = useMemoFirebase(
    () =>
      firestore && athleteId
        ? query(
            collection(firestore, 'notifications', athleteId, 'items'),
            orderBy('createdAt', 'desc'),
            limit(20)
          )
        : null,
    [firestore, athleteId]
  );
  const { data: notifications, isLoading: notifsLoading } = useCollection<AthleteNotification>(notificationsQuery);

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const handleMarkAllRead = async () => {
    if (!firestore || !notifications?.length) return;
    const batch = writeBatch(firestore);
    notifications.filter(n => !n.isRead).forEach(n => {
      const ref = doc(firestore, 'notifications', athleteId, 'items', n.id);
      batch.update(ref, { isRead: true });
    });
    await batch.commit();
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-lg bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Profile Views
            </CardTitle>
            {views && views.length > 0 && (
              <Badge variant="secondary" className="text-xs font-bold">
                {views.length} {views.length === 1 ? 'view' : 'views'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {viewsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))
          ) : views && views.length > 0 ? (
            views.map((view, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9 border">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {getInitials(view.viewerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{view.viewerName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[view.viewerRole] || view.viewerRole} ·{' '}
                    {formatDistanceToNow(new Date(view.viewedAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] uppercase font-black shrink-0">
                  {ROLE_LABELS[view.viewerRole] || view.viewerRole}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No profile views yet</p>
              <p className="text-[10px] mt-1">Share your profile to get discovered</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] font-black h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={handleMarkAllRead}>
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : notifications && notifications.length > 0 ? (
            notifications.slice(0, 8).map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  !notif.isRead ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/30'
                }`}
              >
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-primary' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{notif.actorName}</p>
                  <p className="text-[11px] text-muted-foreground">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No notifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
