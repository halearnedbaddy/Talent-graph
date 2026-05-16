'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { UserAccount, AthleteProfile } from '@/lib/types';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Loader2 } from 'lucide-react';

const LandingPage = dynamic(() => import('@/app/landing-page').then(mod => mod.LandingPage), {
    loading: () => <div className="flex h-screen items-center justify-center bg-background" suppressHydrationWarning><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

const AthleteDashboard = dynamic(() => import('@/components/dashboard/athlete-dashboard').then(mod => mod.AthleteDashboard), {
    loading: () => <DashboardSkeleton />,
});

export function AppRouter() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    const [destination, setDestination] = useState<'loading' | 'landing' | 'dashboard' | 'redirect'>('loading');

    const userDocRef = useMemoFirebase(() => (user?.uid ? doc(firestore, 'users', user.uid) : null), [user?.uid, firestore]);
    const { data: userAccount, isLoading: isUserAccountLoading } = useDoc<UserAccount>(userDocRef);
    
    const isAthlete = userAccount?.role === 'athlete';
    const athleteDocRef = useMemoFirebase(() => (isAthlete && user?.uid ? doc(firestore, 'athletes', user.uid) : null), [isAthlete, user?.uid, firestore]);
    const { data: athleteProfile, isLoading: isAthleteProfileLoading } = useDoc<AthleteProfile>(athleteDocRef);

    useEffect(() => {
        const isDataLoading = isUserLoading || isUserAccountLoading;
        if (isDataLoading) {
            setDestination('loading');
            return;
        }

        if (!user) {
            setDestination('landing');
            return;
        }

        if (!user.emailVerified) {
            router.push('/verify-email');
            setDestination('redirect');
            return;
        }

        if (userAccount?.profileCompleted) {
            if (userAccount.role === 'athlete') {
                setDestination('dashboard');
            } else if (userAccount.role === 'scout') {
                router.push('/scout-dashboard');
                setDestination('redirect');
            } else if (userAccount.role === 'club') {
                router.push('/club-dashboard/athletes');
                setDestination('redirect');
            } else {
                setDestination('landing');
            }
            return;
        }
        
        if (userAccount?.onboardingStep === 'waiting_list') {
            router.push('/waiting-list');
            setDestination('redirect');
            return;
        }
        
        router.push('/onboarding');
        setDestination('redirect');

    }, [
        user, 
        userAccount, 
        isUserLoading, 
        isUserAccountLoading,
        router
    ]);

    if (destination === 'loading' || destination === 'redirect') {
        // Only show the Skeleton if we suspect we are going to the dashboard
        if (user && userAccount?.role === 'athlete') {
            return <DashboardSkeleton />;
        }
        return <div className="flex h-screen items-center justify-center bg-background" suppressHydrationWarning><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (destination === 'dashboard' && userAccount) {
        return <AthleteDashboard userAccount={userAccount} athleteProfile={athleteProfile} />;
    }

    return <LandingPage />;
}
