'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck, BarChart3, Users, Trophy } from 'lucide-react';
import Image from 'next/image';
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
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { doc, getDoc } from 'firebase/firestore';
import { UserAccount } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { trackEvent } from '@/lib/analytics';


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
    
    setDocumentNonBlocking(userDocRef, { loginHistory: newLoginHistory }, { merge: true });

  } catch (error) {
    console.error("Error recording login:", error);
  }
};

const features = [
  { icon: BarChart3, text: 'Composite Scouting Index for every athlete' },
  { icon: Users, text: 'Connect scouts, clubs, and athletes in one platform' },
  { icon: Trophy, text: 'Verified match data and performance tracking' },
];

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
        const userDocRef = doc(firestore, "users", user.uid);
        getDoc(userDocRef).then((snap) => {
          const data = snap.data() as UserAccount | undefined;
          router.push(data?.role === 'coach' ? '/coach-dashboard' : data?.role === 'scout' ? '/scout-dashboard' : '/');
        }).catch(() => {
          router.push('/');
        });
      } else {
        router.push('/verify-email');
      }
    }
  }, [user, isUserLoading, router, firestore]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      await recordLogin(firestore, userCredential.user);
      trackEvent('login', { method: 'email' });
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
    <div className="min-h-screen md:grid md:grid-cols-2">

      {/* ── Left panel: branding (desktop only) ── */}
      <div className="hidden md:flex flex-col justify-between bg-neutral-950 text-white p-10 relative overflow-hidden">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        {/* Gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-primary/20 to-transparent" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <Image src="/icons/logo-transparent.png" alt="Talent Graph" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-black tracking-tight">Talent Graph</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-black tracking-tight leading-tight">
              The intelligence<br />layer for sport.
            </h2>
            <p className="mt-3 text-neutral-400 text-base leading-relaxed max-w-sm">
              A verified recruitment platform connecting athletes, scouts and clubs worldwide.
            </p>
          </div>

          <div className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-neutral-300 font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-neutral-600 font-medium">© 2026 Talent Graph</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex min-h-screen md:min-h-0 items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-8 md:p-10">
        <div className="w-full max-w-sm">

          {/* Mobile back button */}
          <div className="mb-4 md:hidden">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10 rounded-full -ml-2">
              <Link href="/" prefetch={false}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          <Card className="w-full overflow-hidden border-border/60 bg-background/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="h-1.5 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
            <CardHeader className="space-y-4 p-6 pb-4">
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight">Sign In</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Welcome back. Continue your scouting journey.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6 pt-0">
              <div className="space-y-3">
                <GoogleAuthButton mode="login" />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground font-medium">or continue with email</span>
                </div>
              </div>
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
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-bold text-primary">
                  Create one
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Desktop back link */}
          <p className="hidden md:block mt-4 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
