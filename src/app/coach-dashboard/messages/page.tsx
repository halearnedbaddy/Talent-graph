'use client';

import { MessagesHub } from '@/components/messaging/messages-hub';

export default function CoachMessagesPage() {
  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Messages</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Direct messages &amp; squad group chat
        </p>
      </div>
      <div style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
        <MessagesHub />
      </div>
    </div>
  );
}
