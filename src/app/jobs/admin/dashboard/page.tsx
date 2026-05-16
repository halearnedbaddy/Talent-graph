'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Flag, MessageSquare, LayoutDashboard, LogOut, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';

import { VerificationManager } from '@/components/admin/verification-manager';
import { ReportManager } from '@/components/admin/report-manager';
import { SupportInbox } from '@/components/admin/support-inbox';
import { WaitingListViewer } from '@/components/admin/waiting-list-viewer';

export default function AdminDashboard() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('overview');

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
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
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Final gate to ensure we don't render or trigger rules for non-admins
  if (!user || !userProfile || userProfile.role !== 'admin' || !user.emailVerified) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b h-16 sticky top-0 z-50">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Platform Command Center</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-bold leading-none">{userProfile.firstName} {userProfile.lastName}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Platform Operations</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

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
                  <Button variant="link" className="p-0 h-auto text-xs mt-2" onClick={() => setActiveTab('verifications')}>Action Required &rarr;</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Waitlist Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-blue-500">LIVE</p>
                  <Button variant="link" className="p-0 h-auto text-xs mt-2" onClick={() => setActiveTab('waiting-list')}>View Entries &rarr;</Button>
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
        </Tabs>
      </main>
    </div>
  );
}