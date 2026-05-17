'use client';
import Link from 'next/link';
import {
  Users,
  Home,
  LogOut,
  BarChart,
  Menu,
  Zap,
  MessageSquareShare,
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
  { href: '/club-dashboard/athletes', label: 'Squad', icon: Users },
  { href: '/club-dashboard/requests', label: 'Requests', icon: UserCheck, pendingBadge: true },
  { href: '/club-dashboard/scouts', label: 'Staff', icon: UserPlus },
  { href: '/club-dashboard/squad-chat', label: 'Chat', icon: MessageSquare },
  { href: '/club-dashboard/matches', label: 'Matches', icon: Trophy },
  { href: '/club-dashboard/live-match', label: 'Live', icon: Radio, badge: 'LIVE' },
  { href: '/club-dashboard/practices', label: 'Training', icon: Activity },
  { href: '/club-dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/club-dashboard/stats', label: 'Stats', icon: BarChart },
  { href: '/club-dashboard/verification', label: 'Verify', icon: ClipboardCheck },
  { href: '/club-dashboard/messages', label: 'Network', icon: MessageSquareShare },
  { href: '/club-dashboard/notifications', label: 'Alerts', icon: Bell },
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
    const unsub = onSnapshot(
      collection(firestore, 'clubs', clubId, 'pendingMembers'),
      (snap) => setPendingCount(snap.size),
      () => setPendingCount(0)
    );
    return () => unsub();
  }, [firestore, clubId]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const currentLabel = navItems.find(item => item.href === pathname)?.label || 'Dashboard';

  const SidebarNavLinks = () => (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            pathname === item.href && 'bg-muted text-primary'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
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
  );

  return (
    <div className="grid min-h-screen w-full overflow-x-hidden md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Zap className="h-6 w-6 text-primary" />
              <span>Club Admin</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <SidebarNavLinks />
          </div>
          <div className="mt-auto p-4 border-t space-y-2">
            <PushNotificationToggle clubId={clubId} userId={user?.uid} />
            <SupportDialog />
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Content Column ── */}
      <div className="flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 md:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base font-black uppercase tracking-tight truncate">{currentLabel}</h1>
          </div>

          {/* "More" drawer trigger */}
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

        {/* Page Content */}
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4 lg:gap-6 lg:p-6 overflow-x-hidden bg-muted/10">
          <PushNotificationPrompt clubId={clubId} userId={user?.uid} />
          {children}
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
