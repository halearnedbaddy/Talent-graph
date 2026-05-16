'use client';

import { useState } from 'react';
import type { ScoutProfile, AthleteProfile, ScoutConnection } from '@/lib/types';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { LogOut, User, Eye, BarChart3, Users, Headphones } from 'lucide-react';
import { FilterSidebar } from './filter-sidebar';
import { ResultsList } from './results-list';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { ConnectionsList } from './connections-list';
import { Separator } from '../ui/separator';
import { AdvancedAnalytics } from './advanced-analytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupportDialog } from '@/components/support/support-dialog';

export function ScoutDashboardClient({ scoutProfile }: { scoutProfile: ScoutProfile }) {
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('discovery');

  const [activeFilters, setActiveFilters] = useState({
    sports: scoutProfile.sports || [],
  });

  const athletesQuery = useMemoFirebase(() => {
    if (!firestore || !activeFilters.sports || activeFilters.sports.length === 0) return null;
    return query(
      collection(firestore, 'athletes'), 
      where('sport', 'in', activeFilters.sports)
    );
  }, [firestore, activeFilters.sports]);

  const { data: athletes, isLoading: athletesLoading } = useCollection<AthleteProfile>(athletesQuery);

  const scoutConnectionsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'scout_connections'), where('scoutId', '==', scoutProfile.uid), where('status', '==', 'accepted')) : null
  ), [firestore, scoutProfile.uid]);
  const { data: myConnections } = useCollection<ScoutConnection>(scoutConnectionsQuery);
  const myScoutedIds = new Set(myConnections?.map(c => c.athleteId) || []);
  const scoutedAthletes = athletes?.filter(a => myScoutedIds.has(a.uid)) || [];

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold px-2">Talent Graph</h2>
                <SidebarTrigger />
            </div>
        </SidebarHeader>
        <SidebarContent className="flex flex-col">
           <div className="p-2 space-y-2">
                <Button variant="outline" className="w-full justify-start text-xs h-8" asChild>
                    <Link href={`/scout/${scoutProfile.username}`}>
                        <Eye className="mr-2 h-3 w-3" />
                        View Public Profile
                    </Link>
                </Button>
                <Separator className="bg-sidebar-border" />
                <FilterSidebar 
                    scoutProfile={scoutProfile}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                />
            </div>
            <Separator className="my-2 bg-sidebar-border" />
            <div className="flex-grow p-2">
                <ConnectionsList scoutId={scoutProfile.uid} />
            </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
               <SupportDialog />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Profile Settings" asChild>
                <Link href="/scout-dashboard/profile">
                  <User />
                  <span>My Profile</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="bg-background border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                  <SidebarTrigger className="md:hidden"/>
                  <h1 className="text-xl font-bold tracking-tight">Scout Console</h1>
              </div>
              <Button onClick={handleSignOut} variant="ghost" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between mb-8">
                    <TabsList>
                        <TabsTrigger value="discovery" className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Discovery
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Advanced Analytics
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="discovery">
                    <ResultsList athletes={athletes} isLoading={athletesLoading} />
                </TabsContent>

                <TabsContent value="analytics">
                    <AdvancedAnalytics scoutedAthletes={scoutedAthletes} />
                </TabsContent>
            </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
