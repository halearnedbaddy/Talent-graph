'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessagesHub } from '@/components/messaging/messages-hub';
import { BroadcastDialog } from '@/components/messaging/broadcast-dialog';
import { Button } from '@/components/ui/button';
import { Megaphone } from 'lucide-react';

function MessagesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [convId, setConvId] = useState<string | undefined>(params.get('conv') || undefined);

  const handleSent = useCallback((id: string) => {
    setConvId(id);
    router.replace(`/club-dashboard/messages?conv=${id}`);
  }, [router]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Messages</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Club group chat &amp; direct messages
          </p>
        </div>
        <Button
          onClick={() => setBroadcastOpen(true)}
          className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2 h-10"
        >
          <Megaphone className="h-4 w-4" />
          Broadcast
        </Button>
      </div>

      <div style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        <MessagesHub defaultConversationId={convId} />
      </div>

      <BroadcastDialog
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSent={handleSent}
      />
    </>
  );
}

export default function ClubMessagesPage() {
  return (
    <div className="pb-6">
      <Suspense fallback={null}>
        <MessagesContent />
      </Suspense>
    </div>
  );
}
