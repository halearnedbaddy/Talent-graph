'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, Flag, MessageSquare, LayoutDashboard, LogOut, Loader2,
  Users, BarChart3, Headphones, Megaphone, ChevronRight, ArrowLeft
} from 'lucide-react';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';

import { VerificationManager } from '@/components/admin/verification-manager';
import { ReportManager } from '@/components/admin/report-manager';
import { SupportInbox } from '@/components/admin/support-inbox';
import { WaitingListViewer } from '@/components/admin/waiting-list-viewer';
import { PlatformAnalytics } from '@/components/admin/platform-analytics';
import { ClientSupportDashboard } from '@/components/admin/support/ClientSupportDashboard';
import { MarketingDashboard } from '@/components/admin/marketing/MarketingDashboard';

type Workspace = 'command' | 'support' | 'marketing';

const WORKSPACES = [
  {
    id: 'command' as Workspace,
    label: 'Command Center',
    description: 'Verifications, reports, platform analytics, waiting list',
    icon: ShieldCheck,
    color: 'from-neutral-900 to-neutral-800',
    badge: 'Core Admin',
  },
  {
    id: 'support' as Workspace,
    label: 'Client Support',
    description: 'Ticket inbox, reply threads, internal notes, SLA tracking',
    icon: Headphones,
    color: 'from-blue-900 to-blue-800',
    badge: 'Support',
  },
  {
    id: 'marketing' as Workspace,
    label: 'Marketing',
    description: 'Campaigns, audience segments, automations, analytics',
    icon: Megaphone,
    color: 'from-purple-900 to-purple-800',
    badge: 'Marketing',
  },
];

function WorkspaceSelector({ onSelect }: { onSelect: (w: Workspace) => void }) {
  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Platform Command</h1>
          <p className="text-muted-foreground mt-2">Select a workspace to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {WORKSPACES.map(ws => (
            <button
              key={ws.id}
              onClick={() => onSelect(ws.id)}
              className="group relative rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className={`bg-gradient-to-br ${ws.color} text-white p-6 h-full`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-white/10 rounded-lg p-2.5">
                    <ws.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-full">
                    {ws.badge}
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight leading-tight mb-2">{ws.label}</h2>
                <p className="text-xs text-white/60 leading-relaxed">{ws.description}</p>
                <div className="mt-5 flex items-center gap-1 text-xs font-bold text-white/80 group-hover:text-white transition-colors">
                  Open workspace <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('overview');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/jobs/admin/login');
  };

  const isLoading = isUserLoading || isProfileLoading;

  useEffect(() => {
    if (!isLoading) {
      if (!user || userProfile?.role !== 'admin') {
        router.push('/jobs/admin/login');
      } else if (!user.emailVerified) {
        router.push('/jobs/admin/verify-email');
      }
    }
  }, [user, userProfile, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile || userProfile.role !== 'admin' || !user.emailVerified) {
    return null;
  }

  const activeWs = WORKSPACES.find(w => w.id === workspace);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-background border-b h-16 sticky top-0 z-50">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {workspace && (
              <Button variant="ghost" size="icon" onClick={() => setWorkspace(null)} className="mr-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              {activeWs ? <activeWs.icon className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none">
                {activeWs ? activeWs.label : 'Platform Command'}
              </h1>
              {workspace && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Admin Dashboard
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-bold leading-none">{userProfile.firstName} {userProfile.lastName}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">
                Platform Admin
              </p>
            </div>
            {workspace && (
              <div className="hidden md:flex gap-1">
                {WORKSPACES.filter(w => w.id !== workspace).map(ws => (
                  <Button
                    key={ws.id}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setWorkspace(ws.id)}
                  >
                    <ws.icon className="w-3.5 h-3.5 mr-1.5" />
                    {ws.label}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      {!workspace ? (
        <WorkspaceSelector onSelect={setWorkspace} />
      ) : workspace === 'support' ? (
        <main className="container mx-auto py-6 px-4">
          <ClientSupportDashboard />
        </main>
      ) : workspace === 'marketing' ? (
        <main className="container mx-auto py-6 px-4">
          <MarketingDashboard />
        </main>
      ) : (
        <main className="container mx-auto py-8 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex items-center justify-between">
              <TabsList className="bg-background border">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" /> Overview
                </TabsTrigger>
                <TabsTrigger value="verifications" className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Verifications
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <Flag className="w-4 h-4" /> Reports
                </TabsTrigger>
                <TabsTrigger value="support" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Support Inbox
                </TabsTrigger>
                <TabsTrigger value="waiting-list" className="flex items-center gap-2">
                  <Users className="w-4 h-4" /> Waiting List
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Analytics
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white border-none">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-neutral-400">System Integrity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black">ACTIVE</p>
                    <p className="text-xs text-neutral-500 mt-2">All systems operational</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Pending Verifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black text-orange-500">REVIEW</p>
                    <Button variant="link" className="p-0 h-auto text-xs mt-2" onClick={() => setActiveTab('verifications')}>
                      Action Required &rarr;
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Waitlist Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black text-blue-500">LIVE</p>
                    <Button variant="link" className="p-0 h-auto text-xs mt-2" onClick={() => setActiveTab('waiting-list')}>
                      View Entries &rarr;
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="verifications">
              <VerificationManager />
            </TabsContent>

            <TabsContent value="reports">
              <ReportManager />
            </TabsContent>

            <TabsContent value="support">
              <SupportInbox />
            </TabsContent>

            <TabsContent value="waiting-list">
              <WaitingListViewer />
            </TabsContent>

            <TabsContent value="analytics">
              <PlatformAnalytics />
            </TabsContent>
          </Tabs>
        </main>
      )}
    </div>
  );
}
