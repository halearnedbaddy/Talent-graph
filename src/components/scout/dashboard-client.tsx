'use client';

import { useState, useCallback } from 'react';
import type { ScoutProfile, AthleteProfile, SavedAthlete } from '@/lib/types';
import { signOut } from 'firebase/auth';
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ScoutNotificationBell } from './notification-bell';
import { CompareBar } from './compare-bar';
import { SearchTab } from './search-tab';
import { MarketplaceTab } from './marketplace-tab';
import { CompareTab } from './compare-tab';
import { SavedAthletesTab } from './saved-athletes-tab';
import { MessagesTab } from './messages-tab';
import { ProfileTab } from './profile-tab';
import { Search, Store, BarChart2, Bookmark, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'search',    label: 'Search',    Icon: Search },
  { id: 'market',    label: 'Market',    Icon: Store },
  { id: 'compare',   label: 'Compare',   Icon: BarChart2 },
  { id: 'saved',     label: 'Saved',     Icon: Bookmark },
  { id: 'messages',  label: 'Messages',  Icon: MessageSquare },
  { id: 'profile',   label: 'Profile',   Icon: User },
] as const;

type TabId = typeof TABS[number]['id'];

export function ScoutDashboardClient({ scoutProfile }: { scoutProfile: ScoutProfile }) {
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [compareList, setCompareList] = useState<AthleteProfile[]>([]);
  const [messageTarget, setMessageTarget] = useState<AthleteProfile | null>(null);

  const savedAthletesQuery = useMemoFirebase(() => (
    firestore ? collection(firestore, 'scoutData', scoutProfile.uid, 'savedAthletes') : null
  ), [firestore, scoutProfile.uid]);
  const { data: savedRecords } = useCollection<SavedAthlete>(savedAthletesQuery);
  const savedIds = new Set(savedRecords?.map(r => r.athleteId) || []);

  const handleCompare = useCallback((athlete: AthleteProfile) => {
    setCompareList(prev => {
      const exists = prev.find(a => a.uid === athlete.uid);
      if (exists) return prev.filter(a => a.uid !== athlete.uid);
      if (prev.length >= 5) return prev;
      return [...prev, athlete];
    });
  }, []);

  const handleSave = useCallback(async (athlete: AthleteProfile) => {
    if (!firestore) return;
    const ref = doc(firestore, 'scoutData', scoutProfile.uid, 'savedAthletes', athlete.uid);
    if (savedIds.has(athlete.uid)) {
      await deleteDoc(ref);
      toast({ title: 'Removed', description: `${athlete.firstName} removed from saved athletes.` });
    } else {
      await setDoc(ref, { id: athlete.uid, athleteId: athlete.uid, savedAt: new Date().toISOString() });
      toast({ title: 'Saved', description: `${athlete.firstName} ${athlete.lastName} added to your saved list.` });
    }
  }, [firestore, scoutProfile.uid, savedIds, toast]);

  const handleUnsave = useCallback(async (athleteId: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'scoutData', scoutProfile.uid, 'savedAthletes', athleteId));
    toast({ title: 'Removed from saved athletes.' });
  }, [firestore, scoutProfile.uid, toast]);

  const handleSendMessage = useCallback((athlete: AthleteProfile) => {
    setMessageTarget(athlete);
    setActiveTab('messages');
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const hasCompareBar = compareList.length > 0;
  const bottomNavHeight = 64;
  const compareBarHeight = hasCompareBar ? 60 : 0;
  const contentPaddingBottom = bottomNavHeight + compareBarHeight + 16;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-black">TG</span>
            </div>
            <span className="font-bold text-sm">Scout Console</span>
          </div>
          <div className="flex items-center gap-1">
            <ScoutNotificationBell />
          </div>
        </div>

        <div className="hidden md:flex max-w-screen-xl mx-auto px-4 gap-0 border-t">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'compare' && compareList.length > 0 && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">{compareList.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main
        className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-4"
        style={{ paddingBottom: contentPaddingBottom }}
      >
        {activeTab === 'search' && (
          <SearchTab
            scoutProfile={scoutProfile}
            compareList={compareList}
            onCompare={handleCompare}
            savedIds={savedIds}
            onSave={handleSave}
            onSendMessage={handleSendMessage}
          />
        )}
        {activeTab === 'market' && (
          <MarketplaceTab
            scoutProfile={scoutProfile}
            compareList={compareList}
            onCompare={handleCompare}
            savedIds={savedIds}
            onSave={handleSave}
            onSendMessage={handleSendMessage}
          />
        )}
        {activeTab === 'compare' && (
          <CompareTab
            compareList={compareList}
            onRemove={uid => setCompareList(p => p.filter(a => a.uid !== uid))}
            onClear={() => setCompareList([])}
          />
        )}
        {activeTab === 'saved' && (
          <SavedAthletesTab
            scoutProfile={scoutProfile}
            compareList={compareList}
            onCompare={handleCompare}
            savedIds={savedIds}
            onUnsave={handleUnsave}
            onSendMessage={handleSendMessage}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab
            scoutProfile={scoutProfile}
            composeTarget={messageTarget}
            onComposeClose={() => setMessageTarget(null)}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab scoutProfile={scoutProfile} onSignOut={handleSignOut} />
        )}
      </main>

      <CompareBar
        compareList={compareList}
        onRemove={uid => setCompareList(p => p.filter(a => a.uid !== uid))}
        onCompare={() => setActiveTab('compare')}
        onClear={() => setCompareList([])}
        bottomOffset={bottomNavHeight}
      />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t">
        <div className="grid grid-cols-6 h-16">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                activeTab === id ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5 transition-transform', activeTab === id && 'scale-110')} />
                {id === 'compare' && compareList.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{compareList.length}</span>
                )}
              </div>
              <span className={cn('text-[9px] leading-tight font-medium', activeTab === id ? 'text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
