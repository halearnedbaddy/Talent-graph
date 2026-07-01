'use client';

import { useState, useMemo } from 'react';
import type { AthleteProfile, ScoutProfile } from '@/lib/types';
import { ScoutAthleteCard } from './scout-athlete-card';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Store } from 'lucide-react';
import { cn } from '@/lib/utils';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa',"Murang'a",'Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta',
  'Tana River','Tharaka-Nithi','Trans-Nzoia','Turkana','Uasin Gishu','Vihiga',
  'Wajir','West Pokot',
];

interface Props {
  scoutProfile: ScoutProfile;
  compareList: AthleteProfile[];
  onCompare: (a: AthleteProfile) => void;
  savedIds: Set<string>;
  onSave: (a: AthleteProfile) => void;
  onSendMessage?: (a: AthleteProfile) => void;
  allAthletes: AthleteProfile[] | null;
}

export function MarketplaceTab({ scoutProfile, compareList, onCompare, savedIds, onSave, onSendMessage, allAthletes }: Props) {
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [county, setCounty] = useState('all');
  const [ageRange, setAgeRange] = useState([15, 35]);
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [unattachedOnly, setUnattachedOnly] = useState(false);
  const [sort, setSort] = useState<'recent' | 'score'>('recent');

  const isLoading = allAthletes === null;
  const athletes = useMemo(() => (allAthletes || []).filter(a => a.activelyLooking), [allAthletes]);

  const compareIds = new Set(compareList.map(a => a.uid));

  function togglePosition(pos: string) {
    setSelectedPositions(cur =>
      cur.includes(pos) ? cur.filter(p => p !== pos) : [...cur, pos]
    );
  }

  const filtered = useMemo(() => {
    let r = athletes || [];
    if (selectedPositions.length) {
      r = r.filter(a => {
        const pos = [a.position, ...(a.altPositions || [])].filter(Boolean) as string[];
        return pos.some(p => selectedPositions.includes(p));
      });
    }
    if (county !== 'all') r = r.filter(a => a.country === county);
    r = r.filter(a => a.age >= ageRange[0] && a.age <= ageRange[1]);
    r = r.filter(a => (a.compositeScoutingIndex ?? 0) >= scoreRange[0] && (a.compositeScoutingIndex ?? 0) <= scoreRange[1]);
    if (verifiedOnly) r = r.filter(a => a.isVerified);
    if (unattachedOnly) r = r.filter(a => !a.affiliatedClubId);
    return r.sort((a, b) =>
      sort === 'score'
        ? (b.compositeScoutingIndex ?? 0) - (a.compositeScoutingIndex ?? 0)
        : new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
  }, [athletes, selectedPositions, county, ageRange, scoreRange, verifiedOnly, unattachedOnly, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Talent Marketplace</h2>
          {!isLoading && <Badge variant="secondary">{filtered.length} available</Badge>}
        </div>
        <Select value={sort} onValueChange={v => setSort(v as 'recent' | 'score')}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="score">Top score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Position</Label>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(p => (
              <button
                key={p}
                onClick={() => togglePosition(p)}
                className={cn(
                  'text-xs px-2 py-1 rounded border transition-colors font-medium',
                  selectedPositions.includes(p)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary'
                )}
              >{p}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">County</Label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {KENYA_COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-3 block">Age: {ageRange[0]}–{ageRange[1]}</Label>
            <Slider min={15} max={35} step={1} value={ageRange} onValueChange={setAgeRange} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-3 block">Score: {scoreRange[0]}–{scoreRange[1]}</Label>
            <Slider min={0} max={100} step={1} value={scoreRange} onValueChange={setScoreRange} />
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <button
              onClick={() => setVerifiedOnly(v => !v)}
              className={cn('text-xs px-2 py-1 rounded border transition-colors', verifiedOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary')}
            >✓ Verified only</button>
            <button
              onClick={() => setUnattachedOnly(v => !v)}
              className={cn('text-xs px-2 py-1 rounded border transition-colors', unattachedOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary')}
            >Unattached only</button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <Store className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No athletes are currently looking</p>
            <p className="text-sm text-muted-foreground">Athletes who turn on &ldquo;Actively Looking&rdquo; will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(a => (
            <ScoutAthleteCard
              key={a.uid}
              athlete={a}
              showAvailability
              isInCompare={compareIds.has(a.uid)}
              compareDisabled={compareList.length >= 5}
              isSaved={savedIds.has(a.uid)}
              onCompare={() => onCompare(a)}
              onSave={() => onSave(a)}
              onSendMessage={onSendMessage ? () => onSendMessage(a) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
