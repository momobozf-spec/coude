'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

/** Splitsing: ingelogd → naar je sleutel, anders → inloggen. */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/sleutel' : '/inloggen');
  }, [user, loading, router]);

  return null;
}
