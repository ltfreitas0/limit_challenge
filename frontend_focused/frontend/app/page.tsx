'use client';

import { Box, Button, Container, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Box display="flex" flexDirection="column" gap={4}>
        <Typography variant="h3" component="h1">
          Submission Tracker Challenge
        </Typography>
        <Typography color="text.secondary">
          Use this scaffold to build the submissions list and detail experiences. Head to the
          workspace to start wiring up API calls, filters, and UI polish.
        </Typography>
        <Box>
          <Button variant="contained" onClick={() => router.push('/submissions')}>
            Go to Submissions
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
