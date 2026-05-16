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
import { MailCheck, Loader2, LogOut, RefreshCw, Send } from 'lucide-react';

export default function VerifyEmailPage() {
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
        router.push('/login');
      } else if (user.emailVerified) {
        router.push('/');
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
          description: 'Verification email sent. Please check your inbox.',
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
          title: 'Email Verified',
          description: 'Your account is now fully active.',
        });
        router.push('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Not Verified',
          description: 'Email not verified yet. Please check your inbox.',
        });
      }
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (isUserLoading || !user || (user && user.emailVerified)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-lg mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-full">
            <MailCheck className="h-8 w-8" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold">Verify your email</CardTitle>
          <CardDescription>
            A verification link has been sent to <span className="font-semibold text-foreground">{user.email}</span>.
            To continue, please open the link in the email we just sent you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="text-center">
              Didn’t receive the email? Check your Spam or Promotions folder, or resend the link below.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button onClick={handleResendEmail} disabled={isSending || cooldown > 0} className="w-full">
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </Button>
            <Button onClick={handleCheckVerification} disabled={isChecking} variant="secondary" className="w-full">
              {isChecking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              I’ve verified my email
            </Button>
          </div>

          <div className="text-center">
             <Button onClick={handleSignOut} variant="link" className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
