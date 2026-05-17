'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { Bell, CheckCheck, Building2, Eye, Heart, MessageCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface ScoutNotification {
    id: string;
    type: string;
    title?: string;
    body?: string;
    message?: string;
    actorName?: string;
    isRead: boolean;
    createdAt: string;
}

function getNotifIcon(type: string) {
    switch (type) {
        case 'club_join_response': return Building2;
        case 'profile_view': return Eye;
        case 'like': return Heart;
        case 'comment': return MessageCircle;
        default: return Bell;
    }
}

export function ScoutNotificationBell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [open, setOpen] = useState(false);

    const notificationsQuery = useMemoFirebase(() => (
        firestore && user ? query(
            collection(firestore, 'notifications', user.uid, 'items'),
            orderBy('createdAt', 'desc'),
            limit(25)
        ) : null
    ), [firestore, user]);

    const { data: notifications } = useCollection<ScoutNotification>(notificationsQuery);
    const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

    const handleMarkAllRead = async () => {
        if (!firestore || !user || !notifications?.length) return;
        const batch = writeBatch(firestore);
        notifications.filter(n => !n.isRead).forEach(n => {
            const ref = doc(firestore, 'notifications', user.uid, 'items', n.id);
            batch.update(ref, { isRead: true });
        });
        await batch.commit();
    };

    const handleMarkRead = async (notifId: string) => {
        if (!firestore || !user) return;
        const ref = doc(firestore, 'notifications', user.uid, 'items', notifId);
        await updateDoc(ref, { isRead: true }).catch(() => {});
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-black px-1 leading-none">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <span className="font-black text-sm uppercase tracking-widest">Notifications</span>
                        {unreadCount > 0 && (
                            <Badge className="bg-primary text-primary-foreground font-black text-[9px] h-4 px-1.5">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] font-bold"
                            onClick={handleMarkAllRead}
                        >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="max-h-[420px]">
                    {!notifications || notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-25" />
                            <p className="text-xs font-bold">No notifications yet</p>
                            <p className="text-[10px] mt-0.5 text-muted-foreground/70">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notif) => {
                                const Icon = getNotifIcon(notif.type);
                                const title = notif.title || notif.actorName || 'Notification';
                                const body = notif.body || notif.message || '';
                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                                        className={`flex gap-3 p-3 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}
                                    >
                                        <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${!notif.isRead ? 'bg-primary/15' : 'bg-muted'}`}>
                                            <Icon className={`h-3.5 w-3.5 ${!notif.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-1">
                                                <p className="text-xs font-bold leading-snug">{title}</p>
                                                {!notif.isRead && (
                                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                )}
                                            </div>
                                            {body && (
                                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                                                    {body}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/50 mt-1">
                                                {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
