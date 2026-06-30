'use client';

import { NotificationCenter } from '@/components/coach/notification-center';
import { useCoachClub } from '@/app/coach-dashboard/coach-context';
import { Loader2, MessageSquare, Bell } from 'lucide-react';
import Link from 'next/link';

export default function CoachNotificationsPage() {

  const { clubId, clubName, membershipsLoaded } = useCoachClub();

  if (!membershipsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-[#00C853]" />
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1C2333] border border-[#1E293B] flex items-center justify-center">
          <Bell className="w-7 h-7 text-[#94A3B8]/40" />
        </div>
        <div>
          <p className="font-black text-white text-lg">No club found</p>
          <p className="text-sm text-[#94A3B8] mt-1">
            You need to be part of a club to send notifications.
          </p>
        </div>
        <Link href="/coach-dashboard/find-club" className="text-sm text-[#00C853] font-bold hover:underline">
          Find or create a club →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#00C853]/10 border border-[#00C853]/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[#00C853]" />
            </div>
            <h1 className="text-2xl font-black text-white">Notification Centre</h1>
          </div>
          <p className="text-sm text-[#94A3B8]">
            View all SMS notifications sent to {clubName} players.
          </p>
        </div>
      </div>

      {/* How to send banner */}
      <div className="bg-[#1C2333] border border-[#1E293B] rounded-2xl p-4 space-y-2">
        <p className="text-xs font-black text-[#00C853] uppercase tracking-wider">How to send notifications</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: '1', label: 'Create a training session', href: '/coach-dashboard/training', icon: '🏃' },
            { step: '2', label: 'Add a match or event to schedule', href: '/coach-dashboard/schedule', icon: '📅' },
            { step: '3', label: 'Tap "Notify Team" after saving', href: '#', icon: '💬' },
          ].map(item => (
            <Link
              key={item.step}
              href={item.href}
              className="flex items-center gap-2.5 p-2.5 bg-[#111827] border border-[#1E293B] rounded-xl hover:border-[#00C853]/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0A0E1A] flex items-center justify-center text-lg shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-[#00C853] uppercase tracking-wide">Step {item.step}</p>
                <p className="text-xs font-bold text-white truncate">{item.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <NotificationCenter clubId={clubId} />
    </div>
  );
}
