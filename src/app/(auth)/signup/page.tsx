'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck, TrendingUp, Globe, Star } from 'lucide-react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  updateProfile
} from 'firebase/auth';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';

const formSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms of Use and Privacy Policy.",
  }),
  subscribeToEmails: z.boolean().default(false).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"]
});

const benefits = [
  { icon: TrendingUp, text: 'Build a verified performance profile that scouts trust' },
  { icon: Globe, text: 'Reach clubs and scouts across Kenya from one place' },
  { icon: Star, text: 'Get discovered through the Talent Call marketplace' },
];

export default function SignupPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
      subscribeToEmails: false,
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
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, {
        displayName: `${values.firstName} ${values.lastName}`.trim(),
      });

      await sendEmailVerification(newUser);

      const userDocRef = doc(firestore, "users", newUser.uid);
      setDocumentNonBlocking(userDocRef, {
        id: newUser.uid,
        email: newUser.email,
        firstName: values.firstName,
        lastName: values.lastName,
        creationTimestamp: new Date().toISOString(),
        isEmailVerified: false,
        subscribeToEmails: values.subscribeToEmails ?? false,
      }, { merge: true });

      toast({
        title: "Verification link sent!",
        description: "A verification link has been sent to your email.",
      });
      router.push('/verify-email');

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        form.setError("email", { type: "manual", message: "This email is already in use." });
      } else {
         toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: error.message || "Could not create account.",
        });
      }
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
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
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
              Your career starts<br />with your data.
            </h2>
            <p className="mt-3 text-neutral-400 text-base leading-relaxed max-w-sm">
              Join thousands of athletes, scouts, and clubs building the future of sport recruitment worldwide.
            </p>
          </div>

          <div className="space-y-4">
            {benefits.map(({ icon: Icon, text }) => (
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
      <div className="flex min-h-screen md:min-h-0 items-start justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-6 md:overflow-y-auto md:p-10">
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
            <div className="h-1.5 bg-gradient-to-r from-primary via-fuchsia-400 to-cyan-400" />
            <CardHeader className="space-y-4 p-6 pb-4">
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight">Create your account</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Build a verified professional identity in sport.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6 pt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">First</FormLabel>
                          <FormControl>
                            <Input placeholder="John" className="h-12 rounded-2xl bg-muted/40" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Last</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" className="h-12 rounded-2xl bg-muted/40" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Email address</FormLabel>
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
                        <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Password</FormLabel>
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
                            <span className="sr-only">{showPassword ? 'Hide' : 'Show'} password</span>
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Confirm password</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              className="h-12 rounded-2xl bg-muted/40 pr-10"
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            <span className="sr-only">{showConfirmPassword ? 'Hide' : 'Show'} password</span>
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subscribeToEmails"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border border-border/60 bg-muted/30 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Receive promotional emails and updates from Talent Graph.
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agreeToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the{" "}
                            <Link href="/terms-of-use" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                              Terms of Use
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy-policy" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                              Privacy Policy
                            </Link>.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </Form>

              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-sm">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-primary">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="hidden md:block mt-4 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
