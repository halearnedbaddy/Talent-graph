'use client';

import { useState } from 'react';
import type { AthleteProfile } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  profile: AthleteProfile;
}

export function MarketplaceSettings({ profile }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [looking, setLooking] = useState(profile.activelyLooking ?? false);
  const [bio, setBio] = useState(profile.marketplaceBio ?? '');
  const [availDate, setAvailDate] = useState(profile.availabilityDate ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleToggle = (v: boolean) => { setLooking(v); setIsDirty(true); };
  const handleBio = (v: string) => { setBio(v.slice(0, 150)); setIsDirty(true); };
  const handleDate = (v: string) => { setAvailDate(v); setIsDirty(true); };

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'athletes', profile.uid), {
        activelyLooking: looking,
        marketplaceBio: looking ? bio : '',
        availabilityDate: looking ? availDate : '',
        updatedAt: new Date().toISOString(),
      });
      toast({ title: looking ? 'You\'re now visible in the Marketplace' : 'Marketplace visibility turned off', description: looking ? 'Scouts can now find you in the Talent Marketplace.' : 'Your profile is no longer shown in the Marketplace.' });
      setIsDirty(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save. Please try again.' });
    } finally { setIsSaving(false); }
  };

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-500" />
            Talent Marketplace
          </CardTitle>
          {profile.activelyLooking && (
            <Badge className="bg-emerald-500 text-white text-[10px] gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />Active
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Signal to scouts that you&apos;re actively looking for a club or trial opportunity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="font-semibold text-sm">Actively Looking</p>
            <p className="text-xs text-muted-foreground">Appear in the scout Talent Marketplace</p>
          </div>
          <Switch checked={looking} onCheckedChange={handleToggle} />
        </div>

        {looking && (
          <div className="space-y-3 pl-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Availability Date</Label>
              <Input
                type="date"
                value={availDate}
                onChange={e => handleDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Short Statement <span className="text-muted-foreground/60">({bio.length}/150)</span>
              </Label>
              <Textarea
                value={bio}
                onChange={e => handleBio(e.target.value)}
                placeholder="e.g. Looking for a semi-pro club in Nairobi. Available immediately for trials."
                className="h-20 text-sm resize-none"
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="w-full"
          size="sm"
          variant={isDirty ? 'default' : 'outline'}
        >
          {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {isDirty ? 'Save Changes' : 'Up to date'}
        </Button>
      </CardContent>
    </Card>
  );
}
