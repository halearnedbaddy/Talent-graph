'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, EyeOff, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-sm items-center">
        <Card className="w-full overflow-hidden border-border/60 bg-background/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-primary via-fuchsia-400 to-cyan-400" />
          <CardHeader className="space-y-5 p-6 pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" asChild className="-ml-2 h-10 w-10 rounded-full">
                <Link href="/" prefetch={false}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to home</span>
                </Link>
              </Button>
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                <Smartphone className="h-3.5 w-3.5" />
                App Style
              </div>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-3xl font-black tracking-tight">Create your account</CardTitle>
              <CardDescription className="mx-auto max-w-[18rem] text-sm leading-6">
                Build a verified professional identity in sport with a premium mobile-first flow.
              </CardDescription>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['Quick setup', 'Verified profile', 'Built for mobile'].map((item) => (
                <div key={item} className="rounded-2xl border border-border/60 bg-muted/40 px-2 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item}</p>
                </div>
              ))}
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
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
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
                        <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
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
            <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Already started?
            </div>
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-primary">
              Sign in
            </Link>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
