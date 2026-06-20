'use client';

import { useState, useEffect } from 'react';
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
  Trash2, Play, Pause, RefreshCw, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { MarketingSegment, MarketingCampaign, MarketingAutomation, CampaignChannel, CampaignStatus } from '@/lib/types';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar },
  sending: { label: 'Sending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Send },
  sent: { label: 'Sent', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
};

const CHANNEL_CONFIG: Record<CampaignChannel, { label: string; icon: any }> = {
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: MessageSquare },
  both: { label: 'Email + SMS', icon: Megaphone },
};

const ROLES = ['athlete', 'scout', 'coach', 'club', 'analyst'];

function SegmentBuilder({ onClose, existingId }: { onClose: () => void; existingId?: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [form, setForm] = useState({ name: '', role: '', lastActiveDaysAgo: '', country: '', county: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !form.name.trim()) return;
    setSaving(true);

    const filterCriteria: any = {};
    if (form.role) filterCriteria.role = form.role;
    if (form.lastActiveDaysAgo) filterCriteria.lastActiveDaysAgo = Number(form.lastActiveDaysAgo);
    if (form.country) filterCriteria['geography.country'] = form.country;
    if (form.county) filterCriteria['geography.county'] = form.county;

    const now = new Date().toISOString();
    await addDoc(collection(firestore, 'marketing_segments'), {
      name: form.name,
      filterCriteria,
      memberCount: 0,
      createdBy: user.uid,
      lastRefreshedAt: now,
      createdAt: now,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-bold">Create Audience Segment</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Segment Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Active Athletes - Kenya" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Role Filter</label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v === '_all' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All roles</SelectItem>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Last Active (days)</label>
                <Input type="number" value={form.lastActiveDaysAgo} onChange={e => setForm(f => ({ ...f, lastActiveDaysAgo: e.target.value }))} placeholder="e.g. 30" min={1} />
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Segment'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignBuilderModal({ onClose, segments }: { onClose: () => void; segments: MarketingSegment[] }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', channel: 'email' as CampaignChannel, segmentId: '',
    subject: '', emailBody: '', smsBody: '', scheduledAt: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user) return;
    setSaving(true);
    const now = new Date().toISOString();

    await addDoc(collection(firestore, 'marketing_campaigns'), {
      name: form.name,
      channel: form.channel,
      segmentId: form.segmentId,
      status: form.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: form.scheduledAt || null,
      sentAt: null,
      template: { subject: form.subject, emailBody: form.emailBody, smsBody: form.smsBody },
      analytics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, optedOut: 0, converted: 0 },
      createdAt: now,
      createdBy: user.uid,
    });

    setSaving(false);
    onClose();
  };

  const canNext = step === 1 ? !!(form.name && form.channel && form.segmentId) : true;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">Create Campaign</CardTitle>
            <CardDescription className="text-xs mt-0.5">Step {step} of 2</CardDescription>
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
                        <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="w-3 h-3" /> Email</span></SelectItem>
                        <SelectItem value="sms"><span className="flex items-center gap-2"><MessageSquare className="w-3 h-3" /> SMS</span></SelectItem>
                        <SelectItem value="both"><span className="flex items-center gap-2"><Megaphone className="w-3 h-3" /> Email + SMS</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Audience Segment *</label>
                    <Select value={form.segmentId} onValueChange={v => setForm(f => ({ ...f, segmentId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                      <SelectContent>
                        {segments.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.memberCount.toLocaleString()} members)
                          </SelectItem>
                        ))}
                        {segments.length === 0 && <SelectItem value="_none" disabled>No segments yet</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Schedule (optional)</label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {(form.channel === 'email' || form.channel === 'both') && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email Subject</label>
                      <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Your Talent Graph profile is ready 🚀" />
                      <p className="text-[10px] text-muted-foreground mt-1">Merge fields: {'{{first_name}}'}, {'{{role}}'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email Body</label>
                      <Textarea value={form.emailBody} onChange={e => setForm(f => ({ ...f, emailBody: e.target.value }))} placeholder="Hi {{first_name}}, &#10;&#10;Welcome to Talent Graph..." rows={6} className="text-sm font-mono" />
                    </div>
                  </>
                )}
                {(form.channel === 'sms' || form.channel === 'both') && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">SMS Body</label>
                    <Textarea value={form.smsBody} onChange={e => setForm(f => ({ ...f, smsBody: e.target.value }))} placeholder="Hi {{first_name}}, your Talent Graph profile awaits..." rows={3} maxLength={160} className="text-sm" />
                    <p className="text-[10px] text-muted-foreground mt-1">{form.smsBody.length}/160 characters</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-6">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
              ) : <div />}
              {step < 2 ? (
                <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext}>Next: Template</Button>
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

function CampaignRow({ campaign, segments, onSend }: { campaign: MarketingCampaign; segments: MarketingSegment[]; onSend: (id: string) => void }) {
  const sc = STATUS_CONFIG[campaign.status];
  const cc = CHANNEL_CONFIG[campaign.channel as CampaignChannel] || CHANNEL_CONFIG.email;
  const segment = segments.find(s => s.id === campaign.segmentId);
  const a = campaign.analytics || {};
  const openRate = a.sent > 0 ? Math.round((a.opened / a.sent) * 100) : 0;

  return (
    <div className="border rounded-lg p-4 bg-background hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-sm">{campaign.name}</p>
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1', sc.color)}>
              <sc.icon className="w-3 h-3" />{sc.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><cc.icon className="w-3 h-3" />{cc.label}</span>
            {segment && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{segment.name}</span>}
            {campaign.sentAt && <span>Sent {format(new Date(campaign.sentAt), 'MMM d, yyyy')}</span>}
            {campaign.scheduledAt && campaign.status === 'scheduled' && (
              <span className="flex items-center gap-1 text-blue-600"><Calendar className="w-3 h-3" />Scheduled {format(new Date(campaign.scheduledAt), 'MMM d, HH:mm')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaign.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSend(campaign.id)}>
              <Send className="w-3 h-3 mr-1" />Send
            </Button>
          )}
        </div>
      </div>

      {campaign.status === 'sent' && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {[
            { label: 'Sent', value: a.sent || 0 },
            { label: 'Opened', value: a.opened || 0, sub: `${openRate}%` },
            { label: 'Clicked', value: a.clicked || 0 },
            { label: 'Converted', value: a.converted || 0 },
          ].map(stat => (
            <div key={stat.label} className="text-center bg-muted/40 rounded p-2">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-black leading-tight">{stat.value.toLocaleString()}</p>
              {stat.sub && <p className="text-[10px] text-primary font-bold">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationBuilder({ onClose }: { onClose: () => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [form, setForm] = useState({
    name: '', trigger: 'days_since_signup' as 'days_since_signup' | 'days_since_provisioned',
    triggerValue: '3', channel: 'email' as CampaignChannel, smsBody: '', subject: '', emailBody: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !form.name.trim()) return;
    setSaving(true);
    await addDoc(collection(firestore, 'marketing_automations'), {
      name: form.name,
      trigger: { type: form.trigger, value: Number(form.triggerValue) },
      channel: form.channel,
      template: { subject: form.subject, emailBody: form.emailBody, smsBody: form.smsBody },
      status: 'active',
      triggeredCount: 0,
      conversionCount: 0,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-bold">Create Automation</CardTitle>
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
                <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days_since_signup">Days since signup</SelectItem>
                    <SelectItem value="days_since_provisioned">Days since provisioned</SelectItem>
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
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject…" />
                <Textarea value={form.emailBody} onChange={e => setForm(f => ({ ...f, emailBody: e.target.value }))} placeholder="Email body…" rows={4} />
              </>
            )}
            {(form.channel === 'sms' || form.channel === 'both') && (
              <Textarea value={form.smsBody} onChange={e => setForm(f => ({ ...f, smsBody: e.target.value }))} placeholder="SMS body (max 160 chars)…" rows={2} maxLength={160} />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Automation'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function MarketingDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const segmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_segments'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const campaignsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_campaigns'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const automationsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'marketing_automations'), orderBy('createdAt', 'desc')) : null, [firestore]);

  const { data: segments, isLoading: segsLoading } = useCollection<MarketingSegment>(segmentsQuery);
  const { data: campaigns, isLoading: camsLoading } = useCollection<MarketingCampaign>(campaignsQuery);
  const { data: automations, isLoading: autoLoading } = useCollection<MarketingAutomation>(automationsQuery);

  const totalSent = (campaigns || []).reduce((sum, c) => sum + (c.analytics?.sent || 0), 0);
  const totalOpened = (campaigns || []).reduce((sum, c) => sum + (c.analytics?.opened || 0), 0);
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const activeCampaigns = (campaigns || []).filter(c => c.status === 'sending' || c.status === 'scheduled').length;

  const handleSendCampaign = async (campaignId: string) => {
    if (!user || sending) return;
    setSending(campaignId);
    const idToken = await user.getIdToken();
    await fetch(`/api/marketing/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    setSending(null);
  };

  const handleToggleAutomation = async (automation: MarketingAutomation) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'marketing_automations', automation.id), {
      status: automation.status === 'active' ? 'paused' : 'active',
    });
  };

  return (
    <div className="space-y-4">
      {showSegmentBuilder && <SegmentBuilder onClose={() => setShowSegmentBuilder(false)} />}
      {showCampaignBuilder && <CampaignBuilderModal onClose={() => setShowCampaignBuilder(false)} segments={segments || []} />}
      {showAutomationBuilder && <AutomationBuilder onClose={() => setShowAutomationBuilder(false)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Audience Segments', value: segments?.length ?? 0, icon: Users, color: 'text-purple-500' },
          { label: 'Campaigns', value: campaigns?.length ?? 0, icon: Megaphone, color: 'text-blue-500' },
          { label: 'Avg Open Rate', value: `${avgOpenRate}%`, icon: TrendingUp, color: 'text-green-500' },
          { label: 'Active/Scheduled', value: activeCampaigns, icon: Zap, color: 'text-amber-500' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-3xl font-black mt-1', stat.color)}>{stat.value}</p>
              </div>
              <stat.icon className={cn('w-8 h-8 opacity-20', stat.color)} />
            </div>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="campaigns">
        <div className="flex items-center justify-between mb-3">
          <TabsList className="bg-background border">
            <TabsTrigger value="campaigns" className="text-xs"><Megaphone className="w-3 h-3 mr-1.5" />Campaigns</TabsTrigger>
            <TabsTrigger value="segments" className="text-xs"><Users className="w-3 h-3 mr-1.5" />Segments</TabsTrigger>
            <TabsTrigger value="automations" className="text-xs"><Zap className="w-3 h-3 mr-1.5" />Automations</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSegmentBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Segment
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowCampaignBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Campaign
            </Button>
          </div>
        </div>

        <TabsContent value="campaigns" className="space-y-3">
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
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  segments={segments || []}
                  onSend={handleSendCampaign}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="segments" className="space-y-3">
          {segsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !segments?.length ? (
            <Card className="p-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">No segments yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Create audience segments to target your campaigns.</p>
              <Button size="sm" onClick={() => setShowSegmentBuilder(true)}><Plus className="w-3.5 h-3.5 mr-1" />Create Segment</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {segments.map(seg => (
                <Card key={seg.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-sm">{seg.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Updated {seg.lastRefreshedAt ? format(new Date(seg.lastRefreshedAt), 'MMM d') : 'never'}
                      </p>
                    </div>
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-3xl font-black text-purple-500">{seg.memberCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">members</p>
                  <div className="mt-3 space-y-1">
                    {seg.filterCriteria?.role && (
                      <Badge variant="outline" className="text-[9px] capitalize mr-1">{seg.filterCriteria.role}</Badge>
                    )}
                    {seg.filterCriteria?.lastActiveDaysAgo && (
                      <Badge variant="outline" className="text-[9px] mr-1">Active ≤{seg.filterCriteria.lastActiveDaysAgo}d</Badge>
                    )}
                    {seg.filterCriteria?.geography?.country && (
                      <Badge variant="outline" className="text-[9px] mr-1">{seg.filterCriteria.geography.country}</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowAutomationBuilder(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />New Automation
            </Button>
          </div>
          {autoLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !automations?.length ? (
            <Card className="p-12 text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">No automations yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Set up triggered messages for onboarding, re-engagement, and more.</p>
              <Button size="sm" onClick={() => setShowAutomationBuilder(true)}><Plus className="w-3.5 h-3.5 mr-1" />Create Automation</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map(auto => (
                <Card key={auto.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm">{auto.name}</p>
                        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border',
                          auto.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        )}>
                          {auto.status === 'active' ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Triggers {auto.trigger?.value} day{auto.trigger?.value !== 1 ? 's' : ''} after{' '}
                        {auto.trigger?.type === 'days_since_signup' ? 'signup' : 'provisioning'}
                        {' · '}{CHANNEL_CONFIG[auto.channel as CampaignChannel]?.label ?? auto.channel}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span><span className="font-bold text-foreground">{auto.triggeredCount || 0}</span> triggered</span>
                        <span><span className="font-bold text-green-600">{auto.conversionCount || 0}</span> converted</span>
                      </div>
                    </div>
                    <Button
                      variant="outline" size="sm" className="h-7 text-xs shrink-0"
                      onClick={() => handleToggleAutomation(auto)}
                    >
                      {auto.status === 'active' ? <><Pause className="w-3 h-3 mr-1" />Pause</> : <><Play className="w-3 h-3 mr-1" />Activate</>}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
