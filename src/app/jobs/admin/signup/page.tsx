'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  adminKey: z.string().min(1, 'A departmental entry key is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// For the prototype, we use a hardcoded key. 
const VALID_ADMIN_KEY = 'VV-ADMIN-2025';

export default function AdminSignupPage() {
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
      adminKey: "" 
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.adminKey !== VALID_ADMIN_KEY) {
      form.setError('adminKey', { 
        type: 'manual', 
        message: 'Invalid department entry key. Please contact the system administrator.' 
      });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${values.firstName} ${values.lastName}`.trim(),
      });

      await sendEmailVerification(user);

      // Create internal profiles
      const now = new Date().toISOString();
      await setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        email: user.email,
        firstName: values.firstName,
        lastName: values.lastName,
        role: 'admin',
        isEmailVerified: false,
        profileCompleted: true,
        createdAt: now,
      });

      await setDoc(doc(firestore, "admins", user.uid), {
        uid: user.uid,
        department: "Platform Operations",
        accessLevel: 1,
        createdAt: now,
      });

      toast({
        title: "Account Initialized",
        description: "Please verify your professional email to continue.",
      });
      
      router.push('/jobs/admin/verify-email');

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not create admin account.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-sm items-center">
        <Card className="w-full overflow-hidden border-border/60 bg-background/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-primary via-amber-400 to-cyan-400" />
          <CardHeader className="space-y-5 p-6 pb-4">
            <div className="flex items-center justify-start">
              <Button variant="ghost" size="icon" asChild className="-ml-2 h-10 w-10 rounded-full">
                <Link href="/jobs" prefetch={false}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to jobs</span>
                </Link>
              </Button>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-3xl font-black tracking-tight">Admin Registration</CardTitle>
              <CardDescription className="mx-auto max-w-[18rem] text-sm leading-6">
                Enter your details in a premium, app-like onboarding screen designed for clarity.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">First</FormLabel><FormControl><Input className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Last</FormLabel><FormControl><Input className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Professional Email</FormLabel><FormControl><Input placeholder="admin@vervevigor.co" className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Secure Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input type={showPassword ? "text" : "password"} className="h-12 rounded-2xl bg-muted/40 pr-10" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Confirm Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input type={showConfirmPassword ? "text" : "password"} className="h-12 rounded-2xl bg-muted/40 pr-10" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="adminKey" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Department Entry Key</FormLabel>
                  <FormControl><Input placeholder="VV-ADMIN-XXXX" className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl>
                  <FormDescription>Required for administrative clearance.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize Account
              </Button>
            </form>
          </Form>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Already registered? <Link href="/jobs/admin/login" className="font-bold text-primary">Sign In</Link>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
