'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

/**
 * This page is deprecated and redirects to the new club dashboard.
 */
export default function TeamDashboardRedirect() {
  useEffect(() => {
    redirect('/club-dashboard');
  }, []);

  return null;
}
