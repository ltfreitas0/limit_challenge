'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { LoadingState } from '@/app/components/StateViews';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { ready, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!ready) return;
    router.replace(isAuthenticated ? '/vehicles' : '/login');
  }, [ready, isAuthenticated, router]);

  return <LoadingState label="Redirecting..." />;
}
