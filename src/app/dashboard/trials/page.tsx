'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import {
  collection, query, where, orderBy, addDoc, getDocs, doc, getDoc, updateDoc, increment,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Target, Calendar, MapPin, Users, Search, Loader2, CheckCircle2, Filter, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

const POSITION_FILTERS = ['All Positions', 'Goalkeeper', 'Centre-back', 'Left-back', 'Right-back',
  'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
  'Left Winger', 'Right Winger', 'Striker'];

interface Trial {
  id: string;
  clubId: string;
  clubName: string;
  position: string;
  ageMin: number;
  ageMax: number;
  trialDate: string;
  location: string;
  description: string;
  status: 'open' | 'closed';
  applicantCount: number;
  createdAt: string;
}

export default function TrialsBoardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('All Positions');
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const trialsQuery = useMemoFirebase(() =>
    firestore
      ? query(collection(firestore, 'club_trials'), where('status', '==', 'open'), orderBy('trialDate', 'asc'))
      : null,
    [firestore]
  );
  const { data: trials, isLoading } = useCollection<Trial>(trialsQuery);

  const athleteQuery = useMemoFirebase(() =>
    firestore && user ? doc(firestore, 'athletes', user.uid) : null,
    [firestore, user]
  );

  const filtered = (trials ?? []).filter(t => {
    if (posFilter !== 'All Positions' && t.position !== posFilter) return false;
    if (search && !t.clubName.toLowerCase().includes(search.toLowerCase()) &&
        !t.position.toLowerCase().includes(search.toLowerCase()) &&
        !t.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upcoming = filtered.filter(t => !isPast(new Date(t.trialDate)));
  const past = filtered.filter(t => isPast(new Date(t.trialDate)));

  const handleApply = async (trial: Trial) => {
    if (!firestore || !user || applying) return;
    setApplying(trial.id);
    try {
      const athleteSnap = await getDoc(doc(firestore, 'athletes', user.uid));
      const athleteData = athleteSnap.exists() ? athleteSnap.data() : {};
      const athleteName = athleteData.firstName && athleteData.lastName
        ? `${athleteData.firstName} ${athleteData.lastName}`
        : user.displayName ?? user.email ?? 'Athlete';
      const athletePosition = athleteData.position ?? 'Not specified';
      const athleteAge = athleteData.dateOfBirth
        ? Math.floor((Date.now() - new Date(athleteData.dateOfBirth).getTime()) / (365.25 * 864e5))
        : undefined;

      const appRef = doc(firestore, 'club_trials', trial.id, 'applications', user.uid);
      const existing = await getDoc(appRef);
      if (existing.exists()) {
        toast({ title: 'Already applied', description: 'You have already applied to this trial.' });
        setApplied(prev => new Set([...prev, trial.id]));
        return;
      }

      await addDoc(collection(firestore, 'club_trials', trial.id, 'applications'), {
        athleteId: user.uid,
        athleteName,
        athletePosition,
        ...(athleteAge ? { athleteAge } : {}),
        appliedAt: new Date().toISOString(),
        status: 'pending',
      });

      await updateDoc(doc(firestore, 'club_trials', trial.id), {
        applicantCount: increment(1),
      });

      setApplied(prev => new Set([...prev, trial.id]));
      toast({
        title: '✓ Application sent!',
        description: `${trial.clubName} will review your profile and be in touch.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to apply', description: err?.message ?? 'Please try again.' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-24">
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/dashboard"><ChevronLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="font-black text-sm flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" /> Open Trials Board
            </h1>
            <p className="text-[10px] text-muted-foreground">Discover and apply for trial opportunities from clubs</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search club, position, location…" className="pl-8 h-9 text-sm" />
          </div>
          <Select value={posFilter} onValueChange={setPosFilter}>
            <SelectTrigger className="h-9 text-xs w-40 shrink-0">
              <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITION_FILTERS.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Count banner */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {upcoming.length} upcoming trial{upcoming.length !== 1 ? 's' : ''} available
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <Card className="p-12 text-center">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-10" />
            <p className="font-bold text-sm">No trials found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || posFilter !== 'All Positions' ? 'Try different filters.' : 'Check back soon — clubs will post trials here.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map(trial => {
              const hasApplied = applied.has(trial.id);
              const isApplying = applying === trial.id;
              return (
                <Card key={trial.id} className={cn('overflow-hidden transition-shadow hover:shadow-md', hasApplied && 'border-primary/30 bg-primary/5')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-black text-sm">{trial.position}</p>
                          <Badge variant="outline" className="text-[9px]">Age {trial.ageMin}–{trial.ageMax}</Badge>
                          {hasApplied && (
                            <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Applied
                            </Badge>
                          )}
                        </div>
                        <p className="font-bold text-xs text-primary">{trial.clubName}</p>
                      </div>
                      <Button
                        size="sm"
                        className={cn('h-8 text-xs shrink-0', hasApplied && 'bg-green-600 hover:bg-green-700')}
                        onClick={() => handleApply(trial)}
                        disabled={hasApplied || isApplying}
                      >
                        {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hasApplied ? '✓ Applied' : 'Apply'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground mb-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 shrink-0 text-primary/70" />
                        {format(new Date(trial.trialDate), 'EEE, MMM d · h:mm a')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 shrink-0 text-primary/70" />
                        {trial.location}
                      </span>
                    </div>

                    {trial.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{trial.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> {trial.applicantCount ?? 0} applied
                      </span>
                      <span className="text-[10px] text-primary font-bold">
                        {formatDistanceToNow(new Date(trial.trialDate), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {past.length > 0 && (
              <>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest pt-2">Past Trials</p>
                {past.map(trial => (
                  <Card key={trial.id} className="p-4 opacity-50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm">{trial.position} — <span className="text-primary font-black">{trial.clubName}</span></p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(trial.trialDate), 'MMM d, yyyy')}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trial.location}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Passed</Badge>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
