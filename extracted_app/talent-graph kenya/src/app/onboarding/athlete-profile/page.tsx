
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * This page is deprecated and now redirects to the unified onboarding flow.
 */
export default function AthleteProfileRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/onboarding');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
