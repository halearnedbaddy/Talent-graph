'use client';

import { useState } from 'react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { ProfileView, AthleteNotification } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Bell, CheckCheck, TrendingUp, Trash2, X, CheckSquare, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  scout: 'Scout', club: 'Club', athlete: 'Athlete', admin: 'Admin',
};

interface ProfileViewsCardProps {
  athleteId: string;
}

export function ProfileViewsCard({ athleteId }: ProfileViewsCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const viewsQuery = useMemoFirebase(
    () =>
      firestore && athleteId
        ? query(collection(firestore, 'profile_views', athleteId, 'viewers'), orderBy('viewedAt', 'desc'), limit(10))
        : null,
    [firestore, athleteId]
  );
  const { data: views, isLoading: viewsLoading } = useCollection<ProfileView>(viewsQuery);

  const notificationsQuery = useMemoFirebase(
    () =>
      firestore && athleteId
        ? query(collection(firestore, 'notifications', athleteId, 'items'), orderBy('createdAt', 'desc'), limit(50))
        : null,
    [firestore, athleteId]
  );
  const { data: notifications, isLoading: notifsLoading } = useCollection<AthleteNotification>(notificationsQuery);

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  thisWeekStart.setHours(0, 0, 0, 0);
  const weeklyViews = views?.filter(v => new Date(v.viewedAt) >= thisWeekStart) ?? [];
  const scoutViews = weeklyViews.filter(v => v.viewerRole === 'scout' || v.viewerRole === 'club');

  const handleMarkAllRead = async () => {
    if (!firestore || !notifications?.length) return;
    const batch = writeBatch(firestore);
    notifications.filter(n => !n.isRead).forEach(n => {
      batch.update(doc(firestore, 'notifications', athleteId, 'items', n.id), { isRead: true });
    });
    await batch.commit();
  };

  const handleDeleteOne = async (notifId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'notifications', athleteId, 'items', notifId));
    } catch {
      toast({ title: 'Error', description: 'Could not delete notification.', variant: 'destructive' });
    }
  };

  const handleDeleteSelected = async () => {
    if (!firestore || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        batch.delete(doc(firestore, 'notifications', athleteId, 'items', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
      setSelectMode(false);
      toast({ title: `${selectedIds.size} notification${selectedIds.size > 1 ? 's' : ''} deleted.` });
    } catch {
      toast({ title: 'Error', description: 'Could not delete notifications.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!firestore || !notifications?.length) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      notifications.forEach(n => {
        batch.delete(doc(firestore, 'notifications', athleteId, 'items', n.id));
      });
      await batch.commit();
      setSelectMode(false);
      setSelectedIds(new Set());
      toast({ title: 'All notifications cleared.' });
    } catch {
      toast({ title: 'Error', description: 'Could not clear notifications.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRead = async () => {
    if (!firestore || !notifications?.length) return;
    const readNotifs = notifications.filter(n => n.isRead);
    if (!readNotifs.length) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(firestore);
      readNotifs.forEach(n => {
        batch.delete(doc(firestore, 'notifications', athleteId, 'items', n.id));
      });
      await batch.commit();
      toast({ title: `${readNotifs.length} read notification${readNotifs.length > 1 ? 's' : ''} cleared.` });
    } catch {
      toast({ title: 'Error', description: 'Could not clear read notifications.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!notifications) return;
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Scout Views */}
      <Card className="border-none shadow-lg bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Scout Views
            </CardTitle>
            <div className="flex items-center gap-2">
              {weeklyViews.length > 0 && (
                <Badge variant="secondary" className="text-xs font-bold gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {weeklyViews.length} this week
                </Badge>
              )}
              {scoutViews.length > 0 && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-black">
                  {scoutViews.length} scout{scoutViews.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
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
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {getInitials(view.viewerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{view.viewerName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[view.viewerRole] || view.viewerRole} · {formatDistanceToNow(new Date(view.viewedAt), { addSuffix: true })}
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

      {/* Notifications */}
      <Card className="border-none shadow-lg bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] font-black h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            {notifications && notifications.length > 0 && (
              <div className="flex items-center gap-1">
                {unreadCount > 0 && !selectMode && (
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={handleMarkAllRead}>
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Read all
                  </Button>
                )}
                {!selectMode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-bold text-muted-foreground"
                    onClick={() => setSelectMode(true)}
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Select
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-bold text-muted-foreground"
                    onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Select mode toolbar */}
          {selectMode && notifications && notifications.length > 0 && (
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                {selectedIds.size === notifications.length
                  ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  : <Square className="w-3.5 h-3.5" />
                }
                {selectedIds.size === notifications.length ? 'Deselect all' : 'Select all'}
              </button>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 text-[10px] font-bold ml-auto gap-1"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete {selectedIds.size}
                </Button>
              )}
              {notifications.some(n => n.isRead) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] font-bold gap-1 text-destructive border-destructive/30"
                  onClick={handleDeleteRead}
                  disabled={isDeleting}
                >
                  Clear read
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] font-bold gap-1 text-destructive border-destructive/30"
                onClick={handleDeleteAll}
                disabled={isDeleting}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-1.5">
          {notifsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
          ) : notifications && notifications.length > 0 ? (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors group ${
                  !notif.isRead ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/30'
                } ${selectMode ? 'cursor-pointer' : ''}`}
                onClick={selectMode ? () => toggleSelect(notif.id) : undefined}
              >
                {selectMode ? (
                  <div className="mt-0.5 shrink-0">
                    {selectedIds.has(notif.id)
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                ) : (
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-primary' : 'bg-transparent'}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{notif.actorName}</p>
                  <p className="text-[11px] text-muted-foreground">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!selectMode && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteOne(notif.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto shrink-0 mt-0.5"
                    title="Delete notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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
