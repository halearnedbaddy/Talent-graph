'use client';

import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  clubId: string | undefined;
  userId: string | undefined;
}

export function PushNotificationPrompt({ clubId, userId }: Props) {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(
    clubId,
    userId
  );
  const [dismissed, setDismissed] = useState(false);

  if (permission === 'unsupported') return null;
  if (permission === 'denied') return null;
  if (isSubscribed) return null;
  if (dismissed) return null;
  if (!clubId || !userId) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-widest">Stay in the loop</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Get alerts for goals, squad messages & verifications
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="h-8 text-[10px] font-black uppercase tracking-widest px-3"
          onClick={subscribe}
          disabled={isLoading}
        >
          {isLoading ? '...' : 'Enable'}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PushNotificationToggle({ clubId, userId }: Props) {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(
    clubId,
    userId
  );

  if (permission === 'unsupported') return null;

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading || permission === 'denied'}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-left transition-colors',
        isSubscribed ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground',
        permission === 'denied' && 'opacity-40 cursor-not-allowed'
      )}
    >
      {isSubscribed ? (
        <Bell className="w-4 h-4 shrink-0" />
      ) : (
        <BellOff className="w-4 h-4 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest">
          {isSubscribed ? 'Notifications On' : 'Notifications Off'}
        </p>
        {permission === 'denied' && (
          <p className="text-[9px] mt-0.5">Blocked in browser settings</p>
        )}
      </div>
    </button>
  );
}
