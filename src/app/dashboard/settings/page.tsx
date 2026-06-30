'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, ArrowLeft, Save, Zap, Bell, Shield, Eye, Globe,
  Phone, Mail, Store, CheckCircle2, AlertTriangle, Lock, User, Settings2
} from 'lucide-react';
import type { AthleteProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog';

interface AthleteSettings {
  notifications: {
    scoutMessages: boolean;
    clubApprovals: boolean;
    profileViews: boolean;
    emailDigest: boolean;
    smsAlerts: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'scouts_only' | 'private';
    showPhone: boolean;
    showEmail: boolean;
    allowScoutMessages: boolean;
  };
  marketplace: {
    activelyLooking: boolean;
    marketplaceBio: string;
    availabilityDate: string;
  };
}

const DEFAULT_SETTINGS: AthleteSettings = {
  notifications: {
    scoutMessages: true,
    clubApprovals: true,
    profileViews: true,
    emailDigest: false,
    smsAlerts: false,
  },
  privacy: {
    profileVisibility: 'public',
    showPhone: false,
    showEmail: false,
    allowScoutMessages: true,
  },
  marketplace: {
    activelyLooking: false,
    marketplaceBio: '',
    availabilityDate: '',
  },
};

export default function AthleteSettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AthleteSettings>(DEFAULT_SETTINGS);
  const [phone, setPhone] = useState('');

  const athleteRef = useMemoFirebase(() => (
    firestore && user?.uid ? doc(firestore, 'athletes', user.uid) : null
  ), [firestore, user?.uid]);
  const { data: profile, isLoading } = useDoc<AthleteProfile & { settings?: AthleteSettings }>(athleteRef);

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    getDoc(doc(firestore, 'users', user.uid)).then(snap => {
      if (snap.exists()) setPhone(snap.data().phone ?? '');
    });
  }, [firestore, user?.uid]);

  useEffect(() => {
    if (!profile) return;
    setSettings({
      notifications: {
        scoutMessages: profile.settings?.notifications?.scoutMessages ?? true,
        clubApprovals: profile.settings?.notifications?.clubApprovals ?? true,
        profileViews: profile.settings?.notifications?.profileViews ?? true,
        emailDigest: profile.settings?.notifications?.emailDigest ?? false,
        smsAlerts: profile.settings?.notifications?.smsAlerts ?? false,
      },
      privacy: {
        profileVisibility: profile.settings?.privacy?.profileVisibility ?? 'public',
        showPhone: profile.settings?.privacy?.showPhone ?? false,
        showEmail: profile.settings?.privacy?.showEmail ?? false,
        allowScoutMessages: profile.settings?.privacy?.allowScoutMessages ?? true,
      },
      marketplace: {
        activelyLooking: profile.activelyLooking ?? false,
        marketplaceBio: profile.marketplaceBio ?? '',
        availabilityDate: profile.availabilityDate ?? '',
      },
    });
  }, [profile]);

  const handleSave = async () => {
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      await Promise.all([
        updateDoc(doc(firestore, 'athletes', user.uid), {
          settings: {
            notifications: settings.notifications,
            privacy: settings.privacy,
          },
          activelyLooking: settings.marketplace.activelyLooking,
          marketplaceBio: settings.marketplace.activelyLooking ? settings.marketplace.marketplaceBio : '',
          availabilityDate: settings.marketplace.activelyLooking ? settings.marketplace.availabilityDate : '',
          ...(phone ? { phone } : {}),
          updatedAt: new Date().toISOString(),
        }),
        updateDoc(doc(firestore, 'users', user.uid), {
          ...(phone ? { phone } : { phone: null }),
          updatedAt: new Date().toISOString(),
        }),
      ]);
      toast({ title: 'Settings saved', description: 'Your preferences have been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateNotif = (key: keyof AthleteSettings['notifications'], val: boolean) =>
    setSettings(s => ({ ...s, notifications: { ...s.notifications, [key]: val } }));

  const updatePrivacy = (key: keyof AthleteSettings['privacy'], val: any) =>
    setSettings(s => ({ ...s, privacy: { ...s.privacy, [key]: val } }));

  const updateMarket = (key: keyof AthleteSettings['marketplace'], val: any) =>
    setSettings(s => ({ ...s, marketplace: { ...s.marketplace, [key]: val } }));

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-8 w-32 bg-muted rounded-lg" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
      </div>
    );
  }

  const ToggleRow = ({
    label, description, value, onChange, icon: Icon
  }: {
    label: string; description?: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ElementType
  }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
        <div>
          <p className="text-sm font-bold">{label}</p>
          {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 pb-8">
      <header className="bg-background border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <h1 className="text-sm font-black uppercase tracking-widest truncate">Settings</h1>
          </div>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="font-black uppercase tracking-widest h-9 gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 max-w-2xl">
        {/* Account Info */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Your Account
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/40">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center font-black text-lg text-primary shrink-0">
                {profile?.firstName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black">{profile?.firstName} {profile?.lastName}</p>
                <p className="text-[11px] text-muted-foreground">@{profile?.username}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {profile?.isVerified ? (
                    <Badge className="bg-green-500/10 text-green-700 border-green-200 font-black text-[9px] gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Verified Athlete
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 font-black text-[9px] gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Not Verified
                    </Badge>
                  )}
                  {profile?.readinessTier && (
                    <Badge variant="secondary" className="font-black text-[9px]">{profile.readinessTier}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone Number <span className="font-normal normal-case">(optional — for SMS notifications)</span>
              </Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="h-11 font-bold"
              />
              <p className="text-[10px] text-muted-foreground">Used to receive club announcements and match alerts via SMS.</p>
            </div>
          </CardContent>
        </Card>

        {/* Marketplace / Availability */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Talent Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div>
                <p className="font-bold text-sm">Actively Looking</p>
                <p className="text-[11px] text-muted-foreground">Appear in the scout Talent Marketplace feed</p>
              </div>
              <Switch
                checked={settings.marketplace.activelyLooking}
                onCheckedChange={v => updateMarket('activelyLooking', v)}
              />
            </div>
            {settings.marketplace.activelyLooking && (
              <div className="space-y-3 pl-1">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Availability Date</Label>
                  <Input
                    type="date"
                    value={settings.marketplace.availabilityDate}
                    onChange={e => updateMarket('availabilityDate', e.target.value)}
                    className="h-11 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">
                    Short Statement ({settings.marketplace.marketplaceBio.length}/150)
                  </Label>
                  <Textarea
                    value={settings.marketplace.marketplaceBio}
                    onChange={e => updateMarket('marketplaceBio', e.target.value.slice(0, 150))}
                    placeholder="e.g. Looking for a semi-pro club in Nairobi. Available immediately for trials."
                    className="font-bold resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 divide-y">
            <ToggleRow
              label="Scout Messages"
              description="Notify when a scout or club sends you a message"
              value={settings.notifications.scoutMessages}
              onChange={v => updateNotif('scoutMessages', v)}
              icon={Mail}
            />
            <ToggleRow
              label="Club Approvals"
              description="Notify when your club membership is approved or rejected"
              value={settings.notifications.clubApprovals}
              onChange={v => updateNotif('clubApprovals', v)}
              icon={CheckCircle2}
            />
            <ToggleRow
              label="Profile Views"
              description="Notify when a scout or club views your profile"
              value={settings.notifications.profileViews}
              onChange={v => updateNotif('profileViews', v)}
              icon={Eye}
            />
            <ToggleRow
              label="SMS Alerts"
              description="Receive critical alerts via SMS (requires verified phone)"
              value={settings.notifications.smsAlerts}
              onChange={v => updateNotif('smsAlerts', v)}
              icon={Phone}
            />
            <ToggleRow
              label="Email Digest"
              description="Weekly summary of your profile activity"
              value={settings.notifications.emailDigest}
              onChange={v => updateNotif('emailDigest', v)}
              icon={Globe}
            />
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                <Eye className="h-3 w-3" /> Profile Visibility
              </Label>
              <Select
                value={settings.privacy.profileVisibility}
                onValueChange={v => updatePrivacy('profileVisibility', v)}
              >
                <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public" className="font-bold">Public — Visible to all scouts</SelectItem>
                  <SelectItem value="scouts_only" className="font-bold">Scouts Only — Hidden from public</SelectItem>
                  <SelectItem value="private" className="font-bold">Private — Hidden from all searches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="divide-y">
              <ToggleRow
                label="Show Phone Number"
                description="Allow verified scouts to see your phone number"
                value={settings.privacy.showPhone}
                onChange={v => updatePrivacy('showPhone', v)}
                icon={Phone}
              />
              <ToggleRow
                label="Show Email Address"
                description="Allow verified scouts to see your email"
                value={settings.privacy.showEmail}
                onChange={v => updatePrivacy('showEmail', v)}
                icon={Mail}
              />
              <ToggleRow
                label="Allow Direct Messages"
                description="Let scouts send you messages through the platform"
                value={settings.privacy.allowScoutMessages}
                onChange={v => updatePrivacy('allowScoutMessages', v)}
                icon={Mail}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-none shadow-xl bg-background overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div>
                <p className="font-bold text-sm">Account Email</p>
                <p className="text-[11px] text-muted-foreground">Contact support to change your email</p>
              </div>
              <Badge variant="outline" className="font-black text-[9px]">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1 text-green-600" /> Verified
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div>
                <p className="font-bold text-sm">Password</p>
                <p className="text-[11px] text-muted-foreground">Contact support to reset your password</p>
              </div>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full font-black uppercase tracking-widest h-12 text-sm gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Settings
        </Button>

        {/* Danger Zone */}
        <Card className="border border-destructive/30 bg-background overflow-hidden">
          <CardHeader className="bg-destructive/5 border-b border-destructive/20 py-3 px-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-sm">Delete Account</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Permanently delete your athlete profile and all data.</p>
            </div>
            <DeleteAccountDialog />
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest pb-4">
          Talent Graph Kenya · Athlete Console v2.0
        </p>
      </main>
    </div>
  );
}
