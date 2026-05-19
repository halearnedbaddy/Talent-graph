'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { 
  signInWithEmailAndPassword,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserAccount } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const recordLogin = async (firestore: any, user: User) => {
  const userDocRef = doc(firestore, "users", user.uid);
  try {
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data() as UserAccount;
    const now = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));

    const newLoginHistory = (userData?.loginHistory || [])
      .map(ts => new Date(ts))
      .filter(date => date >= thirtyDaysAgo)
      .map(date => date.toISOString());

    newLoginHistory.push(now.toISOString());
    
    // Non-blocking update
    setDocumentNonBlocking(userDocRef, { loginHistory: newLoginHistory }, { merge: true });

  } catch (error) {
    console.error("Error recording login:", error);
    // Don't block login flow for this
  }
};

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    }
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      if (user.emailVerified) {
        router.push('/');
      } else {
        router.push('/verify-email');
      }
    }
  }, [user, isUserLoading, router]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      await recordLogin(firestore, userCredential.user);
      // Let the useEffect handle redirection
    } catch (error: any) {
      let message = "An unexpected error occurred.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-sm items-center">
        <Card className="w-full overflow-hidden border-border/60 bg-background/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
          <CardHeader className="space-y-5 p-6 pb-4">
            <div className="flex items-center justify-start">
              <Button variant="ghost" size="icon" asChild className="-ml-2 h-10 w-10 rounded-full">
                <Link href="/" prefetch={false}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to home</span>
                </Link>
              </Button>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-3xl font-black tracking-tight">Sign In</CardTitle>
              <CardDescription className="mx-auto max-w-[18rem] text-sm leading-6">
                Welcome back. Continue your scouting journey with a clean, app-like experience.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" className="h-12 rounded-2xl bg-muted/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Password</FormLabel>
                       <Link href="/forgot-password" className="text-xs font-bold text-primary">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          className="h-12 rounded-2xl bg-muted/40 pr-10"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>

          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="font-bold text-primary">
              Create one
            </Link>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
