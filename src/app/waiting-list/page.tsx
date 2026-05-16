'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const formSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email(),
  primarySport: z.string().min(1, 'Primary sport is required.'),
  position: z.string().optional(),
  team: z.string().optional(),
  age: z.coerce.number().min(10, 'Must be at least 10').max(99, 'Must be 99 or younger'),
  heightCm: z.coerce.number().optional(),
  weightKg: z.coerce.number().optional(),
  username: z.string().optional(),
  notes: z.string().optional(),
});

type HeightUnit = 'cm' | 'ft-in';
type WeightUnit = 'kg' | 'lbs';

export default function WaitingListPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  
  const waitingListDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'waiting_list', user.uid) : null), [firestore, user?.uid]);
  const { data: waitingListEntry, isLoading: isWaitingListLoading } = useDoc<any>(waitingListDocRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      primarySport: '',
      age: undefined,
      position: '',
      team: '',
      username: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isUserLoading || isWaitingListLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    if (waitingListEntry) {
      setIsSubmitted(true);
    } else {
      form.reset({
        name: user.displayName || '',
        email: user.email || '',
      });
    }
  }, [user, isUserLoading, waitingListEntry, isWaitingListLoading, router, form]);


  useEffect(() => {
    const feet = parseFloat(heightFt);
    const inches = parseFloat(heightIn);
    if (!isNaN(feet) || !isNaN(inches)) {
      const totalCm = (feet || 0) * 30.48 + (inches || 0) * 2.54;
      form.setValue('heightCm', totalCm);
    }
  }, [heightFt, heightIn, form]);

  useEffect(() => {
    const lbs = parseFloat(weightLbs);
    if (!isNaN(lbs)) {
      form.setValue('weightKg', lbs * 0.453592);
    }
  }, [weightLbs, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) return;
    setIsLoading(true);

    const waitingListRef = doc(firestore, 'waiting_list', user.uid);
    const userRef = doc(firestore, 'users', user.uid);

    const data: { [key: string]: any } = {
      uid: user.uid,
      name: values.name,
      email: values.email,
      primarySport: values.primarySport,
      age: values.age,
      createdAt: new Date().toISOString(),
      notified: false,
    };

    if (values.position) data.position = values.position;
    if (values.team) data.team = values.team;
    if (values.heightCm && !isNaN(values.heightCm)) data.heightCm = Math.round(values.heightCm);
    if (values.weightKg && !isNaN(values.weightKg)) data.weightKg = Math.round(values.weightKg);
    if (values.username) data.username = values.username;
    if (values.notes) data.notes = values.notes;

    setDocumentNonBlocking(waitingListRef, data, {});
    setDocumentNonBlocking(userRef, { onboardingStep: 'waiting_list', updatedAt: new Date().toISOString() }, { merge: true });

    setIsLoading(false);
    setIsSubmitted(true);
  };
  
  const handleSignOutAndRedirect = async () => {
    await signOut(auth);
    router.push('/');
  };

  const pageIsLoading = isUserLoading || isWaitingListLoading;
  if (pageIsLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
        <div className="max-w-md">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h1 className="text-3xl font-bold mb-4">Thanks for joining!</h1>
          <p className="text-muted-foreground mb-8">
            We've received your information. We'll notify <span className="font-semibold text-foreground">{user?.email}</span> as soon as your sport is added to Talent Graph.
          </p>
          <Button onClick={handleSignOutAndRedirect}>
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            <Mail className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl md:text-3xl">Join the Waiting List</CardTitle>
          </div>
          <CardDescription>
            We currently support Football, Basketball, and Sprinting. Don’t worry — we’re expanding! Fill out your details and we’ll notify you when your sport is added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} readOnly /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="primarySport" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Sport</FormLabel>
                    <FormControl><Input placeholder="e.g., Volleyball, Hockey" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl><Input type="number" placeholder="18" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position / Role (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Setter, Defenseman" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="team" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Team (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g., National Team, Local Club" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <FormItem>
                  <FormLabel>Height (Optional)</FormLabel>
                  <div className="flex items-center gap-4">
                    {heightUnit === 'cm' ? (
                      <div className="relative flex-1">
                        <Input type="number" placeholder="180" onChange={e => form.setValue('heightCm', e.target.value as any)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">cm</span>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-1">
                        <div className="relative flex-1">
                          <Input type="number" placeholder="5" value={heightFt} onChange={e => setHeightFt(e.target.value)} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">ft</span>
                        </div>
                        <div className="relative flex-1">
                          <Input type="number" placeholder="11" value={heightIn} onChange={e => setHeightIn(e.target.value)} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">in</span>
                        </div>
                      </div>
                    )}
                    <RadioGroup defaultValue="cm" onValueChange={(v: HeightUnit) => setHeightUnit(v)} className="flex">
                      <FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="cm" id="cm" /></FormControl><FormLabel htmlFor="cm" className="font-normal">cm</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="ft-in" id="ft-in" /></FormControl><FormLabel htmlFor="ft-in" className="font-normal">ft/in</FormLabel></FormItem>
                    </RadioGroup>
                  </div>
                </FormItem>
                <FormItem>
                  <FormLabel>Weight (Optional)</FormLabel>
                  <div className="flex items-center gap-4">
                    {weightUnit === 'kg' ? (
                      <div className="relative flex-1">
                        <Input type="number" placeholder="75" onChange={e => form.setValue('weightKg', e.target.value as any)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
                      </div>
                    ) : (
                      <div className="relative flex-1">
                        <Input type="number" placeholder="165" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">lbs</span>
                      </div>
                    )}
                     <RadioGroup defaultValue="kg" onValueChange={(v: WeightUnit) => setWeightUnit(v)} className="flex">
                      <FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="kg" id="kg" /></FormControl><FormLabel htmlFor="kg" className="font-normal">kg</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="lbs" id="lbs" /></FormControl><FormLabel htmlFor="lbs" className="font-normal">lbs</FormLabel></FormItem>
                    </RadioGroup>
                  </div>
                </FormItem>
              </div>

              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username (Optional)</FormLabel>
                  <FormControl><Input placeholder="your_public_handle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Achievements, highlight links, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join Waiting List
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
