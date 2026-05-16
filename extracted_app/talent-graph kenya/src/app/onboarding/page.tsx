
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, User as UserIcon, Building, LogOut, Users, Ruler, Weight, Globe, Mail, Phone, MapPin, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { doc, setDoc, updateDoc, collection, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AthleteProfile, ScoutProfile, ClubProfile, UserAccount } from '@/lib/types';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const RoleSelection = ({ onRoleSelect, isLoading }: { onRoleSelect: (role: 'athlete' | 'scout' | 'club') => void, isLoading: boolean }) => {
  const [selectedRole, setSelectedRole] = useState<'athlete' | 'scout' | 'club' | null>(null);

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold">How will you use Talent Graph?</h1>
        <p className="mt-2 text-lg text-muted-foreground">This helps us tailor the platform to your goals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card
          onClick={() => setSelectedRole('athlete')}
          className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg", selectedRole === 'athlete' ? "ring-2 ring-primary shadow-lg" : "ring-1 ring-border")}
        >
          <CardHeader className="items-center text-center">
            <div className={cn("flex items-center justify-center h-16 w-16 rounded-full bg-secondary mb-4 transition-colors", selectedRole === 'athlete' && "bg-primary text-primary-foreground")}>
              <UserIcon className="h-8 w-8" />
            </div>
            <CardTitle>Athlete</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground px-6 pb-6">
            <p>Build a verified performance profile, track athletic metrics over time, and be discovered by scouts and coaches.</p>
          </CardContent>
        </Card>
        <Card
          onClick={() => setSelectedRole('scout')}
          className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg", selectedRole === 'scout' ? "ring-2 ring-primary shadow-lg" : "ring-1 ring-border")}
        >
          <CardHeader className="items-center text-center">
            <div className={cn("flex items-center justify-center h-16 w-16 rounded-full bg-secondary mb-4 transition-colors", selectedRole === 'scout' && "bg-primary text-primary-foreground")}>
              <UserIcon className="h-8 w-8" />
            </div>
            <CardTitle>Scout / Coach</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground px-6 pb-6">
            <p>Discover and evaluate athletes, track talent progression, and build shortlists and reports.</p>
          </CardContent>
        </Card>
        <Card
          onClick={() => setSelectedRole('club')}
          className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg", selectedRole === 'club' ? "ring-2 ring-primary shadow-lg" : "ring-1 ring-border")}
        >
          <CardHeader className="items-center text-center">
            <div className={cn("flex items-center justify-center h-16 w-16 rounded-full bg-secondary mb-4 transition-colors", selectedRole === 'club' && "bg-primary text-primary-foreground")}>
              <Users className="h-8 w-8" />
            </div>
            <CardTitle>Club / Organization</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground px-6 pb-6">
            <p>Establish your organization's official presence, manage recruitment, and showcase your talent pool.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => selectedRole && onRoleSelect(selectedRole)} disabled={!selectedRole || isLoading} className="w-full md:w-auto">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
};

// --- ATHLETE FORM ---

const athleteFormSchema = z.object({
  sport: z.enum(['football', 'basketball', 'sprinting', 'other'], { required_error: 'Primary sport is required.' }),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say'], { required_error: 'Gender selection is required.' }),
  position: z.string().optional(),
  team: z.string().optional(),
  age: z.coerce.number().min(10, "Must be at least 10").max(60, "Must be 60 or younger"),
  heightCm: z.coerce.number().min(50, "Please enter a valid height").max(250, "Please enter a valid height"),
  weightKg: z.coerce.number().min(20, "Please enter a valid weight").max(250, "Please enter a valid weight"),
  dominantFoot: z.enum(['Left', 'Right', 'Both']).optional(),
  minutesPlayed: z.coerce.number().min(0, "Cannot be negative").default(0).optional(),
  leagueLevel: z.string().min(1, "League level is required"),
  username: z.string().min(3, 'Username must be at least 3 characters.').max(30, 'Username must be 30 characters or less.').regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores.'),
}).refine(data => {
  if (data.sport === 'football' || data.sport === 'basketball') {
    return !!data.position && data.position !== '';
  }
  return true;
}, { message: 'Position is required for this sport.', path: ['position'] });

const POSITIONS = { football: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'], sprinting: [], other: [] };

const AthleteProfileForm = ({ userAccount }: { userAccount: UserAccount }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof athleteFormSchema>>({
    resolver: zodResolver(athleteFormSchema),
    defaultValues: { 
      sport: undefined, 
      gender: undefined,
      position: '', 
      team: '', 
      username: '', 
      age: undefined, 
      heightCm: undefined,
      weightKg: undefined,
      minutesPlayed: 0, 
      leagueLevel: '1.0' 
    },
  });

  const selectedSport = useWatch({ control: form.control, name: 'sport' });

  useEffect(() => {
    if (selectedSport === 'other') router.push('/waiting-list');
  }, [selectedSport, router]);
  
  const onSubmit = async (values: z.infer<typeof athleteFormSchema>) => {
    if (!user || !firestore || !userAccount) return;
    setIsLoading(true);
    
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const athleteDocRef = doc(firestore, 'athletes', user.uid);
      
      const athleteData: Partial<AthleteProfile> = {
        uid: user.uid,
        firstName: userAccount.firstName,
        lastName: userAccount.lastName,
        gender: values.gender,
        sport: values.sport,
        age: values.age,
        heightCm: values.heightCm,
        weightKg: values.weightKg,
        minutesPlayed: values.minutesPlayed || 0,
        leagueCoefficient: parseFloat(values.leagueLevel),
        username: values.username,
        profileCompleted: false,
        yellowCards: 0,
        redCards: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (values.position) athleteData.position = values.position;
      if (values.team) athleteData.team = values.team;
      if (values.dominantFoot) athleteData.dominantFoot = values.dominantFoot;

      await updateDoc(userDocRef, { 
        role: 'athlete',
        onboardingStep: 'athlete_profile_completed',
        updatedAt: new Date().toISOString(),
      });
      
      await setDoc(athleteDocRef, athleteData);
      
      toast({ title: 'Profile created!', description: 'Your basic profile is saved. Now let\'s add your performance data.' });
      router.push('/onboarding/metrics');
    } catch (error) {
      console.error("Error creating athlete profile:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save your profile. Please try again.' });
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl">Build your athlete profile</CardTitle>
        <CardDescription>Establish your professional baseline for institutional scouting.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Vitals & ID</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="heightCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <div className="relative">
                      <FormControl><Input type="number" placeholder="180" {...field} /></FormControl>
                      <Ruler className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="weightKg" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <div className="relative">
                      <FormControl><Input type="number" placeholder="75" {...field} /></FormControl>
                      <Weight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Sport Specs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="sport" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Sport</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select your sport" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="football">Football (Soccer)</SelectItem>
                        <SelectItem value="basketball">Basketball</SelectItem>
                        <SelectItem value="sprinting">Sprinting (Track)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {(selectedSport === 'football' || selectedSport === 'basketball') && (
                  <FormField control={form.control} name="position" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nominal Position</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select your position" /></SelectTrigger></FormControl>
                        <SelectContent>{POSITIONS[selectedSport as keyof typeof POSITIONS].map(pos => <SelectItem key={pos} value={pos.toLowerCase().replace(' ', '-')}>{pos}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedSport === 'football' && (
                  <FormField control={form.control} name="dominantFoot" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dominant Foot</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select foot" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Right">Right</SelectItem>
                          <SelectItem value="Left">Left</SelectItem>
                          <SelectItem value="Both">Both / Ambidextrous</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                {selectedSport !== 'sprinting' && (
                  <FormField control={form.control} name="minutesPlayed" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minutes Played (Season)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Required for Per-90 normalization.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="leagueLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competition Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="1.5">Elite / Professional (Top Tier)</SelectItem>
                        <SelectItem value="1.2">Professional (Lower Tier)</SelectItem>
                        <SelectItem value="1.0">Semi-Pro / Academy</SelectItem>
                        <SelectItem value="0.8">Regional Amateur</SelectItem>
                        <SelectItem value="0.5">Grassroots</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Adjusts your Context Index.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Username</FormLabel>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span><FormControl><Input placeholder="alex_morgan" className="pl-7" {...field} /></FormControl></div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto font-black uppercase tracking-widest h-12 px-8" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue to Metrics</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

// --- SCOUT FORM ---

const scoutFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  username: z.string().min(3, 'Username must be at least 3 characters.').max(30).regex(/^[a-z0-9_]+$/),
  entityType: z.enum(['individual', 'organization']),
  sports: z.string().min(3, 'Please list at least one sport.'),
  website: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(500).optional(),
  clubId: z.string().optional(),
});

const ScoutProfileForm = ({ userAccount }: { userAccount: UserAccount }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [clubSearch, setClubSearch] = useState('');

  const form = useForm<z.infer<typeof scoutFormSchema>>({
    resolver: zodResolver(scoutFormSchema),
    defaultValues: { name: '', username: '', entityType: 'individual', sports: '', website: '', bio: '', clubId: '' },
  });

  const clubsQuery = useMemoFirebase(() => (
    firestore && clubSearch.length > 2 ? query(collection(firestore, 'clubs'), where('clubName', '>=', clubSearch)) : null
  ), [firestore, clubSearch]);
  const { data: searchedClubs } = useCollection<ClubProfile>(clubsQuery);

  const selectedClubId = useWatch({ control: form.control, name: 'clubId' });
  const selectedClub = searchedClubs?.find(c => c.uid === selectedClubId);

  const onSubmit = async (values: z.infer<typeof scoutFormSchema>) => {
    if (!user || !firestore) return;
    setIsLoading(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const scoutDocRef = doc(firestore, 'scouts', user.uid);

      const scoutData: ScoutProfile = {
        uid: user.uid,
        name: values.name,
        username: values.username,
        entityType: values.entityType,
        sports: values.sports.split(',').map(s => s.trim().toLowerCase()),
        website: values.website,
        bio: values.bio,
        profileCompleted: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (values.clubId) {
        scoutData.clubId = values.clubId;
        // Automatically send join request
        const memberId = `${user.uid}_${values.clubId}`;
        await setDoc(doc(firestore, 'club_members', memberId), {
          id: memberId,
          userId: user.uid,
          clubId: values.clubId,
          role: 'scout',
          status: 'pending',
          joinedAt: new Date().toISOString()
        });
      }

      await updateDoc(userDocRef, { role: 'scout', profileCompleted: true, onboardingStep: 'scout_completed' });
      await setDoc(scoutDocRef, scoutData);

      toast({ title: 'Profile completed!', description: values.clubId ? 'Welcome! Your join request has been sent to the organization.' : 'Welcome to the Scout Console.' });
      router.push('/scout-dashboard');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save profile.' });
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle>Professional Scout Profile</CardTitle>
        <CardDescription>Define your scouting identity and institutional affiliation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name / Org Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="scout_pro" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            
            <div className="space-y-4">
                <Label>Institutional Affiliation (Optional)</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search for your club or agency..." 
                        className="pl-9" 
                        value={clubSearch}
                        onChange={(e) => setClubSearch(e.target.value)}
                    />
                </div>
                
                {searchedClubs && searchedClubs.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mt-2">
                        {searchedClubs.slice(0, 3).map(club => (
                            <div 
                                key={club.uid} 
                                className={cn(
                                    "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
                                    selectedClubId === club.uid ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                )}
                                onClick={() => form.setValue('clubId', club.uid)}
                            >
                                <div className="flex items-center gap-3">
                                    <Building className="w-4 h-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-bold leading-none">{club.clubName}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{club.location}</p>
                                    </div>
                                </div>
                                {selectedClubId === club.uid && <Check className="w-4 h-4 text-primary" />}
                            </div>
                        ))}
                    </div>
                )}
                
                {selectedClub && (
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-[10px] text-blue-700 flex items-start gap-2">
                        <Badge variant="outline" className="bg-blue-600 text-white border-none h-4 px-1 text-[8px] uppercase">Join Request</Badge>
                        <p>Selecting <strong>{selectedClub.clubName}</strong> will automatically send a join request to their administrative team upon finishing setup.</p>
                    </div>
                )}
            </div>

            <FormField control={form.control} name="entityType" render={({ field }) => (
              <FormItem>
                <FormLabel>Entity Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="individual">Independent Scout</SelectItem><SelectItem value="organization">Agency / Organization Member</SelectItem></SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sports" render={({ field }) => (
              <FormItem><FormLabel>Sports of Interest (CSV)</FormLabel><FormControl><Input placeholder="Football, Basketball" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem><FormLabel>Professional Bio</FormLabel><FormControl><Textarea className="h-24" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Finish Setup</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

// --- CLUB FORM ---

const clubFormSchema = z.object({
  clubName: z.string().min(2, 'Club name is required.'),
  location: z.string().min(2, 'Location is required.'),
  sportFocus: z.string().min(3, 'At least one sport required.'),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(5, 'Valid contact phone required.'),
});

const ClubProfileForm = ({ userAccount }: { userAccount: UserAccount }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof clubFormSchema>>({
    resolver: zodResolver(clubFormSchema),
    defaultValues: { 
        clubName: '', 
        location: '', 
        sportFocus: '', 
        contactEmail: userAccount?.email || '',
        contactPhone: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof clubFormSchema>) => {
    if (!user || !firestore) return;
    setIsLoading(true);
    try {
      const clubId = `club_${user.uid}`;
      const clubDocRef = doc(firestore, 'clubs', clubId);
      const userDocRef = doc(firestore, 'users', user.uid);
      const memberId = `${user.uid}_${clubId}`;
      const memberRef = doc(firestore, 'club_members', memberId);

      const clubData: ClubProfile = {
        uid: clubId,
        clubName: values.clubName,
        location: values.location,
        sportFocus: values.sportFocus.split(',').map(s => s.trim().toLowerCase()),
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        profileCompleted: true,
        isVerified: false,
        createdAt: new Date().toISOString(),
        onboardingCompletedAt: new Date().toISOString(),
        settings: {
          seasons: ['2024/25'],
          competitions: ['Regional League'],
          drillFocuses: ['Technical', 'Tactical'],
          equipment: ['Cones', 'Balls'],
          absenceReasons: ['Injury', 'Personal'],
          courtType: 'grass'
        }
      };

      // CRITICAL: Reorder writes. Membership document is created FIRST.
      await setDoc(memberRef, {
        id: memberId,
        userId: user.uid,
        clubId: clubId,
        role: 'admin',
        status: 'active',
        joinedAt: new Date().toISOString()
      });

      await setDoc(clubDocRef, clubData);
      await updateDoc(userDocRef, { role: 'club', profileCompleted: true, onboardingStep: 'club_completed' });
      
      toast({ title: 'Organization Registered', description: 'Your club presence is live.' });
      router.push('/club-dashboard/athletes');
    } catch (error) {
      console.error("Setup failed:", error);
      toast({ variant: 'destructive', title: 'Setup Failed', description: 'Institutional registration failed. Please check your network and permissions.' });
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-xl">
      <CardHeader>
        <CardTitle>Institutional Registration</CardTitle>
        <CardDescription>Establish your club's presence on the institutional Talent Graph.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="clubName" render={({ field }) => (
              <FormItem><FormLabel>Official Club Name</FormLabel><FormControl><Input placeholder="Verve & Vigor FC" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Nairobi, Kenya" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="sportFocus" render={({ field }) => (
                <FormItem><FormLabel>Sports Focus (CSV)</FormLabel><FormControl><Input placeholder="Football, Basketball" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="contactEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Official Contact Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+254..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />} Register Organization</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

// --- MAIN COMPONENT ---

type OnboardingStep = 'role' | 'athlete' | 'scout' | 'club';

export default function OnboardingPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep | 'loading'>('loading');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);
  
  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    const pageIsLoading = isUserLoading || isProfileLoading;
    if (pageIsLoading || isSavingRole) {
      setStep('loading');
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (!user.emailVerified) {
      router.push('/verify-email');
      return;
    }

    if (userAccount?.profileCompleted) {
        if(userAccount.role === 'athlete') router.push('/');
        if(userAccount.role === 'scout') router.push('/scout-dashboard');
        if(userAccount.role === 'club') router.push('/club-dashboard/athletes');
        return;
    }
    
    if (userAccount?.role) {
      setStep(userAccount.role as OnboardingStep);
    } else {
      setStep('role');
    }

  }, [user, userAccount, isUserLoading, isProfileLoading, isSavingRole, router]);

  const handleRoleSelect = async (role: 'athlete' | 'scout' | 'club') => {
    if (!user || !firestore) return;
    
    setIsSavingRole(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      // PERSIST: Save the role to Firestore before moving forward.
      // Use setDoc with merge to ensure the document exists during the transition.
      await setDoc(userRef, { 
        role: role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setStep(role);
    } catch (error) {
      console.error("Error saving role choice:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save your role choice. Please try again.',
      });
    } finally {
      setIsSavingRole(false);
    }
  };

  const renderStep = () => {
    if (!userAccount && step !== 'role' && step !== 'loading') return <Loader2 className="h-8 w-8 animate-spin" />;

    switch (step) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin" />;
      case 'role':
        return <RoleSelection onRoleSelect={handleRoleSelect} isLoading={isSavingRole} />;
      case 'athlete':
        return <AthleteProfileForm userAccount={userAccount!} />;
      case 'scout':
        return <ScoutProfileForm userAccount={userAccount!} />;
      case 'club':
        return <ClubProfileForm userAccount={userAccount!} />;
      default:
        return <Loader2 className="h-8 w-8 animate-spin" />;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 relative">
      {renderStep()}
      {user && (
        <div className="absolute bottom-4 right-4">
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      )}
    </div>
  );
}
