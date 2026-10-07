'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';

import { extractErrorMessage, extractFieldErrors } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { todayIso } from '@/lib/format';
import { useCreateMaintenanceRecord, useUpdateMaintenanceRecord } from '@/lib/queries';
import type {
  FieldErrors,
  MaintenanceRecord,
  MaintenanceRecordInput,
  Mechanic,
  Vehicle,
} from '@/lib/types';

interface MaintenanceRecordFormDialogProps {
  open: boolean;
  record?: MaintenanceRecord | null;
  defaultVehicleId?: number | null;
  vehicles: Vehicle[];
  mechanics: Mechanic[];
  onClose: () => void;
}

interface FormState {
  vehicle: string;
  mechanic: string;
  maintenance_date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  vehicle: '',
  mechanic: '',
  maintenance_date: todayIso(),
  maintenance_type: '',
  cost: '',
  notes: '',
};

function toForm(record: MaintenanceRecord): FormState {
  return {
    vehicle: String(record.vehicle),
    mechanic: String(record.mechanic),
    maintenance_date: record.maintenance_date,
    maintenance_type: record.maintenance_type,
    cost: String(record.cost),
    notes: record.notes ?? '',
  };
}

export default function MaintenanceRecordFormDialog({
  open,
  record,
  defaultVehicleId,
  vehicles,
  mechanics,
  onClose,
}: MaintenanceRecordFormDialogProps) {
  const { notify } = useFeedback();
  const createMutation = useCreateMaintenanceRecord();
  const updateMutation = useUpdateMaintenanceRecord();

  const [form, setForm] = useState<FormState>(() =>
    record
      ? toForm(record)
      : {
          ...EMPTY_FORM,
          vehicle: defaultVehicleId ? String(defaultVehicleId) : '',
        },
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const saving = createMutation.isPending || updateMutation.isPending;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const costNumber = Number(form.cost);
    const localErrors: FieldErrors = {};
    if (!form.vehicle) localErrors.vehicle = 'Select a vehicle.';
    if (!form.mechanic) localErrors.mechanic = 'Select a mechanic.';
    if (!form.maintenance_date) localErrors.maintenance_date = 'Choose a date.';
    if (!form.maintenance_type.trim()) localErrors.maintenance_type = 'Enter a maintenance type.';
    if (form.cost === '' || Number.isNaN(costNumber) || costNumber < 0) {
      localErrors.cost = 'Enter a cost of 0 or more.';
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    const payload: MaintenanceRecordInput = {
      vehicle: Number(form.vehicle),
      mechanic: Number(form.mechanic),
      maintenance_date: form.maintenance_date,
      maintenance_type: form.maintenance_type.trim(),
      cost: costNumber.toFixed(2),
      notes: form.notes,
    };

    try {
      if (record) {
        await updateMutation.mutateAsync({ id: record.id, input: payload });
        notify('Maintenance record updated.');
      } else {
        await createMutation.mutateAsync(payload);
        notify('Maintenance record created.');
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
        <DialogTitle>{record ? 'Edit maintenance record' : 'Add maintenance record'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            <TextField
              select
              label="Vehicle"
              value={form.vehicle}
              onChange={(event) => updateField('vehicle', event.target.value)}
              error={Boolean(errors.vehicle)}
              helperText={errors.vehicle}
              required
            >
              {vehicles.map((vehicle) => (
                <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.license_plate} - {vehicle.year} {vehicle.make} {vehicle.model}
                </MenuItem>
              ))}
            </TextField>
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <TextField
                select
                label="Mechanic"
                value={form.mechanic}
                onChange={(event) => updateField('mechanic', event.target.value)}
                error={Boolean(errors.mechanic)}
                helperText={errors.mechanic}
                required
              >
                {mechanics.map((mechanic) => (
                  <MenuItem key={mechanic.id} value={String(mechanic.id)}>
                    {mechanic.name} ({mechanic.certification_number})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Date"
                type="date"
                value={form.maintenance_date}
                onChange={(event) => updateField('maintenance_date', event.target.value)}
                error={Boolean(errors.maintenance_date)}
                helperText={errors.maintenance_date}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
              <TextField
                label="Maintenance type"
                value={form.maintenance_type}
                onChange={(event) => updateField('maintenance_type', event.target.value)}
                error={Boolean(errors.maintenance_type)}
                helperText={errors.maintenance_type}
                required
              />
              <TextField
                label="Cost"
                type="number"
                value={form.cost}
                onChange={(event) => updateField('cost', event.target.value)}
                error={Boolean(errors.cost)}
                helperText={errors.cost}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                required
              />
            </Box>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              multiline
              minRows={3}
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
