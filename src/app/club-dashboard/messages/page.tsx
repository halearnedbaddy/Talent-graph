'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessagesHub } from '@/components/messaging/messages-hub';
import { BroadcastDialog } from '@/components/messaging/broadcast-dialog';
import { Button } from '@/components/ui/button';
import { Megaphone } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import type { ClubMember } from '@/lib/types';

function MessagesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [convId, setConvId] = useState<string | undefined>(params.get('conv') || undefined);
  const [initialised, setInitialised] = useState(false);

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;
  const clubName = memberships?.[0]?.clubName;

  useEffect(() => {
    if (initialised || !firestore || !user || !clubId) return;
    setInitialised(true);

    if (params.get('conv')) return;

    const groupConvId = `club_${clubId}`;

    (async () => {
      try {
        const convRef = doc(firestore, 'conversations', groupConvId);
        const snap = await getDoc(convRef);
        if (!snap.exists()) {
          await setDoc(convRef, {
            type: 'group',
            clubId,
            clubName: clubName || '',
            participants: [user.uid],
            participantInfo: {
              [user.uid]: {
                name: user.displayName || user.email || 'Club Admin',
                role: 'club',
                photoUrl: user.photoURL || null,
              },
            },
            participantRoles: { [user.uid]: 'club' },
            lastMessage: null,
            lastMessageAt: null,
            lastSenderId: null,
            lastReadAt: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        setConvId(groupConvId);
        router.replace(`/club-dashboard/messages?conv=${groupConvId}`);
      } catch (err) {
        console.error('[MessagesPage] failed to init group conv:', err);
      }
    })();
  }, [initialised, firestore, user, clubId, clubName, params, router]);

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
