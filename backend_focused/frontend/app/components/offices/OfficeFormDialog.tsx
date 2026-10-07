'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';

import { extractErrorMessage, extractFieldErrors } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { useCreateOffice, useUpdateOffice } from '@/lib/queries';
import type { FieldErrors, Office, OfficeInput } from '@/lib/types';

interface OfficeFormDialogProps {
  open: boolean;
  office?: Office | null;
  onClose: () => void;
}

export default function OfficeFormDialog({ open, office, onClose }: OfficeFormDialogProps) {
  const { notify } = useFeedback();
  const createMutation = useCreateOffice();
  const updateMutation = useUpdateOffice();

  const [name, setName] = useState(() => office?.name ?? '');
  const [city, setCity] = useState(() => office?.city ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const localErrors: FieldErrors = {};
    if (!name.trim()) localErrors.name = 'Name is required.';
    if (!city.trim()) localErrors.city = 'City is required.';
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    const payload: OfficeInput = { name: name.trim(), city: city.trim() };

    try {
      if (office) {
        await updateMutation.mutateAsync({ id: office.id, input: payload });
        notify('Office updated.');
      } else {
        await createMutation.mutateAsync(payload);
        notify('Office created.');
      }
      onClose();
    } catch (err) {
      setErrors(extractFieldErrors(err));
      notify(extractErrorMessage(err), 'error');
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{office ? 'Edit office' : 'Add office'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={Boolean(errors.name)}
              helperText={errors.name}
              autoFocus
              required
            />
            <TextField
              label="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              error={Boolean(errors.city)}
              helperText={errors.city}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
