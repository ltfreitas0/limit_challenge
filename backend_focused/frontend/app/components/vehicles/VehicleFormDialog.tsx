'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';

import { extractErrorMessage, extractFieldErrors } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { useCheckDuplicate, useCreateVehicle, useUpdateVehicle } from '@/lib/queries';
import type { FieldErrors, Office, Vehicle, VehicleInput } from '@/lib/types';

interface VehicleFormDialogProps {
  open: boolean;
  vehicle?: Vehicle | null;
  offices: Office[];
  onClose: () => void;
}

interface FormState {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: string;
  office: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  vin: '',
  license_plate: '',
  make: '',
  model: '',
  year: '',
  office: '',
  is_active: true,
};

function toForm(vehicle: Vehicle): FormState {
  return {
    vin: vehicle.vin,
    license_plate: vehicle.license_plate,
    make: vehicle.make,
    model: vehicle.model,
    year: String(vehicle.year),
    office: String(vehicle.office),
    is_active: vehicle.is_active,
  };
}

export default function VehicleFormDialog({
  open,
  vehicle,
  offices,
  onClose,
}: VehicleFormDialogProps) {
  const { notify } = useFeedback();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  const duplicateCheck = useCheckDuplicate();

  const [form, setForm] = useState<FormState>(() => (vehicle ? toForm(vehicle) : EMPTY_FORM));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const saving = createMutation.isPending || updateMutation.isPending;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const runDuplicateCheck = async () => {
    if (!form.vin && !form.license_plate) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const result = await duplicateCheck.mutateAsync({
        vin: form.vin || undefined,
        license_plate: form.license_plate || undefined,
        exclude_id: vehicle?.id,
      });
      if (result.conflicts.length > 0) {
        const labels = result.conflicts.map((item) => (item === 'vin' ? 'VIN' : 'license plate'));
        setDuplicateWarning(`Another vehicle already uses this ${labels.join(' and ')}.`);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const year = Number(form.year);
    const localErrors: FieldErrors = {};
    if (!form.vin.trim()) localErrors.vin = 'VIN is required.';
    if (!form.license_plate.trim()) localErrors.license_plate = 'License plate is required.';
    if (!form.make.trim()) localErrors.make = 'Make is required.';
    if (!form.model.trim()) localErrors.model = 'Model is required.';
    if (!form.year || Number.isNaN(year) || year < 1900) {
      localErrors.year = 'Enter a year of 1900 or later.';
    }
    if (!form.office) localErrors.office = 'Select an office.';
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    const payload: VehicleInput = {
      vin: form.vin.trim(),
      license_plate: form.license_plate.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      year,
      office: Number(form.office),
      is_active: form.is_active,
    };

    try {
      if (vehicle) {
        await updateMutation.mutateAsync({ id: vehicle.id, input: payload });
        notify('Vehicle updated.');
      } else {
        await createMutation.mutateAsync(payload);
        notify('Vehicle created.');
      }
      onClose();
    } catch (err) {
      setErrors(extractFieldErrors(err));
      notify(extractErrorMessage(err), 'error');
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{vehicle ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            {duplicateWarning ? <Alert severity="warning">{duplicateWarning}</Alert> : null}
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <TextField
                label="VIN"
                value={form.vin}
                onChange={(event) => updateField('vin', event.target.value)}
                onBlur={runDuplicateCheck}
                error={Boolean(errors.vin)}
                helperText={errors.vin}
                slotProps={{ htmlInput: { maxLength: 17 } }}
                required
              />
              <TextField
                label="License plate"
                value={form.license_plate}
                onChange={(event) => updateField('license_plate', event.target.value)}
                onBlur={runDuplicateCheck}
                error={Boolean(errors.license_plate)}
                helperText={errors.license_plate}
                required
              />
              <TextField
                label="Make"
                value={form.make}
                onChange={(event) => updateField('make', event.target.value)}
                error={Boolean(errors.make)}
                helperText={errors.make}
                required
              />
              <TextField
                label="Model"
                value={form.model}
                onChange={(event) => updateField('model', event.target.value)}
                error={Boolean(errors.model)}
                helperText={errors.model}
                required
              />
              <TextField
                label="Year"
                type="number"
                value={form.year}
                onChange={(event) => updateField('year', event.target.value)}
                error={Boolean(errors.year)}
                helperText={errors.year}
                slotProps={{ htmlInput: { min: 1900 } }}
                required
              />
              <TextField
                select
                label="Office"
                value={form.office}
                onChange={(event) => updateField('office', event.target.value)}
                error={Boolean(errors.office)}
                helperText={errors.office}
                required
              >
                {offices.map((office) => (
                  <MenuItem key={office.id} value={String(office.id)}>
                    {office.name} ({office.city})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(event) => updateField('is_active', event.target.checked)}
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
