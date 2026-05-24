'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Activity, Search, Bookmark, MessageSquare, Eye,
  BarChart3, Clock, Loader2, Star, TrendingUp
} from 'lucide-react';
import type { ScoutProfile, SavedAthlete } from '@/lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }

interface ScoutActivity {
  id: string;
  type: 'save' | 'view' | 'message' | 'compare' | 'search' | 'report';
  description: string;
  athleteId?: string;
  athleteName?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  save: Bookmark,
  view: Eye,
  message: MessageSquare,
  compare: BarChart3,
  search: Search,
  report: Star,
};

const ACTIVITY_COLORS: Record<string, string> = {
  save: 'text-[#00C853] bg-[#00C853]/10',
  view: 'text-blue-400 bg-blue-400/10',
  message: 'text-[#FF6D00] bg-[#FF6D00]/10',
  compare: 'text-purple-400 bg-purple-400/10',
  search: 'text-[#94A3B8] bg-[#94A3B8]/10',
  report: 'text-yellow-400 bg-yellow-400/10',
};

export function ActivityTab({ scoutProfile }: { scoutProfile: ScoutProfile }) {
  const firestore = useFirestore();

  const activitiesRef = useMemoFirebase(() => (
    firestore
      ? collection(firestore, 'scoutData', scoutProfile.uid, 'activities')
      : null
  ), [firestore, scoutProfile.uid]);
  const { data: activities, isLoading: activitiesLoading } = useCollection<ScoutActivity>(activitiesRef);

  const savedRef = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedAthletes') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedAthletes } = useCollection<SavedAthlete>(savedRef);

  const savedSearchesRef = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedSearches') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedSearches } = useCollection<any>(savedSearchesRef);

  const sortedActivities = useMemo(() => {
    if (!activities) return [];
    return [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  }, [activities]);

  const statSummary = [
    { label: 'Saved Athletes', value: savedAthletes?.length ?? 0, icon: Bookmark, color: 'text-[#00C853]' },
    { label: 'Search Alerts', value: savedSearches?.length ?? 0, icon: Search, color: 'text-white' },
    { label: 'Activities', value: activities?.length ?? 0, icon: Activity, color: 'text-white' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight">My Activity</h2>
        <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest">Your scouting activity log</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {statSummary.map(s => (
          <Card key={s.label} className="border border-[#1E293B] bg-[#111827]">
            <CardContent className="p-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[8px] font-black text-[#94A3B8] uppercase tracking-widest mt-0.5 leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile info */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 rounded-2xl">
              <AvatarImage src={scoutProfile.photoUrl} className="object-cover" />
              <AvatarFallback className="rounded-2xl bg-[#1C2333] text-[#94A3B8] text-xl font-black">
                {scoutProfile.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-white">{scoutProfile.name}</p>
              <p className="text-[11px] text-[#94A3B8]">@{scoutProfile.username}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30 font-black text-[8px] capitalize">
                  {scoutProfile.entityType}
                </Badge>
                {scoutProfile.isVerified && (
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-black text-[8px]">
                    ✓ Verified
                  </Badge>
                )}
                {scoutProfile.sports?.map(s => (
                  <Badge key={s} className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
          {scoutProfile.bio && (
            <p className="text-[11px] text-[#94A3B8] mt-3 leading-relaxed">{scoutProfile.bio}</p>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#00C853]" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {activitiesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#00C853]" /></div>
          ) : sortedActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-10 w-10 text-[#94A3B8] mx-auto mb-3 opacity-30" />
              <p className="text-[#94A3B8] font-bold">No activity yet</p>
              <p className="text-[#94A3B8] text-xs mt-1">Your scouting actions will appear here.</p>
            </div>
          ) : (
            <>
              {sortedActivities.map(activity => {
                const Icon = ACTIVITY_ICONS[activity.type] ?? Activity;
                const colors = ACTIVITY_COLORS[activity.type] ?? 'text-[#94A3B8] bg-[#94A3B8]/10';
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#1C2333]">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${colors}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{activity.description}</p>
                      {activity.athleteName && (
                        <p className="text-[10px] font-bold text-[#00C853]">{activity.athleteName}</p>
                      )}
                      <p className="text-[9px] text-[#94A3B8] font-bold flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge className={cn('font-black text-[8px] border shrink-0 capitalize',
                      activity.type === 'save' ? 'bg-[#00C853]/10 text-[#00C853] border-[#00C853]/30' :
                        activity.type === 'view' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          'bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/30'
                    )}>
                      {activity.type}
                    </Badge>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* Saved Athletes quick list */}
      {(savedAthletes?.length ?? 0) > 0 && (
        <Card className="border border-[#1E293B] bg-[#111827]">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-[#00C853]" /> Recently Saved ({savedAthletes?.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {savedAthletes?.slice(0, 8).map(sa => (
                <div key={sa.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#1C2333] border border-[#1E293B]">
                  <div className="h-6 w-6 rounded-lg bg-[#0A0E1A] flex items-center justify-center">
                    <Bookmark className="h-3 w-3 text-[#00C853]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white">{sa.athleteId.slice(0, 8)}…</p>
                    <p className="text-[8px] text-[#94A3B8]">
                      {formatDistanceToNow(parseISO(sa.savedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
