'use client';

import { useState, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, where, doc, setDoc, addDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { sendClubNotification } from '@/hooks/usePushNotifications';
import type { ClubMember } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent?: (convId: string) => void;
}

export function BroadcastDialog({ open, onClose, onSent }: Props) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const myMemberQuery = useMemoFirebase(() => (
    firestore && user?.uid
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid))
      : null
  ), [firestore, user?.uid]);
  const { data: myMemberships } = useCollection<ClubMember>(myMemberQuery);
  const myMembership = myMemberships?.[0];
  // Derive clubId: prefer membership record, fallback to club_<uid> for club-role users
  const clubId = myMembership?.clubId ?? (user?.uid ? `club_${user.uid}` : undefined);

  const squadQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'active'))
      : null
  ), [firestore, clubId]);
  const { data: squadMembers } = useCollection<ClubMember>(squadQuery);

  const memberCount = squadMembers?.length ?? 0;

  const handleSend = useCallback(async () => {
    if (!firestore || !user?.uid || !clubId || !text.trim()) return;
    setSending(true);
    try {
      const now = new Date().toISOString();

      const clubSnap = await getDoc(doc(firestore, 'clubs', clubId));
      const clubData = clubSnap.data() as any;
      const clubName = clubData?.clubName || 'Club';

      const senderName = myMembership?.displayName || user.displayName || 'Club Admin';
      const senderRole = myMembership?.role || 'club';

      // convId is just the clubId itself (e.g., "club_adminUID") — no extra prefix
      const convId = clubId;

      const allMemberIds = [...new Set([
        user.uid,
        ...(squadMembers?.map(m => m.userId).filter(Boolean) ?? []),
      ])];

      const participantInfo: Record<string, { name: string; role: string }> = {
        [user.uid]: { name: senderName, role: senderRole },
      };
      squadMembers?.forEach(m => {
        if (m.userId) {
          participantInfo[m.userId] = {
            name: m.displayName || (m as any).firstName || 'Squad Member',
            role: m.role || 'athlete',
          };
        }
      });

      const convRef = doc(firestore, 'conversations', convId);
      const convSnap = await getDoc(convRef);

      // ── Step 1: Create or update the conversation FIRST ──
      // (message write rules check the parent conv doc — it must exist before the message write)
      if (!convSnap.exists()) {
        await setDoc(convRef, {
          type: 'group',
          clubId,
          name: `${clubName} Squad`,
          participants: allMemberIds,
          participantInfo,
          lastMessage: text.trim(),
          lastMessageAt: now,
          lastSenderId: user.uid,
          lastSenderName: senderName,
          updatedAt: now,
          createdAt: now,
        });
      } else {
        await updateDoc(convRef, {
          participants: allMemberIds,
          participantInfo,
          lastMessage: text.trim(),
          lastMessageAt: now,
          lastSenderId: user.uid,
          lastSenderName: senderName,
          updatedAt: now,
        });
      }

      // ── Step 2: Write the message (conv doc now exists, rules will pass) ──
      await addDoc(collection(firestore, 'conversations', convId, 'messages'), {
        senderId: user.uid,
        senderName,
        senderRole,
        content: text.trim(),
        timestamp: now,
        isDeleted: false,
        isPinned: true,
        type: 'announcement',
      });

      // ── Step 3: Push notifications ──
      sendClubNotification({
        firestore,
        clubId,
        title: `📢 ${clubName} — Announcement`,
        body: text.trim().length > 100 ? text.trim().slice(0, 100) + '…' : text.trim(),
        url: `/club-dashboard/messages?conv=${convId}`,
        tag: 'club-announcement',
        sentBy: user.uid,
      }).catch(() => {});

      // ── Step 4: In-app notifications ──
      for (const member of squadMembers ?? []) {
        if (member.userId && member.userId !== user.uid) {
          const memberRole = member.role || 'athlete';
          const alertUrl = memberRole === 'coach'
            ? '/coach-dashboard/alerts'
            : memberRole === 'analyst'
            ? '/analyst-dashboard'
            : memberRole === 'scout'
            ? '/scout-dashboard'
            : '/';
          addDoc(collection(firestore, 'notifications', member.userId, 'items'), {
            type: 'club_announcement',
            actorName: clubName,
            actorRole: 'club',
            message: text.trim().length > 120 ? text.trim().slice(0, 120) + '…' : text.trim(),
            conversationId: convId,
            url: alertUrl,
            isRead: false,
            createdAt: now,
          }).catch(() => {});
        }
      }

      trackEvent('broadcast_sent', { recipient_count: memberCount });
      toast({
        title: '📢 Broadcast sent!',
        description: `Message delivered to ${memberCount} squad member${memberCount !== 1 ? 's' : ''}.`,
      });
      setText('');
      onSent?.(convId);
      onClose();
    } catch (err: any) {
      console.error('[BroadcastDialog]', err);
      toast({ variant: 'destructive', title: 'Failed to send', description: err?.message || 'Please try again.' });
    } finally {
      setSending(false);
    }
  }, [firestore, user, clubId, text, myMembership, squadMembers, memberCount, onSent, onClose, toast]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111827] border border-[#1E293B] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight text-base">
            <div className="h-8 w-8 rounded-lg bg-[#00C853]/15 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-[#00C853]" />
            </div>
            Broadcast to Squad
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C2333] border border-[#1E293B]">
            <Users className="h-4 w-4 text-[#94A3B8] shrink-0" />
            <p className="text-sm text-[#94A3B8]">
              Sending to{' '}
              <span className="font-black text-white">{memberCount} squad member{memberCount !== 1 ? 's' : ''}</span>
            </p>
            <Badge className="ml-auto bg-[#00C853]/20 text-[#00C853] border-none font-black text-[9px] h-4 px-1.5">
              + Push notif
            </Badge>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Message</label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
              }}
              placeholder="Type your announcement to the entire squad…"
              className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#4B5563] focus:border-[#00C853] resize-none min-h-[120px] text-sm"
              maxLength={1000}
            />
            <p className="text-[10px] text-[#4B5563] text-right">{text.length}/1000</p>
          </div>

          <p className="text-[10px] text-[#4B5563]">
            This will post a pinned message in the club group chat and send a push notification to all squad members.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending || !clubId}
            className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-xs uppercase gap-2 h-11"
          >
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : <><Megaphone className="h-4 w-4" /> Send to All</>
            }
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-[#1E293B] text-[#94A3B8] hover:text-white font-black text-xs uppercase h-11"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
