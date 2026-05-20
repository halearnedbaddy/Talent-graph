'use client';

import { useState } from 'react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface DeleteAccountDialogProps {
  trigger?: React.ReactNode;
  role?: 'athlete' | 'scout' | 'coach' | 'club';
  clubId?: string;
}

export function DeleteAccountDialog({ trigger, role = 'athlete', clubId }: DeleteAccountDialogProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'confirm' | 'reauth'>('confirm');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpen = () => {
    setStep('confirm');
    setConfirmText('');
    setPassword('');
    setOpen(true);
  };

  const deleteFirestoreData = async (uid: string) => {
    // Always clean up common collections
    try { await deleteDoc(doc(firestore, 'users', uid)); } catch {}
    const memberQuery = query(collection(firestore, 'club_members'), where('userId', '==', uid));
    const memberSnap = await getDocs(memberQuery);
    for (const d of memberSnap.docs) {
      try { await deleteDoc(d.ref); } catch {}
    }
    // Role-specific cleanup
    if (role === 'athlete') {
      try { await deleteDoc(doc(firestore, 'athletes', uid)); } catch {}
    } else if (role === 'scout' || role === 'coach') {
      try { await deleteDoc(doc(firestore, 'scouts', uid)); } catch {}
    } else if (role === 'club') {
      // Delete the club document and all club members in the club
      if (clubId) {
        const clubMembersQuery = query(collection(firestore, 'club_members'), where('clubId', '==', clubId));
        const clubMembersSnap = await getDocs(clubMembersQuery);
        for (const d of clubMembersSnap.docs) {
          try { await deleteDoc(d.ref); } catch {}
        }
        try { await deleteDoc(doc(firestore, 'clubs', clubId)); } catch {}
      }
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (confirmText !== 'DELETE') {
      toast({ variant: 'destructive', title: 'Type DELETE to confirm', description: 'You must type DELETE in capitals to confirm.' });
      return;
    }
    setIsDeleting(true);
    try {
      await deleteFirestoreData(user.uid);
      await deleteUser(user);
      toast({ title: 'Account deleted', description: 'Your account has been permanently removed.' });
      setOpen(false);
      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setStep('reauth');
        setIsDeleting(false);
      } else {
        toast({ variant: 'destructive', title: 'Deletion failed', description: err.message || 'Please try again.' });
        setIsDeleting(false);
      }
    }
  };

  const handleReauth = async () => {
    if (!user || !user.email) return;
    setIsDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await deleteFirestoreData(user.uid);
      await deleteUser(user);
      toast({ title: 'Account deleted', description: 'Your account has been permanently removed.' });
      setOpen(false);
      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast({ variant: 'destructive', title: 'Wrong password', description: 'The password you entered is incorrect.' });
      } else {
        toast({ variant: 'destructive', title: 'Deletion failed', description: err.message || 'Please try again.' });
      }
      setIsDeleting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen}>{trigger}</span>
      ) : (
        <Button variant="destructive" size="sm" onClick={handleOpen} className="gap-2 font-black uppercase text-[10px] tracking-widest">
          <Trash2 className="w-4 h-4" /> Delete Account
        </Button>
      )}

      <Dialog open={open} onOpenChange={o => { if (!isDeleting) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-widest">
              <ShieldAlert className="w-5 h-5" />
              {step === 'confirm' ? 'Delete Your Account' : 'Confirm Identity'}
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-5 py-2">
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-black text-destructive">This action is permanent and cannot be undone.</p>
                    <p className="text-muted-foreground">Deleting your account will permanently remove:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-[11px]">
                      {(role === 'athlete') && <>
                        <li>Your athlete profile and all performance data</li>
                        <li>Your match history and statistics</li>
                        <li>Your career history and injury records</li>
                        <li>Your scout connections and messages</li>
                      </>}
                      {(role === 'scout' || role === 'coach') && <>
                        <li>Your scout/coach profile and all data</li>
                        <li>Your club affiliations and connections</li>
                        <li>Your scouting reports and saved athletes</li>
                      </>}
                      {role === 'club' && <>
                        <li>Your club profile and all club data</li>
                        <li>All squad members and their records</li>
                        <li>All match history and practice logs</li>
                        <li>All scout affiliations with the club</li>
                      </>}
                      <li>Your login credentials</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Type <span className="text-destructive font-black">DELETE</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Type DELETE here"
                  className="font-black tracking-widest"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {step === 'reauth' && (
            <div className="space-y-5 py-2">
              <p className="text-sm text-muted-foreground">
                For security, please re-enter your password to permanently delete your account.
              </p>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your current password"
                  className="font-bold"
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleReauth()}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            {step === 'confirm' ? (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || confirmText !== 'DELETE'}
                className="font-black uppercase tracking-widest gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Account
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleReauth}
                disabled={isDeleting || !password}
                className="font-black uppercase tracking-widest gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirm & Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
