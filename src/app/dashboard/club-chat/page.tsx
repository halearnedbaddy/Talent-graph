'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Loader2, Hash, Users } from 'lucide-react';
import { SquadChatWidget } from '@/components/squad-chat/squad-chat-widget';
import type { ClubMember } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AthleteClubChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading } = useCollection<ClubMember>(memberQuery);
  const clubId = memberships?.[0]?.clubId;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
        <Users className="w-10 h-10 text-muted-foreground" />
        <p className="font-black text-lg uppercase">Not in a Club</p>
        <p className="text-sm text-muted-foreground">Join a club to access squad chat.</p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
            <Hash className="h-5 w-5 text-[#00C853]" /> Squad Chat
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Club team channel</p>
        </div>
      </div>
      <SquadChatWidget />
    </div>
  );
}
