'use client';

import { useState, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Plus, X, Send, Users, Megaphone, Zap, BarChart3,
  Mail, MessageSquare, Calendar, CheckCircle2, Clock, AlertCircle,
  Trash2, Play, Pause, RefreshCw, TrendingUp, Copy, Eye,
  MousePointerClick, Target, ArrowRight, ChevronRight, Filter, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import type { MarketingSegment, MarketingCampaign, MarketingAutomation, CampaignChannel, CampaignStatus } from '@/lib/types';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-600 border-slate-200',   icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: Calendar },
  sending:   { label: 'Sending',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200',icon: Loader2 },
  sent:      { label: 'Sent',      color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle2 },
};

const CHANNEL_CONFIG: Record<CampaignChannel, { label: string; icon: any; color: string }> = {
  email: { label: 'Email',      icon: Mail,        color: 'text-blue-500' },
  sms:   { label: 'SMS',        icon: MessageSquare,color: 'text-purple-500' },
  both:  { label: 'Email + SMS',icon: Megaphone,   color: 'text-indigo-500' },
};

const TRIGGER_LABELS: Record<string, string> = {
  days_since_signup:       'Days since signup',
  days_since_provisioned:  'Days since provisioned',
  profile_incomplete:      'Profile incomplete',
  no_login:                'No login for N days',
  scout_viewed:            'Scout viewed profile',
};

const ROLES = ['athlete', 'scout', 'coach', 'club', 'analyst'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rateColor(pct: number) {
  if (pct >= 25) return 'text-green-600';
  if (pct >= 10) return 'text-amber-600';
  return 'text-red-500';
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={cn('text-3xl font-black mt-1', color)}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <Icon className={cn('w-8 h-8 opacity-15', color)} />
      </div>
    </Card>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-black">{value.toLocaleString()} <span className={cn('text-[10px]', color)}>({pct}%)</span></span>
      </div>
      <Progress value={pct} className={cn('h-1.5', color)} />
    </div>
  );
}

// ─── Email body preview block ──────────────────────────────────────────────────

function EmailBodyPreview({ subject, body, label }: { subject?: string; body?: string; label?: string }) {
  if (!subject && !body) return null;
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      {label && <p className="text-[10px] font-black text-primary uppercase tracking-wider">{label}</p>}
      {subject && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
          <p className="text-sm font-bold">{subject}</p>
        </div>
      )}
      {body && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Body</p>
          <div className="bg-background border rounded-lg p-4">
            <div className="bg-indigo-600 rounded-t-lg px-4 py-2 -mx-4 -mt-4 mb-4">
              <p className="text-xs font-black text-white tracking-widest">TALENT GRAPH KENYA</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
            <div className="border-t mt-4 pt-3">
              <p className="text-[10px] text-muted-foreground">Talent Graph Kenya · <span className="underline text-indigo-500">Unsubscribe</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Preview Modal ───────────────────────────────────────────────────

function TemplatePreviewModal({ campaign, onClose }: { campaign: MarketingCampaign; onClose: () => void }) {
  const cc = CHANNEL_CONFIG[campaign.channel] || CHANNEL_CONFIG.email;
  const isAb = campaign.abTest?.enabled;
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A');

  const variantA = isAb ? campaign.abTest!.variantA : null;
  const variantB = isAb ? campaign.abTest!.variantB : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold">{campaign.name}</CardTitle>
              {isAb && (
                <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">A/B TEST</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <cc.icon className={cn('w-3 h-3', cc.color)} />{cc.label}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="overflow-y-auto space-y-4">
          {isAb ? (
            <>
              {/* Variant toggle */}
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-medium">Preview:</p>
                <div className="flex bg-muted rounded-lg p-0.5">
                  {(['A', 'B'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setActiveVariant(v)}
                      className={cn(
                        'px-4 py-1 text-xs font-black rounded transition-all',
                        activeVariant === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Variant {v}
                    </button>
                  ))}
                </div>
                {/* Winner badge */}
                {campaign.abTest?.winner && (
                  <span className={cn(
                    'text-[9px] font-black px-2 py-0.5 rounded border flex items-center gap-1',
                    'bg-amber-50 text-amber-700 border-amber-200'
                  )}>
                    🏆 Variant {campaign.abTest.winner} winning
                  </span>
                )}
              </div>
              <EmailBodyPreview
                subject={activeVariant === 'A' ? variantA?.subject : variantB?.subject}
                body={activeVariant === 'A' ? variantA?.emailBody : variantB?.emailBody}
              />
            </>
          ) : (
            <>
              <EmailBodyPreview subject={campaign.template?.subject} body={campaign.template?.emailBody} />
              {campaign.template?.smsBody && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">SMS Body</p>
                  <div className="bg-background border rounded-xl p-4 max-w-xs font-mono text-sm">
                    {campaign.template.smsBody}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{campaign.template.smsBody.length}/160 characters</p>
                </div>
              )}
            </>
          )}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pb-2">
            <AlertCircle className="w-3 h-3" /> Merge fields: {'{{first_name}}'}, {'{{role}}'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Send Confirmation Modal ──────────────────────────────────────────────────

function SendConfirmModal({
  campaign, segment, onConfirm, onClose, sending,
}: {
  campaign: MarketingCampaign;
  segment?: MarketingSegment;
  onConfirm: () => void;
  onClose: () => void;
  sending: boolean;
}) {
  const cc = CHANNEL_CONFIG[campaign.channel] || CHANNEL_CONFIG.email;
  const isSms = campaign.channel === 'sms' || campaign.channel === 'both';
  const smsReach = segment?.smsEligibleCount ?? null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Confirm Send
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Campaign</span>
              <span className="font-bold">{campaign.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Channel</span>
              <span className="font-bold flex items-center gap-1"><cc.icon className="w-3 h-3" />{cc.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Segment</span>
              <span className="font-bold">{segment?.name ?? 'All users'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. reach</span>
              <span className="font-black text-primary">{(segment?.memberCount ?? 0).toLocaleString()} recipients</span>
            </div>
            {isSms && (
              <div className="flex justify-between text-sm border-t pt-2 mt-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> SMS eligible
                </span>
                {smsReach !== null ? (
                  <span className="font-black text-purple-600">{smsReach.toLocaleString()} with phone</span>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Refresh segment to calculate</span>
                )}
              </div>
            )}
          </div>
          {isSms && smsReach === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">No users in this segment have a phone number on file. Encourage users to add their phone in their settings for SMS delivery.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">This will immediately send to all eligible recipients. Suppressed/unsubscribed contacts will be skipped automatically.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button onClick={onConfirm} disabled={sending} className="gap-1">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : 'Send Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Segment Builder ──────────────────────────────────────────────────────────

function SegmentBuilder({ onClose }: { onClose: () => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', role: '', lastActiveDaysAgo: '', country: '', county: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !form.name.trim()) return;
    setSaving(true);
    try {
      const filterCriteria: any = {};
      if (form.role) filterCriteria.role = form.role;
      if (form.lastActiveDaysAgo) filterCriteria.lastActiveDaysAgo = Number(form.lastActiveDaysAgo);
      if (form.country) filterCriteria['geography.country'] = form.country;
      if (form.county) filterCriteria['geography.county'] = form.county;
      const now = new Date().toISOString();
      await addDoc(collection(firestore, 'marketing_segments'), {
        name: form.name, filterCriteria, memberCount: 0,
        createdBy: user.uid, lastRefreshedAt: now, createdAt: now,
      });
      toast({ title: 'Segment created', description: `"${form.name}" is ready to use in campaigns.` });
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to create segment', description: err?.message ?? 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">Create Audience Segment</CardTitle>
            <CardDescription className="text-xs">Define filter criteria to target specific users</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Segment Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Active Athletes — Kenya" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Role Filter</label>
                <Select value={form.role || '_all'} onValueChange={v => setForm(f => ({ ...f, role: v === '_all' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All roles</SelectItem>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Active within (days)</label>
                <Input type="number" value={form.lastActiveDaysAgo} onChange={e => setForm(f => ({ ...f, lastActiveDaysAgo: e.target.value }))} placeholder="e.g. 30 (leave blank = all)" min={1} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Country</label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. Kenya" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">County</label>
                <Input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} placeholder="e.g. Nairobi" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Segment'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Campaign Builder ─────────────────────────────────────────────────────────

function CampaignBuilderModal({ onClose, segments }: { onClose: () => void; segments: MarketingSegment[] }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', channel: 'email' as CampaignChannel, segmentId: '',
    subject: '', emailBody: '', smsBody: '', scheduledAt: '',
    abTest: false,
    variantASubject: '', variantABody: '',
    variantBSubject: '', variantBBody: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();

      const baseDoc: any = {
        name: form.name, channel: form.channel, segmentId: form.segmentId,
        status: form.scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: form.scheduledAt || null, sentAt: null,
        template: { subject: form.subject, emailBody: form.emailBody, smsBody: form.smsBody },
        analytics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, optedOut: 0, converted: 0 },
        createdAt: now, createdBy: user.uid,
      };

      if (form.abTest) {
        baseDoc.abTest = {
          enabled: true,
          variantA: { subject: form.variantASubject, emailBody: form.variantABody },
          variantB: { subject: form.variantBSubject, emailBody: form.variantBBody },
          analyticsA: { sent: 0, opened: 0, clicked: 0, converted: 0 },
          analyticsB: { sent: 0, opened: 0, clicked: 0, converted: 0 },
          winner: null,
        };
      }

      await addDoc(collection(firestore, 'marketing_campaigns'), baseDoc);
      toast({ title: 'Campaign saved', description: `"${form.name}" added as ${form.scheduledAt ? 'scheduled' : 'draft'}.` });
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save campaign', description: err?.message ?? 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 1 ? !!(form.name && form.channel && form.segmentId) : true;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">Create Campaign</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2].map(n => (
                <div key={n} className={cn('flex items-center gap-1 text-xs font-bold',
                  step === n ? 'text-primary' : step > n ? 'text-green-600' : 'text-muted-foreground')}>
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border',
                    step === n ? 'bg-primary text-primary-foreground border-primary'
                    : step > n ? 'bg-green-100 text-green-700 border-green-300' : 'border-border')}>
                    {step > n ? '✓' : n}
                  </div>
                  {n === 1 ? 'Setup' : 'Content'}
                  {n < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Campaign Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Welcome Athletes — June 2026" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Channel *</label>
                    <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v as CampaignChannel }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="w-3 h-3 text-blue-500" /> Email</span></SelectItem>
                        <SelectItem value="sms"><span className="flex items-center gap-2"><MessageSquare className="w-3 h-3 text-purple-500" /> SMS</span></SelectItem>
                        <SelectItem value="both"><span className="flex items-center gap-2"><Megaphone className="w-3 h-3 text-indigo-500" /> Email + SMS</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Audience Segment *</label>
                    <Select value={form.segmentId} onValueChange={v => setForm(f => ({ ...f, segmentId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                      <SelectContent>
                        {segments.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.memberCount.toLocaleString()})</SelectItem>
                        ))}
                        {segments.length === 0 && <SelectItem value="_none" disabled>No segments yet</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Schedule Send (optional)</label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                  <p className="text-[10px] text-muted-foreground mt-1">Leave blank to save as draft and send manually.</p>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-primary" />
                  Merge fields supported: <code className="bg-muted px-1 rounded">{'{{first_name}}'}</code> <code className="bg-muted px-1 rounded">{'{{role}}'}</code>
                </div>

                {/* A/B Test toggle (email only) */}
                {(form.channel === 'email' || form.channel === 'both') && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-xs font-bold">Enable A/B Testing</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Split audience 50/50 across two subject + body variants</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, abTest: !f.abTest }))}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        form.abTest ? 'bg-indigo-600' : 'bg-muted-foreground/30'
                      )}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', form.abTest ? 'translate-x-4' : 'translate-x-1')} />
                    </button>
                  </div>
                )}

                {/* Normal template (no A/B) */}
                {!form.abTest && (form.channel === 'email' || form.channel === 'both') && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email Subject</label>
                      <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Hi {{first_name}}, your profile is ready 🚀" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email Body</label>
                      <Textarea value={form.emailBody} onChange={e => setForm(f => ({ ...f, emailBody: e.target.value }))} placeholder={`Hi {{first_name}},\n\nWelcome to Talent Graph Kenya...`} rows={6} className="text-sm font-mono" />
                    </div>
                  </>
                )}

                {/* A/B Test variant fields */}
                {form.abTest && (form.channel === 'email' || form.channel === 'both') && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Variant A */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                          <span className="text-[10px] font-black text-white">A</span>
                        </div>
                        <p className="text-xs font-bold">Variant A</p>
                      </div>
                      <Input
                        value={form.variantASubject}
                        onChange={e => setForm(f => ({ ...f, variantASubject: e.target.value }))}
                        placeholder="Subject line A…"
                        className="text-xs"
                      />
                      <Textarea
                        value={form.variantABody}
                        onChange={e => setForm(f => ({ ...f, variantABody: e.target.value }))}
                        placeholder={`Hi {{first_name}},\n\nVersion A of the message…`}
                        rows={6}
                        className="text-xs font-mono"
                      />
                    </div>
                    {/* Variant B */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                          <span className="text-[10px] font-black text-white">B</span>
                        </div>
                        <p className="text-xs font-bold">Variant B</p>
                      </div>
                      <Input
                        value={form.variantBSubject}
                        onChange={e => setForm(f => ({ ...f, variantBSubject: e.target.value }))}
                        placeholder="Subject line B…"
                        className="text-xs"
                      />
                      <Textarea
                        value={form.variantBBody}
                        onChange={e => setForm(f => ({ ...f, variantBBody: e.target.value }))}
                        placeholder={`Hi {{first_name}},\n\nVersion B of the message…`}
                        rows={6}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {(form.channel === 'sms' || form.channel === 'both') && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">SMS Body</label>
                    <Textarea value={form.smsBody} onChange={e => setForm(f => ({ ...f, smsBody: e.target.value }))} placeholder="Hi {{first_name}}, your Talent Graph profile awaits…" rows={3} maxLength={160} className="text-sm" />
                    <p className="text-[10px] text-muted-foreground mt-1">{form.smsBody.length}/160 chars</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between gap-2 pt-6">
              {step > 1 ? <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button> : <div />}
              {step < 2 ? (
                <Button type="button" onClick={() => setStep(2)} disabled={!canNext}>Next: Content <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Campaign'}
                  </Button>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Automation Builder ───────────────────────────────────────────────────────

function AutomationBuilder({ onClose }: { onClose: () => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [form, setForm] = useState({
    name: '', trigger: 'days_since_signup' as string,
    triggerValue: '3', channel: 'email' as CampaignChannel,
    subject: '', emailBody: '', smsBody: '',
  });
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !form.name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'marketing_automations'), {
        name: form.name,
        trigger: { type: form.trigger, value: Number(form.triggerValue) },
        channel: form.channel,
        template: { subject: form.subject, emailBody: form.emailBody, smsBody: form.smsBody },
        status: 'active', triggeredCount: 0, conversionCount: 0,
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Automation created', description: `"${form.name}" is now active.` });
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to create automation', description: err?.message ?? 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">Create Automation</CardTitle>
            <CardDescription className="text-xs">Trigger messages automatically based on user actions</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Automation Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 3-Day Welcome Nudge" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Trigger</label>
                <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">After (days)</label>
                <Input type="number" min={1} value={form.triggerValue} onChange={e => setForm(f => ({ ...f, triggerValue: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Channel</label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v as CampaignChannel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="both">Email + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.channel === 'email' || form.channel === 'both') && (
              <>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject… (supports {{first_name}})" />
                <Textarea value={form.emailBody} onChange={e => setForm(f => ({ ...f, emailBody: e.target.value }))} placeholder="Email body…" rows={4} className="text-sm" />
              </>
            )}
            {(form.channel === 'sms' || form.channel === 'both') && (
              <Textarea value={form.smsBody} onChange={e => setForm(f => ({ ...f, smsBody: e.target.value }))} placeholder="SMS body (max 160 chars)…" rows={2} maxLength={160} className="text-sm" />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Automation'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign, segments, onSend, onClone, onDelete, onPreview,
}: {
  campaign: MarketingCampaign;
  segments: MarketingSegment[];
  onSend: (c: MarketingCampaign) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (c: MarketingCampaign) => void;
}) {
  const sc = STATUS_CONFIG[campaign.status];
  const cc = CHANNEL_CONFIG[campaign.channel as CampaignChannel] || CHANNEL_CONFIG.email;
  const segment = segments.find(s => s.id === campaign.segmentId);
  const a = campaign.analytics || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, optedOut: 0, converted: 0 };
  const openRate  = a.sent > 0 ? Math.round((a.opened / a.sent) * 100) : 0;
  const clickRate = a.sent > 0 ? Math.round((a.clicked / a.sent) * 100) : 0;
  const convRate  = a.sent > 0 ? Math.round((a.converted / a.sent) * 100) : 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={cn('h-1', campaign.status === 'sent' ? 'bg-green-500' : campaign.status === 'sending' ? 'bg-yellow-400' : campaign.status === 'scheduled' ? 'bg-blue-500' : 'bg-slate-300')} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-bold text-sm">{campaign.name}</p>
              <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1', sc.color)}>
                <sc.icon className="w-2.5 h-2.5" />{sc.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className={cn('flex items-center gap-1 font-medium', cc.color)}>
                <cc.icon className="w-3 h-3" />{cc.label}
              </span>
              {segment && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{segment.name} · {segment.memberCount.toLocaleString()}</span>}
              {campaign.sentAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Sent {format(new Date(campaign.sentAt), 'MMM d, yyyy')}</span>}
              {campaign.scheduledAt && campaign.status === 'scheduled' && (
                <span className="flex items-center gap-1 text-blue-600"><Calendar className="w-3 h-3" />Scheduled {format(new Date(campaign.scheduledAt), 'MMM d, HH:mm')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Preview" onClick={() => onPreview(campaign)}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Clone" onClick={() => onClone(campaign.id)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
              <Button size="sm" className="h-7 px-2.5 text-xs ml-1" onClick={() => onSend(campaign)}>
                <Send className="w-3 h-3 mr-1" />Send
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => onDelete(campaign.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {campaign.status === 'sent' && a.sent > 0 && (
          <div className="mt-4 pt-3 border-t">

            {/* ── A/B Test comparison ── */}
            {campaign.abTest?.enabled ? (() => {
              const aa = campaign.abTest!.analyticsA || { sent: 0, opened: 0, clicked: 0, converted: 0 };
              const ab = campaign.abTest!.analyticsB || { sent: 0, opened: 0, clicked: 0, converted: 0 };
              const openA  = aa.sent > 0 ? Math.round((aa.opened  / aa.sent) * 100) : 0;
              const openB  = ab.sent > 0 ? Math.round((ab.opened  / ab.sent) * 100) : 0;
              const clickA = aa.sent > 0 ? Math.round((aa.clicked / aa.sent) * 100) : 0;
              const clickB = ab.sent > 0 ? Math.round((ab.clicked / ab.sent) * 100) : 0;
              const winner = openA > openB + 2 ? 'A' : openB > openA + 2 ? 'B' : null;

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">A/B Test Results</p>
                    {winner && (
                      <span className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                        🏆 Variant {winner} leading ({winner === 'A' ? openA : openB}% open rate)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'A', an: aa, openRate: openA, clickRate: clickA, isWinner: winner === 'A' },
                      { label: 'B', an: ab, openRate: openB, clickRate: clickB, isWinner: winner === 'B' },
                    ].map(v => (
                      <div key={v.label} className={cn(
                        'rounded-lg border p-3 space-y-2 transition-all',
                        v.isWinner ? 'border-amber-300 bg-amber-50/50' : 'border-border bg-muted/20'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center',
                            v.label === 'A' ? 'bg-indigo-600' : 'bg-purple-600'
                          )}>
                            <span className="text-[10px] font-black text-white">{v.label}</span>
                          </div>
                          {v.isWinner && <span className="text-xs">🏆</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Sent</p>
                            <p className="text-sm font-black">{v.an.sent.toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Opened</p>
                            <p className={cn('text-sm font-black', rateColor(v.openRate))}>{v.openRate}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Clicked</p>
                            <p className={cn('text-sm font-black', rateColor(v.clickRate))}>{v.clickRate}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Converted</p>
                            <p className="text-sm font-black text-green-600">{v.an.converted.toLocaleString()}</p>
                          </div>
                        </div>
                        <Progress
                          value={v.openRate}
                          className={cn('h-1', v.label === 'A' ? 'text-indigo-500' : 'text-purple-500')}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Total sent: {a.sent.toLocaleString()} · Open rates update as recipients open emails</p>
                </div>
              );
            })() : (
              /* ── Normal analytics ── */
              <>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'Sent',      value: a.sent,      color: 'text-foreground' },
                    { label: 'Opened',    value: a.opened,    color: rateColor(openRate),  rate: `${openRate}%` },
                    { label: 'Clicked',   value: a.clicked,   color: rateColor(clickRate), rate: `${clickRate}%` },
                    { label: 'Converted', value: a.converted, color: 'text-green-600',     rate: convRate > 0 ? `${convRate}%` : undefined },
                  ].map(stat => (
                    <div key={stat.label} className="text-center bg-muted/30 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className={cn('text-lg font-black leading-tight', stat.color)}>{stat.value.toLocaleString()}</p>
                      {stat.rate && <p className={cn('text-[10px] font-bold', stat.color)}>{stat.rate}</p>}
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <FunnelBar label="Open rate"  value={a.opened}    total={a.sent} color="text-blue-500" />
                  <FunnelBar label="Click rate" value={a.clicked}   total={a.sent} color="text-indigo-500" />
                  <FunnelBar label="Conversion" value={a.converted} total={a.sent} color="text-green-500" />
                  {a.bounced > 0 && <FunnelBar label="Bounced" value={a.bounced} total={a.sent} color="text-red-500" />}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function MarketingDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();

  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<MarketingCampaign | null>(null);
  const [sendCandidate, setSendCandidate] = useState<MarketingCampaign | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState<{ processed: number; results: any[] } | null>(null);

  const segmentsQuery  = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_segments'),  orderBy('createdAt', 'desc')) : null, [firestore]);
  const campaignsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_campaigns'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const automationsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_automations'), orderBy('createdAt', 'desc')) : null, [firestore]);

  const { data: segments,    isLoading: segsLoading  } = useCollection<MarketingSegment>(segmentsQuery);
  const { data: campaigns,   isLoading: camsLoading  } = useCollection<MarketingCampaign>(campaignsQuery);
  const { data: automations, isLoading: autoLoading  } = useCollection<MarketingAutomation>(automationsQuery);

  // Stats
  const totalSent      = (campaigns || []).reduce((s, c) => s + (c.analytics?.sent || 0), 0);
  const totalOpened    = (campaigns || []).reduce((s, c) => s + (c.analytics?.opened || 0), 0);
  const totalConverted = (campaigns || []).reduce((s, c) => s + (c.analytics?.converted || 0), 0);
  const avgOpenRate    = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const activeCams     = (campaigns || []).filter(c => c.status === 'sending' || c.status === 'scheduled').length;
  const totalReach     = (segments  || []).reduce((s, g) => s + g.memberCount, 0);
  const activeAutos    = (automations || []).filter(a => a.status === 'active').length;

  // Top performers for analytics
  const sentCampaigns = (campaigns || []).filter(c => c.status === 'sent' && (c.analytics?.sent || 0) > 0);
  const topCampaigns = [...sentCampaigns]
    .sort((a, b) => {
      const ra = a.analytics?.sent > 0 ? (a.analytics.opened / a.analytics.sent) : 0;
      const rb = b.analytics?.sent > 0 ? (b.analytics.opened / b.analytics.sent) : 0;
      return rb - ra;
    })
    .slice(0, 5);

  const { toast } = useToast();

  const handleSendCampaign = async () => {
    if (!user || !sendCandidate || sending) return;
    setSending(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/marketing/campaigns/${sendCandidate.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      toast({ title: 'Campaign sent', description: `"${sendCandidate.name}" is now sending.` });
      setSendCandidate(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to send campaign', description: err?.message ?? 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const handleClone = async (id: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      toast({ title: 'Campaign cloned' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to clone campaign', description: err?.message ?? 'Please try again.' });
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!user || !confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      toast({ title: 'Campaign deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to delete campaign', description: err?.message ?? 'Please try again.' });
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!user || !confirm('Delete this segment? Campaigns using it will lose their audience reference.')) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/marketing/segments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      toast({ title: 'Segment deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to delete segment', description: err?.message ?? 'Please try again.' });
    }
  };

  const handleRefreshSegment = async (id: string) => {
    if (!user || refreshingId) return;
    setRefreshingId(id);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/marketing/segments/${id}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      toast({ title: 'Segment refreshed' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to refresh segment', description: err?.message ?? 'Please try again.' });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!user || !confirm('Delete this automation?')) return;
    if (firestore) await deleteDoc(doc(firestore, 'marketing_automations', id));
  };

  const handleRunScheduler = async () => {
    if (!user || runningScheduler) return;
    setRunningScheduler(true);
    setSchedulerResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/cron/send-scheduled-campaigns', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setSchedulerResult({ processed: data.processed ?? 0, results: data.results ?? [] });
      if (data.processed > 0) {
        toast({ title: `Scheduler ran — ${data.processed} campaign(s) sent` });
      } else {
        toast({ title: 'Scheduler ran', description: 'No campaigns were due at this time.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Scheduler error', description: err?.message ?? 'Please try again.' });
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleToggleAutomation = async (automation: MarketingAutomation) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'marketing_automations', automation.id), {
      status: automation.status === 'active' ? 'paused' : 'active',
    });
  };

  return (
    <div className="space-y-4">
      {showSegmentBuilder    && <SegmentBuilder    onClose={() => setShowSegmentBuilder(false)} />}
      {showCampaignBuilder   && <CampaignBuilderModal onClose={() => setShowCampaignBuilder(false)} segments={segments || []} />}
      {showAutomationBuilder && <AutomationBuilder onClose={() => setShowAutomationBuilder(false)} />}
      {previewCampaign       && <TemplatePreviewModal campaign={previewCampaign} onClose={() => setPreviewCampaign(null)} />}
      {sendCandidate         && (
        <SendConfirmModal
          campaign={sendCandidate}
          segment={segments?.find(s => s.id === sendCandidate.segmentId)}
          onConfirm={handleSendCampaign}
          onClose={() => setSendCandidate(null)}
          sending={sending}
        />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Reach"   value={totalReach.toLocaleString()}   icon={Users}       color="text-purple-500" />
        <StatCard label="Campaigns"     value={campaigns?.length ?? 0}        icon={Megaphone}   color="text-blue-500" />
        <StatCard label="Avg Open Rate" value={`${avgOpenRate}%`}             icon={TrendingUp}  color={rateColor(avgOpenRate)} sub={totalSent > 0 ? `${totalSent.toLocaleString()} sent` : undefined} />
        <StatCard label="Converted"     value={totalConverted.toLocaleString()}icon={Target}      color="text-green-500" />
        <StatCard label="Active/Sched"  value={activeCams}                    icon={Zap}         color="text-amber-500" />
        <StatCard label="Automations"   value={`${activeAutos} active`}       icon={RefreshCw}   color="text-indigo-500" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="campaigns">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <TabsList className="bg-background border">
            <TabsTrigger value="campaigns"   className="text-xs gap-1.5"><Megaphone   className="w-3 h-3" />Campaigns</TabsTrigger>
            <TabsTrigger value="segments"    className="text-xs gap-1.5"><Users       className="w-3 h-3" />Segments</TabsTrigger>
            <TabsTrigger value="automations" className="text-xs gap-1.5"><Zap         className="w-3 h-3" />Automations</TabsTrigger>
            <TabsTrigger value="analytics"   className="text-xs gap-1.5"><BarChart3   className="w-3 h-3" />Analytics</TabsTrigger>
          </TabsList>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm" variant="outline"
              className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={handleRunScheduler}
              disabled={runningScheduler}
              title="Check for scheduled campaigns that are due and send them now"
            >
              {runningScheduler
                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                : <Clock className="w-3.5 h-3.5 mr-1" />}
              {runningScheduler ? 'Running…' : 'Run Scheduler'}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSegmentBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Segment
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowAutomationBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Automation
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowCampaignBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Campaign
            </Button>
          </div>
        </div>

        {/* ── Campaigns ── */}
        <TabsContent value="campaigns" className="space-y-3">
          {/* Scheduler result banner */}
          {schedulerResult && (
            <div className={cn(
              'rounded-lg border p-3 flex items-start gap-3',
              schedulerResult.processed > 0 ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'
            )}>
              <CheckCircle2 className={cn('w-4 h-4 mt-0.5 shrink-0', schedulerResult.processed > 0 ? 'text-green-600' : 'text-muted-foreground')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">
                  {schedulerResult.processed > 0
                    ? `Scheduler sent ${schedulerResult.processed} campaign${schedulerResult.processed > 1 ? 's' : ''}`
                    : 'No campaigns were due'}
                </p>
                {schedulerResult.results.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {schedulerResult.results.map((r: any, i: number) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        {r.status === 'sent'
                          ? `✓ "${r.name}" — ${r.totalSent} recipients`
                          : `✗ "${r.name}" — ${r.error}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setSchedulerResult(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {camsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !campaigns?.length ? (
            <Card className="p-12 text-center">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">No campaigns yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first campaign to reach your audience.</p>
              <Button size="sm" onClick={() => setShowCampaignBuilder(true)}><Plus className="w-3.5 h-3.5 mr-1" />Create Campaign</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  segments={segments || []}
                  onSend={setSendCandidate}
                  onClone={handleClone}
                  onDelete={handleDeleteCampaign}
                  onPreview={setPreviewCampaign}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Segments ── */}
        <TabsContent value="segments" className="space-y-3">
          {segsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !segments?.length ? (
            <Card className="p-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">No segments yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Define audience segments to power targeted campaigns.</p>
              <Button size="sm" onClick={() => setShowSegmentBuilder(true)}><Plus className="w-3.5 h-3.5 mr-1" />Create Segment</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {segments.map(seg => (
                <Card key={seg.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{seg.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5" />
                        Refreshed {seg.lastRefreshedAt ? formatDistanceToNow(new Date(seg.lastRefreshedAt), { addSuffix: true }) : 'never'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => handleRefreshSegment(seg.id)}
                        disabled={refreshingId === seg.id}
                        title="Refresh member count"
                      >
                        <RefreshCw className={cn('w-3 h-3', refreshingId === seg.id && 'animate-spin')} />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSegment(seg.id)}
                        title="Delete segment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end gap-2 mb-2">
                    <div>
                      <p className="text-3xl font-black text-purple-500">{seg.memberCount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">members</p>
                    </div>
                    {seg.smsEligibleCount !== undefined && (
                      <div className="mb-0.5">
                        <p className="text-lg font-black text-purple-400/70">{seg.smsEligibleCount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />SMS eligible</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {seg.filterCriteria?.role && (
                      <Badge variant="outline" className="text-[9px] capitalize px-1.5"><Filter className="w-2 h-2 mr-1" />{seg.filterCriteria.role}</Badge>
                    )}
                    {seg.filterCriteria?.lastActiveDaysAgo && (
                      <Badge variant="outline" className="text-[9px] px-1.5"><Clock className="w-2 h-2 mr-1" />Active ≤{seg.filterCriteria.lastActiveDaysAgo}d</Badge>
                    )}
                    {seg.filterCriteria?.geography?.country && (
                      <Badge variant="outline" className="text-[9px] px-1.5">{seg.filterCriteria.geography.country}</Badge>
                    )}
                    {!seg.filterCriteria?.role && !seg.filterCriteria?.lastActiveDaysAgo && (
                      <Badge variant="outline" className="text-[9px] px-1.5 text-muted-foreground">All users</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Automations ── */}
        <TabsContent value="automations" className="space-y-3">
          {autoLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !automations?.length ? (
            <Card className="p-12 text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">No automations yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Automate onboarding, re-engagement, and follow-up messages.</p>
              <Button size="sm" onClick={() => setShowAutomationBuilder(true)}><Plus className="w-3.5 h-3.5 mr-1" />Create Automation</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map(auto => {
                const cc = CHANNEL_CONFIG[auto.channel as CampaignChannel] || CHANNEL_CONFIG.email;
                const convPct = auto.triggeredCount > 0 ? Math.round((auto.conversionCount / auto.triggeredCount) * 100) : 0;
                return (
                  <Card key={auto.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold text-sm">{auto.name}</p>
                          <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border',
                            auto.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                            {auto.status === 'active' ? '● Active' : '○ Paused'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <Zap className="w-3 h-3" />
                          {TRIGGER_LABELS[auto.trigger?.type ?? ''] ?? auto.trigger?.type} after {auto.trigger?.value} day{auto.trigger?.value !== 1 ? 's' : ''}
                          <span className="text-muted-foreground/40">·</span>
                          <cc.icon className={cn('w-3 h-3', cc.color)} />{cc.label}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="text-center">
                            <p className="text-lg font-black leading-tight">{(auto.triggeredCount || 0).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">Triggered</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                          <div className="text-center">
                            <p className="text-lg font-black leading-tight text-green-600">{(auto.conversionCount || 0).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">Converted</p>
                          </div>
                          {auto.triggeredCount > 0 && (
                            <div className="flex-1">
                              <FunnelBar label="Conv. rate" value={auto.conversionCount || 0} total={auto.triggeredCount} color="text-green-600" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleAutomation(auto)}>
                          {auto.status === 'active' ? <><Pause className="w-3 h-3 mr-1" />Pause</> : <><Play className="w-3 h-3 mr-1" />Activate</>}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAutomation(auto.id)}>
                          <Trash2 className="w-3 h-3 mr-1" />Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Analytics ── */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Aggregate Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Overall Send Funnel</p>
              {totalSent === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No campaigns sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Sent',      value: totalSent,      color: 'text-foreground' },
                    { label: 'Delivered', value: (campaigns || []).reduce((s,c) => s + (c.analytics?.delivered||0),0), color: 'text-blue-500' },
                    { label: 'Opened',    value: totalOpened,    color: 'text-indigo-500' },
                    { label: 'Clicked',   value: (campaigns || []).reduce((s,c) => s + (c.analytics?.clicked||0),0), color: 'text-purple-500' },
                    { label: 'Converted', value: totalConverted, color: 'text-green-600' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">{row.label}</span>
                      <div className="flex-1">
                        <Progress value={totalSent > 0 ? Math.round((row.value / totalSent) * 100) : 0} className="h-2" />
                      </div>
                      <span className={cn('text-xs font-black w-16 text-right', row.color)}>
                        {row.value.toLocaleString()} <span className="text-[9px] text-muted-foreground">({totalSent > 0 ? Math.round((row.value / totalSent) * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Channel Breakdown</p>
              {!campaigns?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No campaigns yet.</p>
              ) : (
                <div className="space-y-3">
                  {(['email', 'sms', 'both'] as CampaignChannel[]).map(ch => {
                    const chCams = (campaigns || []).filter(c => c.channel === ch);
                    const chSent = chCams.reduce((s,c) => s + (c.analytics?.sent||0), 0);
                    const cc = CHANNEL_CONFIG[ch];
                    if (chCams.length === 0) return null;
                    return (
                      <div key={ch} className="flex items-center gap-3">
                        <div className={cn('flex items-center gap-1.5 w-28 shrink-0 text-xs font-medium', cc.color)}>
                          <cc.icon className="w-3.5 h-3.5" />{cc.label}
                        </div>
                        <div className="flex-1">
                          <Progress value={totalSent > 0 ? Math.round((chSent / totalSent) * 100) : 0} className="h-2" />
                        </div>
                        <span className="text-xs font-black w-20 text-right">
                          {chSent.toLocaleString()} <span className="text-[9px] text-muted-foreground">({chCams.length} cam{chCams.length !== 1 ? 's' : ''})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Top Campaigns Table */}
          <Card className="p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Top Performing Campaigns (by open rate)</p>
            {topCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No sent campaigns yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {['Campaign', 'Segment', 'Sent', 'Open Rate', 'Click Rate', 'Converted'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-muted-foreground font-bold uppercase tracking-wider text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((c, i) => {
                      const a = c.analytics || { sent:0, opened:0, clicked:0, converted:0 };
                      const openR  = a.sent > 0 ? Math.round((a.opened  / a.sent) * 100) : 0;
                      const clickR = a.sent > 0 ? Math.round((a.clicked / a.sent) * 100) : 0;
                      const seg = segments?.find(s => s.id === c.segmentId);
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-black flex items-center justify-center shrink-0">{i+1}</span>
                              <span className="font-bold max-w-[160px] truncate">{c.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{seg?.name ?? '—'}</td>
                          <td className="py-2.5 px-3 font-bold">{a.sent.toLocaleString()}</td>
                          <td className="py-2.5 px-3 font-black">
                            <span className={rateColor(openR)}>{openR}%</span>
                          </td>
                          <td className="py-2.5 px-3 font-black">
                            <span className={rateColor(clickR)}>{clickR}%</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-green-600">{a.converted.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
