
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { MailCheck, Loader2, LogOut, RefreshCw, Send, ShieldAlert } from 'lucide-react';

export default function AdminVerifyEmailPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user) {
        router.push('/jobs/admin/login');
      } else if (user.emailVerified) {
        router.push('/jobs/admin/dashboard');
      }
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (user && !isSending && cooldown === 0) {
      setIsSending(true);
      try {
        await sendEmailVerification(user);
        toast({
          title: 'Success',
          description: 'Verification email sent. Please check your professional inbox.',
        });
        setCooldown(30);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to send verification email.',
        });
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleCheckVerification = async () => {
    if (user && firestore) {
      setIsChecking(true);
      await user.reload();
      const updatedUser = auth.currentUser;
      
      if (updatedUser?.emailVerified) {
        // Sync with Firestore
        const userDocRef = doc(firestore, 'users', updatedUser.uid);
        await updateDoc(userDocRef, { 
          isEmailVerified: true,
          updatedAt: new Date().toISOString()
        });

        toast({
          title: 'Identity Verified',
          description: 'Welcome to the Platform Operations team.',
        });
        router.push('/jobs/admin/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Not Verified',
          description: 'Identity verification pending. Please check your inbox.',
        });
      }
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/jobs/admin/login');
  };

  if (isUserLoading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-lg mx-4 shadow-xl border-orange-500/20">
        <CardHeader className="text-center">
          <div className="mx-auto bg-orange-500 text-white p-3 rounded-full w-fit">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold">Admin Identity Verification</CardTitle>
          <CardDescription>
            You are attempting to access high-level platform controls. Please verify your professional email <span className="font-semibold text-foreground">{user.email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800">
            <AlertDescription className="text-center font-medium">
              Access to command center is restricted until identity is confirmed.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button onClick={handleResendEmail} disabled={isSending || cooldown > 0} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {cooldown > 0 ? `Retry in ${cooldown}s` : 'Resend Verification'}
            </Button>
            <Button onClick={handleCheckVerification} disabled={isChecking} variant="secondary" className="w-full">
              {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              I’ve Verified My Email
            </Button>
          </div>

          <div className="text-center">
             <Button onClick={handleSignOut} variant="link" className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" />
                Return to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
