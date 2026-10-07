'use client';

import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" gap={2} py={5}>
      <CircularProgress size={22} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Box py={2}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {message}
      </Alert>
    </Box>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} py={6} textAlign="center">
      <Typography variant="h6">{title}</Typography>
      {description ? (
        <Typography color="text.secondary" maxWidth={420}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box pt={1}>{action}</Box> : null}
    </Stack>
  );
}
