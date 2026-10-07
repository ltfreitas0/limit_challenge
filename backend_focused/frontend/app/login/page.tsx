'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import LoginForm from '@/app/components/LoginForm';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { ready, isAuthenticated } = useAuth();

  useEffect(() => {
    if (ready && isAuthenticated) {
      router.replace('/vehicles');
    }
  }, [ready, isAuthenticated, router]);

  return <LoginForm />;
}
