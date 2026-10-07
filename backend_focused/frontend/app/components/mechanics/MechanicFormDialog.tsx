'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';

import { extractErrorMessage, extractFieldErrors } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { useCreateMechanic, useUpdateMechanic } from '@/lib/queries';
import type { FieldErrors, Mechanic, MechanicInput } from '@/lib/types';

interface MechanicFormDialogProps {
  open: boolean;
  mechanic?: Mechanic | null;
  onClose: () => void;
}

export default function MechanicFormDialog({ open, mechanic, onClose }: MechanicFormDialogProps) {
  const { notify } = useFeedback();
  const createMutation = useCreateMechanic();
  const updateMutation = useUpdateMechanic();

  const [name, setName] = useState(() => mechanic?.name ?? '');
  const [certificationNumber, setCertificationNumber] = useState(
    () => mechanic?.certification_number ?? '',
  );
  const [isActive, setIsActive] = useState(() => mechanic?.is_active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const localErrors: FieldErrors = {};
    if (!name.trim()) localErrors.name = 'Name is required.';
    if (!certificationNumber.trim()) {
      localErrors.certification_number = 'Certification number is required.';
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    const payload: MechanicInput = {
      name: name.trim(),
      certification_number: certificationNumber.trim(),
      is_active: isActive,
    };

    try {
      if (mechanic) {
        await updateMutation.mutateAsync({ id: mechanic.id, input: payload });
        notify('Mechanic updated.');
      } else {
        await createMutation.mutateAsync(payload);
        notify('Mechanic created.');
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
        <DialogTitle>{mechanic ? 'Edit mechanic' : 'Add mechanic'}</DialogTitle>
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
              label="Certification number"
              value={certificationNumber}
              onChange={(event) => setCertificationNumber(event.target.value)}
              error={Boolean(errors.certification_number)}
              helperText={errors.certification_number}
              required
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
              }
              label="Active"
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
