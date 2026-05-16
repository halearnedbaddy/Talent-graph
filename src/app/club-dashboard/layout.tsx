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
  Radio
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import type { ClubMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { SupportDialog } from '@/components/support/support-dialog';

export default function ClubDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const navItems = [
    { href: '/club-dashboard', label: 'Overview', icon: Home },
    { href: '/club-dashboard/athletes', label: 'Squad List', icon: Users },
    { href: '/club-dashboard/scouts', label: 'Staff', icon: UserPlus },
    { href: '/club-dashboard/squad-chat', label: 'Squad Chat', icon: MessageSquare },
    { href: '/club-dashboard/matches', label: 'Matches', icon: Trophy },
    { href: '/club-dashboard/live-match', label: 'Live Match', icon: Radio, badge: 'LIVE' },
    { href: '/club-dashboard/practices', label: 'Practices', icon: Activity },
    { href: '/club-dashboard/schedule', label: 'Schedule', icon: Calendar },
    { href: '/club-dashboard/stats', label: 'Stats Hub', icon: BarChart },
    { href: '/club-dashboard/verification', label: 'Verification', icon: ClipboardCheck },
    { href: '/club-dashboard/messages', label: 'Network', icon: MessageSquareShare },
    { href: '/club-dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            pathname === item.href && 'bg-muted text-primary'
          )}
        >
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.label}</span>
          {(item as any).badge && (
            <Badge className="bg-red-600 text-white font-black text-[8px] px-1.5 py-0 h-4 tracking-wider">
              {(item as any).badge}
            </Badge>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Zap className="h-6 w-6 text-primary" />
              <span className="">Club Admin</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <NavLinks />
          </div>
          <div className="mt-auto p-4 border-t space-y-2">
            <SupportDialog />
            <Button size="sm" variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 md:hidden lg:h-[60px] lg:px-6">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-72">
              <SheetHeader className="p-6 border-b text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Zap className="h-6 w-6 text-primary" />
                  <span>Club Admin</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 py-4 overflow-auto">
                <NavLinks onClick={() => setIsMobileMenuOpen(false)} />
              </div>
              <div className="p-4 border-t space-y-2">
                <SupportDialog />
                <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <h1 className="text-lg font-semibold capitalize">
              {navItems.find(item => item.href === pathname)?.label || 'Dashboard'}
            </h1>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  );
}
