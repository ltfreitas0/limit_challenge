'use client';

import { AppBar, Box, Button, Container, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type PropsWithChildren } from 'react';

import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { label: 'Vehicles', href: '/vehicles' },
  { label: 'Offices', href: '/offices' },
  { label: 'Mechanics', href: '/mechanics' },
  { label: 'Maintenance', href: '/maintenance-records' },
];

export default function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, ready, username, logout } = useAuth();

  // Client-side auth guard for every page rendered inside the shell.
  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return null;
  }

  const matchedIndex = NAV_ITEMS.findIndex((item) => pathname?.startsWith(item.href));
  const activeIndex = matchedIndex === -1 ? 0 : matchedIndex;

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            Fleet Tracker
          </Typography>
          <Tabs
            value={activeIndex}
            onChange={(_event, value: number) => router.push(NAV_ITEMS[value].href)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flexGrow: 1, minHeight: 48 }}
          >
            {NAV_ITEMS.map((item) => (
              <Tab key={item.href} label={item.label} />
            ))}
          </Tabs>
          {username ? (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {username}
            </Typography>
          ) : null}
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Log out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
