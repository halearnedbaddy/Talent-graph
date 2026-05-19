'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function AdminLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      if (!userCredential.user.emailVerified) {
        router.push('/jobs/admin/verify-email');
      } else {
        router.push('/jobs/admin/dashboard');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid admin credentials or account does not exist.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-sm items-center">
        <Card className="w-full overflow-hidden border-border/60 bg-background/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-primary via-amber-400 to-rose-400" />
          <CardHeader className="space-y-5 p-6 pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" asChild className="-ml-2 h-10 w-10 rounded-full">
                <Link href="/jobs" prefetch={false}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to jobs</span>
                </Link>
              </Button>
              <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-600">
                <Smartphone className="h-3.5 w-3.5" />
                Secure
              </div>
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-3xl font-black tracking-tight">Admin Sign In</CardTitle>
              <CardDescription className="mx-auto max-w-[18rem] text-sm leading-6">Authorized access only. Built for a polished mobile command-center feel.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Email</FormLabel><FormControl><Input placeholder="admin@vervevigor.com" className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Password</FormLabel><FormControl><Input type="password" className="h-12 rounded-2xl bg-muted/40" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In to Command Center
              </Button>
            </form>
          </Form>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Need an account? <Link href="/jobs/admin/signup" className="font-bold text-primary">Apply Here</Link>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
