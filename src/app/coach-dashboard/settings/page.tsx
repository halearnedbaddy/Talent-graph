'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Settings, User, Lock, Bell, Loader2, CheckCircle2, LogOut, Camera, Upload, AlertCircle } from 'lucide-react';
import { useCoachClub } from '@/app/coach-dashboard/coach-context';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { compressImage, type UploadProgress } from '@/firebase/storage';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

export default function CoachSettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUpload, setPhotoUpload] = useState<UploadProgress | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoDragOver, setPhotoDragOver] = useState(false);

  const { clubName, membershipsLoaded } = useCoachClub();
  const membership = membershipsLoaded ? { clubName } : null;

  useEffect(() => {
    if (!firestore || !user) return;
    getDoc(doc(firestore, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        if (snap.data().photoUrl) setPhotoPreview(snap.data().photoUrl);
        setPhone(snap.data().phone ?? '');
      }
    });
  }, [firestore, user]);

  const handlePhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image under 15 MB.' });
      return;
    }
    if (!user || !firestore) return;

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setIsCompressingPhoto(true);
    setPhotoUpload(null);

    try {
      const compressed = await compressImage(file, 400, 0.82);
      setIsCompressingPhoto(false);
      setPhotoUpload({ progress: 40, state: 'running' });

      const dataUrl = await blobToBase64(compressed);
      setPhotoUpload({ progress: 80, state: 'running' });

      await updateDoc(doc(firestore, 'users', user.uid), {
        photoUrl: dataUrl,
        updatedAt: new Date().toISOString(),
      });

      URL.revokeObjectURL(previewUrl);
      setPhotoUpload({ progress: 100, state: 'success', downloadUrl: dataUrl });
      setPhotoPreview(dataUrl);
      toast({ title: 'Photo saved!', description: 'Your profile photo has been updated.' });
    } catch (err: any) {
      setIsCompressingPhoto(false);
      setPhotoUpload({ progress: 0, state: 'error', error: err.message });
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handlePhotoFile(file);
    e.target.value = '';
  };

  const handlePhotoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPhotoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handlePhotoFile(file);
  };

  const handleUpdateProfile = async () => {
    if (!user || !displayName.trim() || !firestore) return;
    setSaving(true);
    try {
      await Promise.all([
        updateProfile(user, { displayName }),
        updateDoc(doc(firestore, 'users', user.uid), {
          displayName,
          ...(phone ? { phone } : { phone: null }),
          updatedAt: new Date().toISOString(),
        }),
      ]);
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
          {/* Photo drop zone */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
            onDragLeave={() => setPhotoDragOver(false)}
            onDrop={handlePhotoDrop}
            disabled={isCompressingPhoto || photoUpload?.state === 'running'}
            className={`w-full border-2 border-dashed rounded-xl p-4 flex items-center gap-4 transition-all text-left
              ${photoDragOver ? 'border-[#00C853] bg-[#00C853]/10 scale-[1.01]' : 'border-[#1E293B] hover:border-[#00C853]/50 hover:bg-[#1C2333]'}
              ${isCompressingPhoto || photoUpload?.state === 'running' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16 rounded-2xl">
                <AvatarImage src={photoPreview} className="object-cover" />
                <AvatarFallback className="rounded-2xl bg-[#1C2333] text-[#94A3B8] text-xl font-black">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1.5 -right-1.5 bg-[#00C853] text-black rounded-full p-1 shadow-lg">
                <Camera className="w-3 h-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-black text-white text-sm">{user?.displayName || 'Coach'}</p>
              {(isCompressingPhoto || photoUpload?.state === 'running') ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#94A3B8]">
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {isCompressingPhoto ? 'Compressing…' : 'Saving…'}
                    </span>
                    <span>{isCompressingPhoto ? '—' : `${photoUpload?.progress ?? 0}%`}</span>
                  </div>
                  <Progress value={isCompressingPhoto ? undefined : photoUpload?.progress} className="h-1 bg-[#1E293B] [&>div]:bg-[#00C853]" />
                </div>
              ) : photoUpload?.state === 'success' ? (
                <p className="flex items-center gap-1.5 text-[#00C853] text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Photo saved!
                </p>
              ) : photoUpload?.state === 'error' ? (
                <p className="flex items-center gap-1.5 text-red-400 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {photoUpload.error}
                </p>
              ) : (
                <p className="text-[11px] text-[#94A3B8]">
                  {photoDragOver ? 'Drop your photo here' : 'Click or drag to upload a profile photo'}
                </p>
              )}
            </div>
          </button>

          <div className="flex gap-2">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-black text-[8px]">Coach</Badge>
            {membership?.clubName && (
              <Badge className="bg-[#1C2333] text-[#94A3B8] border-[#1E293B] font-black text-[8px]">{membership.clubName}</Badge>
            )}
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

          <div className="space-y-1">
            <Label className="text-[10px] font-black text-[#94A3B8] uppercase flex items-center gap-1.5">
              Phone Number <span className="font-normal normal-case text-[#4B5563]">(optional — for SMS)</span>
            </Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="bg-[#1C2333] border-[#1E293B] text-white placeholder:text-[#4B5563] focus:border-[#00C853]"
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
