'use client';

import { useState, useMemo } from 'react';
import type { ScoutProfile } from '@/lib/types';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Send, Loader2, CheckCircle2, AlertTriangle, Clock, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Invitation {
  id: string;
  scoutId: string;
  scoutName: string;
  playerName: string;
  phone: string;
  email?: string;
  teamName: string;
  position: string;
  message?: string;
  inviteUrl: string;
  status: 'pending' | 'sent' | 'viewed' | 'accepted' | 'declined';
  smsStatus?: 'sent' | 'failed';
  createdAt: string;
}

const POSITIONS = [
  'Goalkeeper', 'Centre Back', 'Left Back', 'Right Back', 'Sweeper',
  'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
  'Left Midfielder', 'Right Midfielder', 'Left Winger', 'Right Winger',
  'Centre Forward', 'Striker', 'Second Striker',
];

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Pending',  color: 'text-[#94A3B8]', bg: 'bg-[#94A3B8]/10', border: 'border-[#94A3B8]/30' },
  sent:     { label: 'Sent',     color: 'text-blue-400',  bg: 'bg-blue-400/10',  border: 'border-blue-400/30' },
  viewed:   { label: 'Viewed',   color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  accepted: { label: 'Accepted', color: 'text-[#00C853]', bg: 'bg-[#00C853]/10', border: 'border-[#00C853]/30' },
  declined: { label: 'Declined', color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/30' },
};

function InvitationCard({ inv }: { inv: Invitation }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.pending;
  let ago = '';
  try { ago = formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true }); } catch { /* skip */ }

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate">{inv.playerName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] text-[#94A3B8]">{inv.position}</span>
              <span className="text-[10px] text-[#94A3B8]">·</span>
              <span className="text-[10px] text-[#94A3B8]">{inv.teamName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {inv.smsStatus === 'sent' && (
              <span className="text-[10px] font-black text-[#00C853]">📱 SMS Sent</span>
            )}
            {inv.smsStatus === 'failed' && (
              <span className="text-[10px] font-black text-red-400">📱 SMS Failed</span>
            )}
            <Badge variant="outline" className={cn('text-[9px] font-black border', s.color, s.bg, s.border)}>
              {s.label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Phone className="w-3 h-3 text-[#94A3B8]" />
          <span className="text-[10px] text-[#94A3B8]">{inv.phone}</span>
          <span className="text-[10px] text-[#94A3B8]/50 ml-auto">{ago}</span>
        </div>
      </div>
      {inv.message && (
        <>
          <button
            onClick={() => setExpanded(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1.5 border-t border-[#1E293B] text-[10px] font-bold text-[#94A3B8] hover:text-white hover:bg-[#1C2333]/50 transition-colors"
          >
            <span>Message</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="px-3 pb-3 bg-[#0A0E1A]/40 border-t border-[#1E293B]">
              <p className="text-xs text-[#94A3B8] leading-relaxed pt-2">{inv.message}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface Props {
  scoutProfile: ScoutProfile;
}

export function InvitationFormTab({ scoutProfile }: Props) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    playerName: '', phone: '', email: '',
    teamName: '', position: '', message: '',
  });

  const invitationsQuery = useMemoFirebase(() => (
    firestore
      ? query(collection(firestore, 'invitations'), where('scoutId', '==', scoutProfile.uid))
      : null
  ), [firestore, scoutProfile.uid]);
  const { data: invitations } = useCollection<Invitation>(invitationsQuery);

  const sorted = useMemo(() => {
    if (!invitations) return [];
    return [...invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invitations]);

  const handleSend = async () => {
    if (!form.playerName.trim() || !form.phone.trim() || !form.teamName.trim() || !form.position) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Player name, phone, team, and position are required.' });
      return;
    }

    setSending(true);
    try {
      const user = auth.currentUser;
      const inviteRef = await addDoc(collection(firestore!, 'invitations'), {
        scoutId: scoutProfile.uid,
        scoutName: scoutProfile.name,
        playerName: form.playerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        teamName: form.teamName.trim(),
        position: form.position,
        message: form.message.trim() || null,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.talentgraph.com'}/invite/placeholder`,
        status: 'pending',
        smsStatus: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.talentgraph.com'}/invite/${inviteRef.id}`;

      let smsStatus: 'sent' | 'failed' = 'failed';
      try {
        const idToken = await user?.getIdToken();
        const res = await fetch('/api/invitations/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            phone: form.phone.trim(),
            playerName: form.playerName.trim(),
            teamName: form.teamName.trim(),
            position: form.position,
            senderName: scoutProfile.name,
            message: form.message.trim() || null,
            inviteUrl,
          }),
        });
        const data = await res.json();
        smsStatus = data.success ? 'sent' : 'failed';
      } catch { /* SMS failed, continue */ }

      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(firestore!, 'invitations', inviteRef.id), {
        inviteUrl,
        smsStatus,
        status: smsStatus === 'sent' ? 'sent' : 'pending',
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: smsStatus === 'sent' ? 'Invitation sent ✓' : 'Invitation created',
        description: smsStatus === 'sent'
          ? `${form.playerName} has been notified via SMS.`
          : `Invitation saved. SMS delivery failed — check BulkSMS credentials.`,
      });

      setForm({ playerName: '', phone: '', email: '', teamName: '', position: '', message: '' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Could not send invitation.' });
    } finally {
      setSending(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-[#00C853]" />
        <h2 className="font-black text-white">Player Invitations</h2>
      </div>

      {/* Form */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-4 space-y-4">
        <p className="text-xs font-black text-[#00C853] uppercase tracking-wider">New Invitation</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Player Name *</Label>
            <Input
              placeholder="Full name"
              value={form.playerName}
              onChange={set('playerName')}
              className="bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 focus-visible:ring-[#00C853]/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Phone Number *</Label>
            <Input
              placeholder="+254 7XX XXX XXX"
              value={form.phone}
              onChange={set('phone')}
              type="tel"
              className="bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 focus-visible:ring-[#00C853]/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Team Name *</Label>
            <Input
              placeholder="e.g. Gor Mahia FC"
              value={form.teamName}
              onChange={set('teamName')}
              className="bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 focus-visible:ring-[#00C853]/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Position *</Label>
            <Select value={form.position} onValueChange={v => setForm(p => ({ ...p, position: v }))}>
              <SelectTrigger className="bg-[#0A0E1A] border-[#1E293B] text-white focus:ring-[#00C853]/30">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent className="bg-[#111827] border-[#1E293B]">
                {POSITIONS.map(p => (
                  <SelectItem key={p} value={p} className="text-white focus:bg-[#1C2333]">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Email (optional)</Label>
          <Input
            placeholder="player@email.com"
            value={form.email}
            onChange={set('email')}
            type="email"
            className="bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 focus-visible:ring-[#00C853]/30"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Personal Message (optional)</Label>
          <Textarea
            placeholder="Add a personal note to the player..."
            value={form.message}
            onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
            className="h-24 bg-[#0A0E1A] border-[#1E293B] text-white placeholder:text-[#94A3B8]/40 resize-none focus-visible:ring-[#00C853]/30 text-sm"
            maxLength={300}
          />
          <p className="text-[10px] text-[#94A3B8]/50 text-right">{form.message.length}/300</p>
        </div>

        {/* SMS preview */}
        {form.playerName && form.teamName && (
          <div className="bg-[#0A0E1A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] font-black text-[#00C853] uppercase tracking-wider mb-2">SMS Preview</p>
            <pre className="text-[11px] text-[#94A3B8] whitespace-pre-wrap font-sans leading-relaxed">
{`Talent Graph Invitation ⚽
Hi ${form.playerName || '[Name]'}!
You have been invited to join ${form.teamName || '[Team]'}.${form.position ? `\nPosition: ${form.position}` : ''}
From: ${scoutProfile.name}${form.message ? '\n' + form.message : ''}
View invite: [link]
Reply STOP to opt out.`}
            </pre>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || !form.playerName.trim() || !form.phone.trim() || !form.teamName.trim() || !form.position}
          className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-wide text-xs gap-2"
        >
          {sending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending invitation…</>
            : <><Send className="w-3.5 h-3.5" /> Send Invitation via SMS</>}
        </Button>
      </div>

      {/* Invitation history */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Sent Invitations</p>
            <span className="text-xs font-bold text-[#94A3B8] bg-[#1C2333] border border-[#1E293B] px-2 py-0.5 rounded-lg">{sorted.length}</span>
          </div>
          <div className="space-y-2">
            {sorted.map(inv => <InvitationCard key={inv.id} inv={inv} />)}
          </div>
        </div>
      )}
    </div>
  );
}
