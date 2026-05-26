'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SquadChatRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/club-dashboard/messages');
  }, [router]);
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );
}
