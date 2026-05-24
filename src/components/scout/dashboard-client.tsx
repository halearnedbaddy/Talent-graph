'use client';

import { useState, useCallback } from 'react';
import type { ScoutProfile, AthleteProfile, SavedAthlete, SearchFilters } from '@/lib/types';
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
import { PipelineTab } from './pipeline-tab';
import { SavedSearchesTab } from './saved-searches-tab';
import { ActivityTab } from './activity-tab';
import { SettingsTab } from './settings-tab';
import {
  Search, Store, BarChart2, Bookmark, MessageSquare, User,
  GitPullRequestArrow, Bell, Activity, Menu, X, Zap, ChevronRight, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const TABS = [
  { id: 'search',    label: 'Search Athletes',    icon: Search,             short: 'Search' },
  { id: 'alerts',    label: 'Saved Searches',      icon: Bell,               short: 'Alerts' },
  { id: 'market',    label: 'Marketplace',         icon: Store,              short: 'Market' },
  { id: 'compare',   label: 'Compare Athletes',    icon: BarChart2,          short: 'Compare' },
  { id: 'saved',     label: 'Saved Athletes',      icon: Bookmark,           short: 'Saved' },
  { id: 'pipeline',  label: 'Pipeline',            icon: GitPullRequestArrow, short: 'Pipeline' },
  { id: 'messages',  label: 'Messages',            icon: MessageSquare,      short: 'Messages' },
  { id: 'activity',  label: 'My Activity',         icon: Activity,           short: 'Activity' },
  { id: 'profile',   label: 'Profile',             icon: User,               short: 'Profile' },
  { id: 'settings',  label: 'Settings',            icon: Settings,           short: 'Settings' },
] as const;

type TabId = typeof TABS[number]['id'];

const BOTTOM_NAV_TABS = ['search', 'market', 'saved', 'messages'] as TabId[];

export function ScoutDashboardClient({ scoutProfile }: { scoutProfile: ScoutProfile }) {
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [compareList, setCompareList] = useState<AthleteProfile[]>([]);
  const [messageTarget, setMessageTarget] = useState<AthleteProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchFiltersFromAlert, setSearchFiltersFromAlert] = useState<SearchFilters | undefined>();

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

  const handleRunSavedSearch = useCallback((filters: SearchFilters) => {
    setSearchFiltersFromAlert(filters);
    setActiveTab('search');
    setSidebarOpen(false);
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const hasCompareBar = compareList.length > 0;
  const bottomNavHeight = 64;
  const compareBarHeight = hasCompareBar ? 60 : 0;
  const contentPaddingBottom = bottomNavHeight + compareBarHeight + 16;

  const activeTabInfo = TABS.find(t => t.id === activeTab);

  const NavItem = ({ tab, onClick }: { tab: typeof TABS[number]; onClick: () => void }) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all text-left',
          isActive
            ? 'bg-[#00C853]/15 text-[#00C853]'
            : 'text-[#94A3B8] hover:text-white hover:bg-[#1C2333]'
        )}
      >
        <tab.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-[#00C853]')} />
        <span className="flex-1 truncate">{tab.label}</span>
        {tab.id === 'compare' && compareList.length > 0 && (
          <span className="ml-auto text-[9px] bg-[#00C853] text-black rounded-full w-4 h-4 flex items-center justify-center font-black shrink-0">{compareList.length}</span>
        )}
        {isActive && <ChevronRight className="h-3 w-3 text-[#00C853] shrink-0" />}
      </button>
    );
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b border-[#1E293B] px-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00C853] shrink-0">
          <Zap className="h-4 w-4 text-black" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-tight truncate text-white">Talent Graph</p>
          <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Scout Console</p>
        </div>
      </div>

      {/* Scout info */}
      <div className="px-4 py-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#1C2333] flex items-center justify-center text-[#94A3B8] text-xs font-black shrink-0">
            {scoutProfile.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-white truncate">{scoutProfile.name}</p>
            <p className="text-[9px] font-bold text-[#94A3B8] truncate uppercase tracking-wide">
              {scoutProfile.entityType === 'individual' ? 'Individual Scout' : 'Organisation'}
            </p>
          </div>
          {scoutProfile.isVerified && (
            <div className="h-4 w-4 rounded-full bg-[#00C853]/20 flex items-center justify-center shrink-0">
              <span className="text-[#00C853] text-[8px]">✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-3 px-2 space-y-0.5">
        {TABS.map(tab => (
          <NavItem key={tab.id} tab={tab} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }} />
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-[#1E293B] p-3 shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 transition-all text-[13px] font-semibold"
        >
          <User className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#0A0E1A] text-white">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] border-r border-[#1E293B] bg-[#111827] shrink-0 fixed top-0 left-0 h-screen z-40">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-[280px] bg-[#111827] border-r border-[#1E293B] z-50">
            <Sidebar />
          </aside>
          <Button
            variant="ghost" size="icon"
            className="absolute top-3 right-3 text-white z-50"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-[260px] flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#1E293B] bg-[#111827]/95 backdrop-blur px-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-[#94A3B8]" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-4 w-4 text-[#00C853] shrink-0" />
            <h1 className="text-sm font-black uppercase tracking-tight text-white truncate">
              {activeTabInfo?.label ?? 'Scout Console'}
            </h1>
          </div>
          <ScoutNotificationBell />
        </header>

        {/* Desktop topbar */}
        <header className="hidden md:flex sticky top-0 z-20 min-h-[52px] items-center justify-between border-b border-[#1E293B] bg-[#0A0E1A]/95 backdrop-blur px-6 shrink-0">
          <h1 className="text-sm font-black uppercase tracking-wider text-white">
            {activeTabInfo?.label ?? 'Scout Console'}
          </h1>
          <div className="flex items-center gap-2">
            <ScoutNotificationBell />
          </div>
        </header>

        {/* Content */}
        <main
          className="flex-1 p-4 md:p-6 lg:p-8"
          style={{ paddingBottom: contentPaddingBottom + 16 }}
        >
          {activeTab === 'search' && (
            <SearchTab
              scoutProfile={scoutProfile}
              compareList={compareList}
              onCompare={handleCompare}
              savedIds={savedIds}
              onSave={handleSave}
              onSendMessage={handleSendMessage}
              initialFilters={searchFiltersFromAlert}
            />
          )}
          {activeTab === 'alerts' && (
            <SavedSearchesTab
              scoutProfile={scoutProfile}
              onRunSearch={handleRunSavedSearch}
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
          {activeTab === 'pipeline' && (
            <PipelineTab scoutProfile={scoutProfile} />
          )}
          {activeTab === 'messages' && (
            <MessagesTab
              scoutProfile={scoutProfile}
              composeTarget={messageTarget}
              onComposeClose={() => setMessageTarget(null)}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityTab scoutProfile={scoutProfile} />
          )}
          {activeTab === 'profile' && (
            <ProfileTab scoutProfile={scoutProfile} onSignOut={handleSignOut} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab scoutProfile={scoutProfile} />
          )}
        </main>

        {/* Compare Bar */}
        <CompareBar
          compareList={compareList}
          onRemove={uid => setCompareList(p => p.filter(a => a.uid !== uid))}
          onCompare={() => setActiveTab('compare')}
          onClear={() => setCompareList([])}
          bottomOffset={bottomNavHeight}
        />

        {/* Mobile bottom nav — primary 4 tabs + "More" */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111827]/95 backdrop-blur border-t border-[#1E293B]">
          <div className="grid grid-cols-5 h-16">
            {BOTTOM_NAV_TABS.map(tabId => {
              const tab = TABS.find(t => t.id === tabId)!;
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                    isActive ? 'text-[#00C853]' : 'text-[#94A3B8]'
                  )}
                >
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#00C853] rounded-full" />}
                  <div className="relative">
                    <tab.icon className={cn('w-5 h-5 transition-transform', isActive && 'scale-110')} />
                    {tabId === 'compare' && compareList.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-[#00C853] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">{compareList.length}</span>
                    )}
                  </div>
                  <span className={cn('text-[9px] leading-tight font-bold', isActive && 'font-black')}>
                    {tab.short}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 text-[#94A3B8]"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[9px] font-bold">More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
