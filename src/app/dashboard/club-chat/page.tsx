'use client';

import { MessagesHub } from '@/components/messaging/messages-hub';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AthleteClubChatPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="font-black uppercase tracking-tight text-lg leading-none">Messages</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Club group chat &amp; direct messages
            </p>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-4" style={{ height: 'calc(100vh - 80px)' }}>
        <MessagesHub />
      </div>
    </div>
  );
}
