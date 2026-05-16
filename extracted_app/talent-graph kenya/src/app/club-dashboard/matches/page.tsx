'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, addDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trophy, Megaphone, Clock, CheckCircle2, ChevronRight, Star, ClipboardList, Users, Shirt } from 'lucide-react';
import type { ClubMatch, ClubMember, ScoutConnection, ClubProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, parseISO } from 'date-fns';

const CATEGORY_COLORS: Record<string, string> = {
  friendly: 'bg-green-500/10 text-green-700 border-green-200',
  cup: 'bg-purple-500/10 text-purple-700 border-purple-200',
  league: 'bg-blue-500/10 text-blue-700 border-blue-200',
  national: 'bg-red-500/10 text-red-700 border-red-200',
};

const RESULT_COLORS = { W: 'bg-green-600', L: 'bg-red-600', D: 'bg-neutral-500' };

export default function MatchManagementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [isInviting, setIsInviting] = useState<string | null>(null);
  const [reviewMatch, setReviewMatch] = useState<ClubMatch | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid)) : null
  ), [firestore, user]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: clubProfile } = useDoc<ClubProfile>(clubRef);

  const matchesQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'matches'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: matches, isLoading: matchesLoading } = useCollection<ClubMatch>(matchesQuery);

  const connectionsQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'scout_connections'), where('clubId', '==', clubId), where('status', '==', 'accepted')) : null
  ), [firestore, clubId]);
  const { data: connections } = useCollection<ScoutConnection>(connectionsQuery);
  const athleteIds = Array.from(new Set(connections?.map(c => c.athleteId) || []));

  const [newMatch, setNewMatch] = useState({
    competition: '',
    category: 'league' as ClubMatch['category'],
    opponent: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    venue: '',
    result: 'W' as 'W' | 'L' | 'D',
    score: '',
    formation: '',
    homeShirtColor: '#ffffff',
    awayShirtColor: '#000000',
  });

  const [reviewForm, setReviewForm] = useState({
    matchDurationMinutes: 90,
    refereeRating: 7,
    attendance: 0,
    playerOfTheMatch: '',
    matchReport: '',
    halfTimeScore: '',
    fullTimeScore: '',
    totalYellowCards: 0,
    totalRedCards: 0,
  });

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !clubId) return;
    setIsAdding(true);
    try {
      await addDoc(collection(firestore, 'matches'), {
        ...newMatch,
        clubId,
        createdAt: new Date().toISOString()
      });
      toast({ title: 'Match Arranged', description: 'Institutional fixture created.' });
      setNewMatch({ competition: '', category: 'league', opponent: '', date: new Date().toISOString().split('T')[0], location: '', venue: '', result: 'W', score: '', formation: '', homeShirtColor: '#ffffff', awayShirtColor: '#000000' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create match.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleNotifySquad = async (match: ClubMatch) => {
    if (!firestore || !athleteIds.length) {
      toast({ variant: 'destructive', title: 'No Squad Members', description: 'You need accepted athlete connections to send notifications.' });
      return;
    }
    setIsInviting(match.id);
    try {
      const invitePromises = athleteIds.map(athleteId => {
        const inviteId = `${match.id}_${athleteId}`;
        return setDoc(doc(firestore, 'match_invitations', inviteId), {
          id: inviteId, athleteId, matchId: match.id, clubId: match.clubId,
          status: 'pending',
          matchData: { competition: match.competition, opponent: match.opponent, date: match.date, location: match.location },
          createdAt: new Date().toISOString()
        });
      });
      await Promise.all(invitePromises);
      toast({ title: 'Squad Notified', description: `Invitations sent to ${athleteIds.length} players.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send notifications.' });
    } finally {
      setIsInviting(null);
    }
  };

  const openReview = (match: ClubMatch) => {
    setReviewMatch(match);
    setReviewForm({
      matchDurationMinutes: match.matchDurationMinutes || 90,
      refereeRating: match.refereeRating || 7,
      attendance: match.attendance || 0,
      playerOfTheMatch: match.playerOfTheMatch || '',
      matchReport: match.matchReport || '',
      halfTimeScore: match.halfTimeScore || '',
      fullTimeScore: match.fullTimeScore || match.score || '',
      totalYellowCards: match.totalYellowCards || 0,
      totalRedCards: match.totalRedCards || 0,
    });
  };

  const saveReview = async () => {
    if (!firestore || !reviewMatch) return;
    setIsSavingReview(true);
    try {
      const matchRef = doc(firestore, 'matches', reviewMatch.id);
      await updateDoc(matchRef, {
        ...reviewForm,
        score: reviewForm.fullTimeScore,
        review: { ...reviewForm, reviewedAt: new Date().toISOString(), reviewedBy: user?.uid },
      });
      toast({ title: 'Match Review Saved', description: 'All post-match data recorded.' });
      setReviewMatch(null);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save review.' });
    } finally {
      setIsSavingReview(false);
    }
  };

  const sorted = [...(matches || [])].sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = sorted.filter(m => !isPast(parseISO(m.date)) || !m.result);
  const completed = sorted.filter(m => isPast(parseISO(m.date)) && m.result);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-neutral-900 text-white">
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                <Plus className="w-4 h-4 text-primary" /> Arrange New Match
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddMatch} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Competition</Label>
                  <Select value={newMatch.competition} onValueChange={v => setNewMatch({ ...newMatch, competition: v })}>
                    <SelectTrigger className="h-9 font-bold"><SelectValue placeholder="Select Competition" /></SelectTrigger>
                    <SelectContent>
                      {clubProfile?.settings?.competitions?.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      {!clubProfile?.settings?.competitions?.length && (
                        <p className="p-2 text-xs text-muted-foreground">No competitions defined in Settings.</p>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                  <Select value={newMatch.category || 'league'} onValueChange={(v: any) => setNewMatch({ ...newMatch, category: v })}>
                    <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="cup">Cup</SelectItem>
                      <SelectItem value="league">League</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opponent</Label>
                  <Input value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} className="h-9 font-bold" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</Label>
                    <Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="h-9 font-bold" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Result</Label>
                    <Select value={newMatch.result} onValueChange={(v: any) => setNewMatch({ ...newMatch, result: v })}>
                      <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="W">WIN</SelectItem>
                        <SelectItem value="L">LOSS</SelectItem>
                        <SelectItem value="D">DRAW</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Score (e.g. 2-1)</Label>
                  <Input value={newMatch.score} onChange={e => setNewMatch({ ...newMatch, score: e.target.value })} placeholder="2-1" className="h-9 font-bold" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location / Stadium</Label>
                  <Input value={newMatch.location} onChange={e => setNewMatch({ ...newMatch, location: e.target.value })} className="h-9 font-bold" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formation</Label>
                  <Select value={newMatch.formation} onValueChange={v => setNewMatch({ ...newMatch, formation: v })}>
                    <SelectTrigger className="h-9 font-bold"><SelectValue placeholder="Select Formation" /></SelectTrigger>
                    <SelectContent>
                      {['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1', '3-4-3', '4-1-4-1'].map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Home Shirt</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newMatch.homeShirtColor} onChange={e => setNewMatch({ ...newMatch, homeShirtColor: e.target.value })} className="h-9 w-9 rounded border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{newMatch.homeShirtColor}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Away Shirt</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newMatch.awayShirtColor} onChange={e => setNewMatch({ ...newMatch, awayShirtColor: e.target.value })} className="h-9 w-9 rounded border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{newMatch.awayShirtColor}</span>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 font-black uppercase tracking-widest" disabled={isAdding}>
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Fixture'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="upcoming">
            <TabsList className="bg-background border p-1 h-10 mb-6">
              <TabsTrigger value="upcoming" className="text-[10px] font-black uppercase px-6 gap-2">
                <Clock className="w-3 h-3" /> Upcoming ({upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-[10px] font-black uppercase px-6 gap-2">
                <CheckCircle2 className="w-3 h-3" /> Completed ({completed.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {matchesLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin" /></div>
              ) : upcoming.length ? (
                upcoming.map(m => <MatchCard key={m.id} match={m} isInviting={isInviting} onNotify={handleNotifySquad} onReview={openReview} />)
              ) : (
                <EmptyState icon={Trophy} label="No upcoming fixtures" />
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {matchesLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin" /></div>
              ) : completed.length ? (
                completed.map(m => <MatchCard key={m.id} match={m} isInviting={isInviting} onNotify={handleNotifySquad} onReview={openReview} showResult />)
              ) : (
                <EmptyState icon={CheckCircle2} label="No completed matches" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!reviewMatch} onOpenChange={open => !open && setReviewMatch(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Match Review — {reviewMatch?.opponent && `vs ${reviewMatch.opponent}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Half-Time Score</Label>
                <Input value={reviewForm.halfTimeScore} onChange={e => setReviewForm({ ...reviewForm, halfTimeScore: e.target.value })} placeholder="0-0" className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full-Time Score</Label>
                <Input value={reviewForm.fullTimeScore} onChange={e => setReviewForm({ ...reviewForm, fullTimeScore: e.target.value })} placeholder="2-1" className="font-bold h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Match Duration (minutes)</Label>
                <Input type="number" value={reviewForm.matchDurationMinutes} onChange={e => setReviewForm({ ...reviewForm, matchDurationMinutes: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attendance</Label>
                <Input type="number" value={reviewForm.attendance} onChange={e => setReviewForm({ ...reviewForm, attendance: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referee Rating (1–10)</Label>
                <Input type="number" min="1" max="10" step="0.5" value={reviewForm.refereeRating} onChange={e => setReviewForm({ ...reviewForm, refereeRating: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Player of the Match</Label>
                <Input value={reviewForm.playerOfTheMatch} onChange={e => setReviewForm({ ...reviewForm, playerOfTheMatch: e.target.value })} placeholder="Player name" className="font-bold h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-orange-600">Total Yellow Cards</Label>
                <Input type="number" value={reviewForm.totalYellowCards} onChange={e => setReviewForm({ ...reviewForm, totalYellowCards: Number(e.target.value) })} className="font-bold h-9" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-red-600">Total Red Cards</Label>
                <Input type="number" value={reviewForm.totalRedCards} onChange={e => setReviewForm({ ...reviewForm, totalRedCards: Number(e.target.value) })} className="font-bold h-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Match Report</Label>
              <Textarea
                value={reviewForm.matchReport}
                onChange={e => setReviewForm({ ...reviewForm, matchReport: e.target.value })}
                placeholder="Analyst/coach match report — key moments, tactical notes, player observations..."
                className="font-bold resize-none"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewMatch(null)}>Cancel</Button>
            <Button onClick={saveReview} disabled={isSavingReview} className="font-black uppercase tracking-widest gap-2">
              {isSavingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MatchCard({ match, isInviting, onNotify, onReview, showResult }: {
  match: ClubMatch;
  isInviting: string | null;
  onNotify: (m: ClubMatch) => void;
  onReview: (m: ClubMatch) => void;
  showResult?: boolean;
}) {
  const CATEGORY_COLORS: Record<string, string> = {
    friendly: 'bg-green-500/10 text-green-700 border-green-200',
    cup: 'bg-purple-500/10 text-purple-700 border-purple-200',
    league: 'bg-blue-500/10 text-blue-700 border-blue-200',
    national: 'bg-red-500/10 text-red-700 border-red-200',
  };
  const RESULT_BG = { W: 'bg-green-600', L: 'bg-red-600', D: 'bg-neutral-500' } as const;

  return (
    <Card className="border-none shadow-sm bg-background hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-muted-foreground text-lg shrink-0">
              {match.opponent?.[0] || '?'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">{match.competition}</p>
                {match.category && (
                  <Badge className={`text-[8px] font-black uppercase border ${CATEGORY_COLORS[match.category] || ''}`}>{match.category}</Badge>
                )}
                {match.formation && (
                  <Badge variant="outline" className="text-[8px] font-black">{match.formation}</Badge>
                )}
              </div>
              <h3 className="text-lg font-black uppercase">vs {match.opponent}</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {format(new Date(match.date), 'PPPP')}
                {match.location && ` • ${match.location}`}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {match.homeShirtColor && (
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase">
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: match.homeShirtColor }} />
                    Home
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: match.awayShirtColor || '#000' }} />
                    Away
                  </div>
                )}
                {match.attendance !== undefined && match.attendance > 0 && (
                  <span className="text-[9px] font-black text-muted-foreground uppercase">{match.attendance.toLocaleString()} att.</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {showResult && match.result && (
              <div className={`w-10 h-10 rounded-xl ${RESULT_BG[match.result]} flex items-center justify-center text-white font-black text-lg`}>
                {match.result}
              </div>
            )}
            {showResult && match.score && (
              <p className="text-sm font-black text-muted-foreground">{match.score}</p>
            )}
            {match.playerOfTheMatch && (
              <div className="flex items-center gap-1 text-[9px] font-black text-yellow-600">
                <Star className="w-3 h-3 fill-yellow-500" />
                {match.playerOfTheMatch}
              </div>
            )}
          </div>
        </div>

        {match.matchReport && (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Match Report</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{match.matchReport}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-black text-[10px] uppercase tracking-widest h-9 flex-1"
            onClick={() => onNotify(match)}
            disabled={isInviting === match.id}
          >
            {isInviting === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />}
            Notify Squad
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-black text-[10px] uppercase tracking-widest h-9 flex-1"
            onClick={() => onReview(match)}
          >
            <ClipboardList className="w-3 h-3" />
            {match.review ? 'Edit Review' : 'Add Review'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 border-4 border-dashed rounded-3xl opacity-20">
      <Icon className="w-12 h-12 mb-2" />
      <p className="font-black uppercase text-xs tracking-widest">{label}</p>
    </div>
  );
}
