'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, User, Lock, Bell, Loader2, CheckCircle2, LogOut } from 'lucide-react';
import type { ClubMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function CoachSettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid))
      : null
  ), [firestore, user]);
  const { data: memberships } = useCollection<ClubMember>(memberQuery);
  const membership = memberships?.[0];

  const handleUpdateProfile = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName });
      toast({ title: 'Profile Updated ✓' });
    } catch {
      toast({ title: 'Error updating profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email || !currentPassword || !newPassword) return;
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast({ title: 'Password Updated ✓' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message ?? 'Could not update password',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'C';

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase">Settings</h1>
        <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
          Account · Security
        </p>
      </div>

      {/* Profile card */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
            <User className="h-4 w-4 text-[#00C853]" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 rounded-2xl">
              <AvatarFallback className="rounded-2xl bg-[#1C2333] text-[#94A3B8] text-xl font-black">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-black text-white">{user?.displayName || 'Coach'}</p>
              <p className="text-[11px] text-[#94A3B8]">{user?.email}</p>
              <div className="flex gap-2 mt-1">
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-black text-[8px]">Coach</Badge>
                {membership?.clubName && (
                  <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">{membership.clubName}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Display Name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Email</Label>
            <Input
              value={user?.email ?? ''}
              disabled
              className="bg-[#1C2333] border-[#1E293B] text-[#94A3B8] cursor-not-allowed"
            />
          </div>

          <Button
            onClick={handleUpdateProfile}
            disabled={saving || !displayName.trim()}
            className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Update Profile
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="border border-[#1E293B] bg-[#111827]">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#00C853]" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase">Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-[#1C2333] border-[#1E293B] text-white focus:border-[#00C853]"
            />
          </div>
          <Button
            onClick={handleUpdatePassword}
            disabled={saving || !currentPassword || !newPassword || newPassword.length < 6}
            className="w-full bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black text-[10px] uppercase gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button
        variant="outline"
        onClick={async () => { await signOut(auth); router.push('/login'); }}
        className="w-full border-red-500/30 text-red-400 hover:bg-red-400/10 font-black uppercase text-[10px] gap-2"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
