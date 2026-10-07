'use client';

import {
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useSubmissionDetail } from '@/lib/hooks/useSubmissions';

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const submissionId = params?.id ?? '';

  const detailQuery = useSubmissionDetail(submissionId);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <div>
            <Typography variant="h4">Submission detail</Typography>
            <Typography color="text.secondary">
              Use this page to present the full submission payload along with contacts, documents,
              and notes.
            </Typography>
          </div>
          <MuiLink component={Link} href="/submissions" underline="none">
            Back to list
          </MuiLink>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              API data placeholder
            </Typography>
            <Typography color="text.secondary">
              The React Query call is disabled until you turn it on. Once you enable it and wire up
              serializers on the backend you can render key facts, contacts, documents, and note
              timelines.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <pre style={{ margin: 0, fontSize: 14 }}>
              {JSON.stringify({ submissionId, queryKey: detailQuery.queryKey }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
