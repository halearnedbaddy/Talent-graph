'use client';

import Link from 'next/link';
import {
  Home, Users, ShieldCheck, Trophy, Dumbbell, Calendar,
  BarChart3, MessageSquare, Building2, Settings, LogOut,
  Menu, X, Zap, ChevronRight, Radio, Search
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClubMember, UserAccount } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/coach/notification-bell';
import { useCoachNotifications } from '@/hooks/useCoachNotifications';

const navItems = [
  { href: '/coach-dashboard', label: 'Overview', icon: Home, exact: true },
  { href: '/coach-dashboard/squad', label: 'My Squad', icon: Users },
  { href: '/coach-dashboard/verify', label: 'Verify Athletes', icon: ShieldCheck, pendingBadge: true },
  { href: '/coach-dashboard/match-entry', label: 'Match Entry', icon: Trophy },
  { href: '/coach-dashboard/live-match', label: 'Live Match', icon: Radio },
  { href: '/coach-dashboard/training', label: 'Training & Drills', icon: Dumbbell },
  { href: '/coach-dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/coach-dashboard/analytics', label: 'Performance Analytics', icon: BarChart3 },
  { href: '/coach-dashboard/communications', label: 'Communications', icon: MessageSquare },
  { href: '/coach-dashboard/club', label: 'Club Dashboard', icon: Building2 },
  { href: '/coach-dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/coach-dashboard/find-club', label: 'Find Club', icon: Search, noClubOnly: true },
];

export default function CoachDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const membership = memberships?.[0];
  const clubId = membership?.clubId ?? null;

  const { isUserLoading } = useUser();

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount, isLoading: isAccountLoading } = useDoc<UserAccount>(userDocRef);

  const { notifications, unreadCount, markRead, markAllRead } = useCoachNotifications(
    clubId,
    user?.uid ?? null
  );

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
      return;
    }
    if (!isUserLoading && !isAccountLoading && userAccount) {
      if (userAccount.role === 'scout') {
        router.push('/scout-dashboard');
      } else if (userAccount.role === 'athlete') {
        router.push('/');
      } else if (userAccount.role === 'club') {
        router.push('/club-dashboard/athletes');
      }
    }
  }, [user, isUserLoading, userAccount, isAccountLoading, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'C';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b px-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00C853] shrink-0">
          <Zap className="h-4 w-4 text-black" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-tight truncate text-white">Talent Graph</p>
          <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Coach Pro</p>
        </div>
      </div>

      {/* Coach info */}
      {membership && (
        <div className="px-4 py-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 rounded-xl">
              <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-white truncate">{user?.displayName || user?.email}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] truncate uppercase tracking-wide">{membership.clubName || 'Coach'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-3 px-2 space-y-0.5">
        {navItems.filter(item => !('noClubOnly' in item && item.noClubOnly) || !clubId).map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all',
                active
                  ? 'bg-[#00C853]/15 text-[#00C853]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#1C2333]'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-[#00C853]')} />
              <span className="flex-1 truncate">{item.label}</span>
              {active && <ChevronRight className="h-3 w-3 shrink-0 text-[#00C853]" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#1E293B] p-3 space-y-1 shrink-0">
        <Button
          size="sm" variant="ghost"
          className="w-full justify-start text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 gap-2 h-9 font-semibold"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  const currentLabel = navItems.find(item => isActive(item))?.label || 'Dashboard';

  return (
    <div className="flex min-h-screen w-full bg-[#0A0E1A] text-white">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] border-r border-[#1E293B] bg-[#111827] shrink-0 fixed top-0 left-0 h-screen z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-[280px] bg-[#111827] border-r border-[#1E293B] z-50">
            <SidebarContent />
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

      {/* Main */}
      <div className="flex-1 md:ml-[260px] flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#1E293B] bg-[#111827]/95 backdrop-blur px-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-[#94A3B8]" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-4 w-4 text-[#00C853] shrink-0" />
            <h1 className="text-sm font-black uppercase tracking-tight text-white truncate">{currentLabel}</h1>
          </div>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </header>

        {/* Desktop topbar */}
        <header className="hidden md:flex sticky top-0 z-20 h-13 min-h-[52px] items-center justify-between border-b border-[#1E293B] bg-[#0A0E1A]/95 backdrop-blur px-6 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black uppercase tracking-wider text-white">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-[#1E293B] bg-[#111827]/95 backdrop-blur">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                  active ? 'text-[#00C853]' : 'text-[#94A3B8]'
                )}
              >
                {active && <span className="absolute top-0 w-6 h-0.5 bg-[#00C853] rounded-full" />}
                <item.icon className={cn('h-5 w-5', active && 'scale-110 transition-transform')} />
                <span className={cn('text-[9px] font-bold uppercase tracking-wide', active && 'font-black')}>
                  {item.label.split(' ')[0]}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[#94A3B8]"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
