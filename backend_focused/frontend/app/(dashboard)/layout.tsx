'use client';

import type { PropsWithChildren } from 'react';

import AppShell from '@/app/components/AppShell';

export default function DashboardLayout({ children }: PropsWithChildren) {
  return <AppShell>{children}</AppShell>;
}
