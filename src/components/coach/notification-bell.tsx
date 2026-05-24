'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ShieldCheck, Trophy, MessageSquare, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { CoachNotification } from '@/hooks/useCoachNotifications';

interface Props {
  notifications: CoachNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const typeIcon = {
  verification: ShieldCheck,
  match: Trophy,
  message: MessageSquare,
} as const;

const typeColor = {
  verification: 'text-amber-400 bg-amber-400/10',
  match: 'text-blue-400 bg-blue-400/10',
  message: 'text-[#00C853] bg-[#00C853]/10',
} as const;

const typeLabel = {
  verification: 'Verification',
  match: 'Match',
  message: 'Message',
} as const;

export function NotificationBell({ notifications, unreadCount, onMarkRead, onMarkAllRead }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleNotificationClick(n: CoachNotification) {
    onMarkRead(n.id);
    setOpen(false);
    router.push(n.href);
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-[#94A3B8] hover:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00C853] text-[9px] font-black text-black leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-10 z-50 w-[340px] rounded-2xl border border-[#1E293B] bg-[#111827] shadow-2xl shadow-black/60 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#00C853]" />
              <span className="text-[13px] font-black text-white uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#00C853] px-1.5 text-[10px] font-black text-black">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] font-bold text-[#94A3B8] hover:text-[#00C853] gap-1"
                  onClick={onMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3" />
                  All read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#94A3B8] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C2333]">
                  <Bell className="h-5 w-5 text-[#94A3B8]" />
                </div>
                <p className="text-[13px] font-bold text-[#94A3B8]">All caught up</p>
                <p className="text-[11px] text-[#475569] text-center">No notifications right now. Check back later.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B]">
                {notifications.map((n) => {
                  const Icon = typeIcon[n.type];
                  const colorClass = typeColor[n.type];
                  const label = typeLabel[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1C2333]',
                        !n.isRead && 'bg-[#0A0E1A]/60'
                      )}
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5', colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            'text-[10px] font-black uppercase tracking-widest',
                            n.type === 'verification' ? 'text-amber-400' :
                            n.type === 'match' ? 'text-blue-400' : 'text-[#00C853]'
                          )}>
                            {label}
                          </span>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#00C853] shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] font-bold text-white leading-tight truncate">{n.title}</p>
                        <p className="text-[11px] text-[#94A3B8] leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-[#475569] mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-[#1E293B] px-4 py-2.5">
              <button
                onClick={() => { setOpen(false); router.push('/coach-dashboard/communications'); }}
                className="text-[11px] font-bold text-[#00C853] hover:underline"
              >
                View all in Communications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
