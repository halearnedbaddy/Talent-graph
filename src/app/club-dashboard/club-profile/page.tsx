'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Save, Plus, X, Building2, MapPin, Mail,
  Phone, Globe, Trophy, Calendar, Users, CheckCircle2, Shield
} from 'lucide-react';
import type { ClubProfile, ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Murang\'a',
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri',
  'Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia',
  'Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'
];

const LEAGUES = [
  'Kenyan Premier League (KPL)',
  'National Super League (NSL)',
  'FKF Division One',
  'FKF Division Two',
  'County League',
  'Academy League',
  'Women\'s Premier League',
  'Youth League',
  'Other',
];

const SPORT_FOCUSES = ['Football','Basketball','Rugby','Athletics','Volleyball','Netball','Cricket','Swimming'];

export default function ClubProfilePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);
  const [newSport, setNewSport] = useState('');
  const [newLink, setNewLink] = useState('');

  const [form, setForm] = useState({
    clubName: '',
    location: '',
    county: '',
    contactEmail: '',
    contactPhone: '',
    venue: '',
    league: '',
    founded: '',
    bio: '',
    websiteLinks: [] as string[],
    sportFocus: [] as string[],
    charges: '',
    winningAllowance: '',
    gameAllowance: '',
  });

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('role', '==', 'admin')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(clubMemberQuery);
  const resolvedClubId = memberships?.[0]?.clubId;

  useEffect(() => {
    if (resolvedClubId) setClubId(resolvedClubId);
  }, [resolvedClubId]);

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: club } = useDoc<ClubProfile & { county?: string; league?: string; founded?: string; bio?: string }>(clubRef);

  useEffect(() => {
    if (!club) return;
    setForm({
      clubName: club.clubName || '',
      location: club.location || '',
      county: (club as any).county || '',
      contactEmail: club.contactEmail || '',
      contactPhone: club.contactPhone || '',
      venue: club.venue || '',
      league: (club as any).league || '',
      founded: (club as any).founded || '',
      bio: (club as any).bio || '',
      websiteLinks: club.websiteLinks || [],
      sportFocus: club.sportFocus || [],
      charges: club.charges || '',
      winningAllowance: club.winningAllowance || '',
      gameAllowance: club.gameAllowance || '',
    });
  }, [club]);

  const handleSave = async () => {
    if (!firestore || !clubId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'clubs', clubId), {
        ...form,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Club profile updated', description: 'Your club information has been saved.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update club profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addSport = (s: string) => {
    if (!s || form.sportFocus.includes(s)) return;
    setForm(f => ({ ...f, sportFocus: [...f.sportFocus, s] }));
    setNewSport('');
  };

  const removeSport = (i: number) => setForm(f => ({ ...f, sportFocus: f.sportFocus.filter((_, idx) => idx !== i) }));

  const addLink = () => {
    if (!newLink || form.websiteLinks.includes(newLink)) return;
    setForm(f => ({ ...f, websiteLinks: [...f.websiteLinks, newLink] }));
    setNewLink('');
  };

  const removeLink = (i: number) => setForm(f => ({ ...f, websiteLinks: f.websiteLinks.filter((_, idx) => idx !== i) }));

  if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Club Profile</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Your public club identity on Talent Graph
          </p>
        </div>
        <div className="flex items-center gap-2">
          {club?.isVerified && (
            <Badge className="bg-green-500/10 text-green-600 border-green-200 font-black text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="font-black uppercase tracking-widest h-11 min-h-[44px] px-6">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Identity */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Club Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Club Name *</Label>
            <Input
              value={form.clubName}
              onChange={e => setForm(f => ({ ...f, clubName: e.target.value }))}
              placeholder="e.g. Gor Mahia FC"
              className="h-11 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Location / City
            </Label>
            <Input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Nairobi"
              className="h-11 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">County</Label>
            <Select value={form.county || 'none'} onValueChange={v => setForm(f => ({ ...f, county: v === 'none' ? '' : v }))}>
              <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select county" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select county</SelectItem>
                {KENYA_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" /> League
            </Label>
            <Select value={form.league || 'none'} onValueChange={v => setForm(f => ({ ...f, league: v === 'none' ? '' : v }))}>
              <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select league" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select league</SelectItem>
                {LEAGUES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Year Founded
            </Label>
            <Input
              value={form.founded}
              onChange={e => setForm(f => ({ ...f, founded: e.target.value }))}
              placeholder="e.g. 1968"
              className="h-11 font-bold"
              type="number"
              min="1850"
              max={new Date().getFullYear()}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Home Venue</Label>
            <Input
              value={form.venue}
              onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
              placeholder="e.g. Kasarani Stadium"
              className="h-11 font-bold"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Club Bio / Description</Label>
            <Textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Describe your club, its history, values and vision..."
              className="font-bold resize-none min-h-[80px]"
              maxLength={500}
            />
            <p className="text-[9px] text-muted-foreground text-right">{form.bio.length}/500</p>
          </div>
        </CardContent>
      </Card>

      {/* Sports Focus */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Sports Focus
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.sportFocus.map((s, i) => (
              <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 uppercase">
                {s} <X className="w-3 h-3 cursor-pointer" onClick={() => removeSport(i)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={newSport || 'none'} onValueChange={v => { if (v !== 'none') { addSport(v); setNewSport(''); } }}>
              <SelectTrigger className="h-11 font-bold flex-1"><SelectValue placeholder="Add sport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select sport</SelectItem>
                {SPORT_FOCUSES.filter(s => !form.sportFocus.includes(s)).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="h-11 w-11 min-h-[44px] shrink-0" onClick={() => addSport(newSport)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> Contact Email *
            </Label>
            <Input
              value={form.contactEmail}
              onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
              placeholder="admin@yourclub.ke"
              type="email"
              className="h-11 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> Contact Phone
            </Label>
            <Input
              value={form.contactPhone}
              onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
              placeholder="+254 7XX XXX XXX"
              type="tel"
              className="h-11 font-bold"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" /> Website / Social Links
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.websiteLinks.map((l, i) => (
                <Badge key={i} variant="secondary" className="font-bold text-xs h-8 pl-3 pr-1 gap-2 max-w-[200px]">
                  <span className="truncate">{l}</span>
                  <X className="w-3 h-3 cursor-pointer shrink-0" onClick={() => removeLink(i)} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                placeholder="https://yourclub.ke"
                className="h-11 font-bold"
                onKeyDown={e => e.key === 'Enter' && addLink()}
              />
              <Button size="icon" variant="outline" className="h-11 w-11 min-h-[44px] shrink-0" onClick={addLink}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Allowances */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Player Allowances &amp; Fees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Registration Fee (KES)</Label>
            <Input
              value={form.charges}
              onChange={e => setForm(f => ({ ...f, charges: e.target.value }))}
              placeholder="e.g. 5,000"
              className="h-11 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Win Allowance (KES)</Label>
            <Input
              value={form.winningAllowance}
              onChange={e => setForm(f => ({ ...f, winningAllowance: e.target.value }))}
              placeholder="e.g. 2,000"
              className="h-11 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Match Allowance (KES)</Label>
            <Input
              value={form.gameAllowance}
              onChange={e => setForm(f => ({ ...f, gameAllowance: e.target.value }))}
              placeholder="e.g. 1,000"
              className="h-11 font-bold"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full font-black uppercase tracking-widest h-12 text-sm">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Club Profile
      </Button>
    </div>
  );
}
