'use client';

import Link from 'next/link';
import {
  Home, Users, Trophy, BarChart3, MessageSquare,
  Settings, LogOut, Menu, X, Radio, FileText, ChevronRight
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ClubMember } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { href: '/analyst-dashboard', label: 'Overview', icon: Home, exact: true },
  { href: '/analyst-dashboard/squad', label: 'Squad View', icon: Users },
  { href: '/analyst-dashboard/matches', label: 'Match Entry', icon: Trophy },
  { href: '/analyst-dashboard/analytics', label: 'Performance Analytics', icon: BarChart3 },
  { href: '/analyst-dashboard/messages', label: 'Communications', icon: MessageSquare },
];

export default function AnalystDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const memberQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const membership = memberships?.[0];
  const clubName = membership?.clubName ?? 'Club';

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? 'A').toUpperCase();

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-[#0A0E1A] text-white w-64">
      <div className="px-5 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#00C853]/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#00C853]" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-[#00C853] uppercase tracking-widest">Analyst Portal</p>
            <p className="text-xs font-black truncate">{clubName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group',
                active
                  ? 'bg-[#00C853]/15 text-[#00C853]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-[#00C853]' : 'text-white/40 group-hover:text-white')} />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-[#00C853]" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 shrink-0 space-y-1 border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-[#00C853]/20 text-[#00C853] text-xs font-black">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black truncate">{user?.displayName || user?.email}</p>
            <p className="text-[9px] font-bold text-[#00C853] uppercase tracking-widest">Analyst</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:bg-white/5 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00C853]" />
            <span className="font-black text-sm uppercase tracking-widest">Analyst Portal</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
