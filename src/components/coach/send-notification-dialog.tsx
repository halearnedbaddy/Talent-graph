'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, Users, CheckCircle2, AlertTriangle, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AthleteProfile } from '@/lib/types';
import { format, parseISO } from 'date-fns';

export type NotificationType = 'training' | 'match' | 'tournament' | 'general';

export interface NotificationEvent {
  type: NotificationType;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  event: NotificationEvent | null;
  athletes?: AthleteProfile[];
  clubId: string;
  clubName: string;
  coachName: string;
  userToken: string | null;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  training: 'Training Reminder ⚽',
  match: 'Match Notice 🏟️',
  tournament: 'Tournament Notice 🏆',
  general: 'Team Notice 📢',
};

function buildSMS(event: NotificationEvent, teamName: string, coachName: string, extra: string): string {
  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'd MMMM yyyy'); } catch { /* keep raw */ }
  const lines = [TYPE_LABELS[event.type], `Team: ${teamName}`, `Date: ${dateStr}`];
  if (event.time) lines.push(`Time: ${event.time}`);
  if (event.venue) lines.push(`Venue: ${event.venue}`);
  lines.push(`Coach: ${coachName}`);
  if (extra.trim()) lines.push(extra.trim());
  return lines.join('\n');
}

export function SendNotificationDialog({ open, onClose, event, athletes: propAthletes, clubId, clubName, coachName, userToken }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [fetchedAthletes, setFetchedAthletes] = useState<AthleteProfile[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [sending, setSending] = useState(false);
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const athletes = propAthletes ?? fetchedAthletes;
  const withPhone = athletes.filter(a => a.phone);

  useEffect(() => {
    if (!open) { setResult(null); setExtra(''); return; }
    if (propAthletes !== undefined) return;
    if (!firestore || !clubId) return;
    setLoadingAthletes(true);
    getDocs(query(collection(firestore, 'athletes'), where('affiliatedClubId', '==', clubId)))
      .then(snap => setFetchedAthletes(snap.docs.map(d => d.data() as AthleteProfile)))
      .catch(() => {})
      .finally(() => setLoadingAthletes(false));
  }, [open, firestore, clubId, propAthletes]);

  if (!event) return null;

  const preview = buildSMS(event, clubName, coachName, extra);

  const handleSend = async () => {
    if (!userToken || !firestore) return;
    setSending(true);
    try {
      const recipients = withPhone.map(a => ({ phone: a.phone!, name: `${a.firstName} ${a.lastName}` }));
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ batch: recipients.map(r => r.phone), message: preview }),
      });
      const data = await res.json();
      const sent = res.ok ? (data.sent ?? recipients.length) : 0;
      const failed = recipients.length - sent;

      await addDoc(collection(firestore, 'notifications'), {
        clubId, clubName, coachName,
        type: event.type,
        eventTitle: event.title,
        date: event.date,
        time: event.time || null,
        venue: event.venue || null,
        message: preview,
        recipientCount: recipients.length,
        successCount: sent,
        failedCount: failed,
        status: sent > 0 ? (failed > 0 ? 'partial' : 'sent') : 'failed',
        createdAt: new Date().toISOString(),
      });

      setResult({ sent, failed });
      if (sent > 0) {
        toast({ title: `Notifications sent ✓`, description: `${sent} player${sent !== 1 ? 's' : ''} notified via SMS.` });
      } else {
        toast({ variant: 'destructive', title: 'Send failed', description: data.error || 'Check BulkSMS credentials.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Could not send.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md bg-[#111827] border-[#1E293B]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <MessageSquare className="w-4 h-4 text-[#00C853]" />
            Notify Your Team
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-[#1C2333] border border-[#1E293B] rounded-xl">
            <Users className="w-4 h-4 text-[#94A3B8] shrink-0" />
            {loadingAthletes ? (
              <span className="text-sm text-[#94A3B8]">Loading squad…</span>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">
                  {withPhone.length} player{withPhone.length !== 1 ? 's' : ''} with phone numbers
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {athletes.length - withPhone.length > 0
                    ? `${athletes.length - withPhone.length} players have no number on file`
                    : 'All players have a phone number'}
                </p>
              </div>
            )}
          </div>

          <div>
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-2 block">SMS Preview</Label>
            <div className="bg-[#0A0E1A] border border-[#1E293B] rounded-xl p-3">
              <pre className="text-xs text-[#94A3B8] whitespace-pre-wrap font-sans leading-relaxed">{preview}</pre>
              <p className="text-[10px] text-[#94A3B8]/40 mt-2 font-bold tabular-nums">{preview.length} characters · ~{Math.ceil(preview.length / 160)} SMS segment{Math.ceil(preview.length / 160) !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {!result && (
            <div>
              <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-2 block">
                Additional Instructions (optional)
              </Label>
              <Textarea
                placeholder="e.g. Please arrive 15 minutes early. Bring water and boots."
                value={extra}
                onChange={e => setExtra(e.target.value)}
                className="h-20 text-sm bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/30 resize-none focus-visible:ring-[#00C853]/30"
                maxLength={200}
              />
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${result.sent > 0 ? 'bg-[#00C853]/10 border-[#00C853]/30' : 'bg-red-500/10 border-red-500/30'}`}>
              {result.sent > 0
                ? <CheckCircle2 className="w-4 h-4 text-[#00C853] mt-0.5 shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
              <div>
                <p className={`text-sm font-black ${result.sent > 0 ? 'text-[#00C853]' : 'text-red-400'}`}>
                  {result.sent > 0 ? `${result.sent} messages sent` : 'All messages failed'}
                </p>
                {result.failed > 0 && result.sent > 0 && (
                  <p className="text-xs text-amber-400">{result.failed} could not be delivered</p>
                )}
                <p className="text-[10px] text-[#94A3B8] mt-0.5">Logged to Notification Centre</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-[#1E293B] text-[#94A3B8] hover:text-white bg-transparent" onClick={onClose}>
            {result ? 'Close' : 'Skip'}
          </Button>
          {!result && (
            <Button
              onClick={handleSend}
              disabled={sending || loadingAthletes || withPhone.length === 0}
              className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-wide text-xs gap-1.5"
            >
              {sending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                : <><Send className="w-3.5 h-3.5" /> Send to {withPhone.length} Players</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
