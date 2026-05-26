'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessagesHub } from '@/components/messaging/messages-hub';

function MessagesContent() {
  const params = useSearchParams();
  const convId = params.get('conv') || undefined;

  return (
    <div style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
      <MessagesHub defaultConversationId={convId} />
    </div>
  );
}

export default function ClubMessagesPage() {
  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Messages</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Club group chat &amp; direct messages
        </p>
      </div>
      <Suspense fallback={null}>
        <MessagesContent />
      </Suspense>
    </div>
  );
}
