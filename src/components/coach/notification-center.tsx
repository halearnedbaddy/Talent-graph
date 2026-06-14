'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, CheckCircle2, AlertTriangle, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  clubId: string;
  clubName: string;
  coachName: string;
  type: 'training' | 'match' | 'tournament' | 'general';
  eventTitle: string;
  date: string;
  time?: string;
  venue?: string;
  message: string;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  status: 'sent' | 'partial' | 'failed' | 'sending';
  createdAt: string;
}

type FilterType = 'all' | 'sent' | 'partial' | 'failed';

const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  sent:    { label: 'All Sent',  icon: CheckCircle2,  color: 'text-[#00C853]', bg: 'bg-[#00C853]/10',  border: 'border-[#00C853]/30' },
  partial: { label: 'Partial',   icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10',  border: 'border-amber-400/30' },
  failed:  { label: 'Failed',    icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  sending: { label: 'Sending…',  icon: Clock,         color: 'text-blue-400',  bg: 'bg-blue-400/10',   border: 'border-blue-400/30' },
};

const TYPE_LABELS: Record<string, string> = {
  training: '⚽ Training',
  match: '🏟️ Match',
  tournament: '🏆 Tournament',
  general: '📢 General',
};

function NotificationCard({ n }: { n: Notification }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLE[n.status] ?? STATUS_STYLE.sent;
  const Icon = style.icon;
  let dateStr = n.date;
  try { dateStr = format(parseISO(n.date), 'd MMM yyyy'); } catch { /* use raw */ }
  let sentAgo = '';
  try { sentAgo = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }); } catch { /* skip */ }

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center shrink-0', style.bg, style.border)}>
            <Icon className={cn('w-4 h-4', style.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-white truncate">{n.eventTitle}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-[#94A3B8] font-bold">{TYPE_LABELS[n.type] || n.type}</span>
                  <span className="text-[10px] text-[#94A3B8]">·</span>
                  <span className="text-[10px] text-[#94A3B8]">{dateStr}</span>
                  {n.time && <span className="text-[10px] text-[#94A3B8]">{n.time}</span>}
                </div>
              </div>
              <Badge variant="outline" className={cn('text-[10px] font-black shrink-0 border', style.color, style.bg, style.border)}>
                {style.label}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                <Users className="w-3 h-3" />
                <span>{n.recipientCount} recipients</span>
              </div>
              {n.successCount > 0 && (
                <span className="text-[10px] font-black text-[#00C853]">✓ {n.successCount} sent</span>
              )}
              {n.failedCount > 0 && (
                <span className="text-[10px] font-black text-red-400">✗ {n.failedCount} failed</span>
              )}
              <span className="text-[10px] text-[#94A3B8]/60 ml-auto">{sentAgo}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-[#1E293B] text-[10px] font-bold text-[#94A3B8] hover:text-white hover:bg-[#1C2333]/50 transition-colors"
      >
        <span>View message</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 bg-[#0A0E1A]/40 border-t border-[#1E293B]">
          <pre className="text-xs text-[#94A3B8] whitespace-pre-wrap font-sans leading-relaxed pt-3">{n.message}</pre>
          {n.venue && (
            <p className="text-[10px] text-[#94A3B8] mt-2">📍 {n.venue}</p>
          )}
          <p className="text-[10px] text-[#94A3B8]/50 mt-2">Coach: {n.coachName}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  clubId: string;
}

export function NotificationCenter({ clubId }: Props) {
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterType>('all');

  const notifsQuery = useMemoFirebase(() => (
    firestore && clubId
      ? query(collection(firestore, 'notifications'), where('clubId', '==', clubId))
      : null
  ), [firestore, clubId]);
  const { data: notifications, isLoading } = useCollection<Notification>(notifsQuery);

  const sorted = useMemo(() => {
    if (!notifications) return [];
    return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted;
    return sorted.filter(n => n.status === filter);
  }, [sorted, filter]);

  const counts = useMemo(() => ({
    all: sorted.length,
    sent: sorted.filter(n => n.status === 'sent').length,
    partial: sorted.filter(n => n.status === 'partial').length,
    failed: sorted.filter(n => n.status === 'failed').length,
  }), [sorted]);

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all',     label: `All (${counts.all})` },
    { id: 'sent',    label: `Sent (${counts.sent})` },
    { id: 'partial', label: `Partial (${counts.partial})` },
    { id: 'failed',  label: `Failed (${counts.failed})` },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#1C2333] p-0.5 rounded-xl border border-[#1E293B]">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'flex-1 text-[10px] py-1.5 rounded-lg transition-colors font-bold uppercase tracking-wide',
              filter === f.id
                ? 'bg-[#00C853] text-black shadow'
                : 'text-[#94A3B8] hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl py-16 flex flex-col items-center text-center gap-3 px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1C2333] border border-[#1E293B] flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-[#94A3B8]/30" />
          </div>
          <div>
            <p className="font-black text-white">No notifications yet</p>
            <p className="text-sm text-[#94A3B8] mt-1">
              Create a training session or schedule event and tap &ldquo;Notify Team&rdquo; to send SMS alerts.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => <NotificationCard key={n.id} n={n} />)}
        </div>
      )}
    </div>
  );
}
