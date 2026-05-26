'use client';
import Link from 'next/link';
import {
  Users,
  Home,
  LogOut,
  BarChart,
  Menu,
  Zap,
  Trophy,
  Calendar,
  Settings,
  ClipboardCheck,
  Activity,
  UserPlus,
  MessageSquare,
  Radio,
  Grid3X3,
  X,
  Bell,
  UserCheck,
  Building2,
  Unlock,
  CreditCard,
  GraduationCap,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { SupportDialog } from '@/components/support/support-dialog';
import { PushNotificationToggle, PushNotificationPrompt } from '@/components/club/push-notification-prompt';
import type { ClubMember } from '@/lib/types';

const navItems = [
  { href: '/club-dashboard', label: 'Overview', icon: Home },
  { href: '/club-dashboard/club-profile', label: 'Club Profile', icon: Building2 },
  { href: '/club-dashboard/athletes', label: 'Squad', icon: Users },
  { href: '/club-dashboard/requests', label: 'Requests', icon: UserCheck, pendingBadge: true },
  { href: '/club-dashboard/coaching-staff', label: 'Coaching Staff', icon: GraduationCap },
  { href: '/club-dashboard/scouts', label: 'Scouts', icon: UserPlus },
  { href: '/club-dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/club-dashboard/matches', label: 'Matches', icon: Trophy },
  { href: '/club-dashboard/live-match', label: 'Live', icon: Radio, badge: 'LIVE' },
  { href: '/club-dashboard/practices', label: 'Training', icon: Activity },
  { href: '/club-dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/club-dashboard/stats', label: 'Stats', icon: BarChart },
  { href: '/club-dashboard/verification', label: 'Verify', icon: ClipboardCheck },
  { href: '/club-dashboard/notifications', label: 'Alerts', icon: Bell },
  { href: '/club-dashboard/trial-unlocks', label: 'Trial Unlocks', icon: Unlock },
  { href: '/club-dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/club-dashboard/settings', label: 'Settings', icon: Settings },
];

const bottomNavItems = navItems.slice(0, 4);

export default function ClubDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);

  const clubMemberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: userMemberships } = useCollection<ClubMember>(clubMemberQuery);
  const clubId = userMemberships?.[0]?.clubId;

  useEffect(() => {
    if (!firestore || !clubId) return;

    let athleteCount = 0;
    let staffCount = 0;

    const unsubAthletes = onSnapshot(
      collection(firestore, 'clubs', clubId, 'pendingMembers'),
      (snap) => { athleteCount = snap.size; setPendingCount(athleteCount + staffCount); },
      () => setPendingCount(staffCount)
    );

    const unsubStaff = onSnapshot(
      query(collection(firestore, 'club_members'), where('clubId', '==', clubId), where('status', '==', 'pending')),
      (snap) => { staffCount = snap.size; setPendingCount(athleteCount + staffCount); },
      () => setPendingCount(athleteCount)
    );

    return () => { unsubAthletes(); unsubStaff(); };
  }, [firestore, clubId]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const currentLabel = navItems.find(item => item.href === pathname)?.label || 'Dashboard';

  const SidebarNavLinks = () => (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-3 space-y-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted/60',
              isActive && 'bg-primary/10 text-primary font-semibold'
            )}
          >
            <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
            <span className="flex-1 truncate">{item.label}</span>
            {(item as any).badge && (
              <Badge className="bg-red-600 text-white font-black text-[8px] px-1.5 py-0 h-4 tracking-wider shrink-0">
                {(item as any).badge}
              </Badge>
            )}
            {(item as any).pendingBadge && pendingCount > 0 && (
              <Badge className="bg-primary text-primary-foreground font-black text-[8px] px-1.5 py-0 h-4 min-w-4 tracking-wider shrink-0">
                {pendingCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="grid min-h-screen w-full overflow-x-hidden md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">

      {/* ── Desktop Sidebar ── */}
      <div className="hidden border-r bg-background md:flex md:flex-col">
        {/* Sidebar header */}
        <div className="flex h-14 items-center gap-2.5 border-b px-5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shrink-0">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight truncate">Talent Graph</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">Club Admin</p>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-auto py-3">
          <SidebarNavLinks />
        </div>

        {/* Sidebar footer */}
        <div className="border-t p-3 space-y-1 shrink-0">
          <PushNotificationToggle clubId={clubId} userId={user?.uid} />
          <SupportDialog />
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive gap-2 h-9"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* ── Main Content Column ── */}
      <div className="flex flex-col min-h-screen overflow-x-hidden">

        {/* ── Mobile Top Header ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 md:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base font-black uppercase tracking-tight truncate">{currentLabel}</h1>
          </div>

          <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <Grid3X3 className="h-5 w-5" />
                <span className="sr-only">More menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col p-0 w-72">
              <SheetHeader className="p-5 border-b text-left">
                <SheetTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-sm">
                  <Zap className="h-5 w-5 text-primary" />
                  Club Admin
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-auto py-3">
                <nav className="px-3 space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-primary active:scale-[0.98]',
                        pathname === item.href && 'bg-primary/10 text-primary'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {(item as any).badge && (
                        <Badge className="bg-red-600 text-white font-black text-[8px] px-1.5 py-0 h-4 tracking-wider">
                          {(item as any).badge}
                        </Badge>
                      )}
                      {(item as any).pendingBadge && pendingCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground font-black text-[8px] px-1.5 py-0 h-4 min-w-4 tracking-wider">
                          {pendingCount}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="p-4 border-t space-y-2">
                <PushNotificationToggle clubId={clubId} userId={user?.uid} />
                <SupportDialog />
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* ── Desktop Content Topbar ── */}
        <header className="hidden md:flex sticky top-0 z-20 h-13 min-h-[52px] items-center justify-between border-b bg-background/95 backdrop-blur-sm px-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-black uppercase tracking-wider text-foreground">{currentLabel}</h1>
            {pendingCount > 0 && pathname !== '/club-dashboard/requests' && (
              <Link href="/club-dashboard/requests">
                <Badge className="bg-primary/15 text-primary border border-primary/30 font-black text-[9px] px-2 h-5 hover:bg-primary/25 transition-colors cursor-pointer">
                  {pendingCount} pending
                </Badge>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link href="/club-dashboard/notifications">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <Bell className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/club-dashboard/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-6 md:p-6 lg:gap-6 lg:p-8 overflow-x-hidden bg-muted/10">
          <div className="w-full max-w-7xl mx-auto">
            <PushNotificationPrompt clubId={clubId} userId={user?.uid} />
            {children}
          </div>
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden h-16 items-stretch border-t bg-background/95 backdrop-blur shadow-[0_-1px_12px_rgba(0,0,0,0.08)]">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
                <item.icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', isActive && 'font-black')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors',
              isMoreOpen && 'text-primary'
            )}
          >
            <Grid3X3 className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
