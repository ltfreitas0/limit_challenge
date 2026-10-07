'use client';

import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';

import type { Office, VehicleFilters } from '@/lib/types';
import { countActiveFilters } from '@/lib/vehicle-filters';

interface VehicleFilterBarProps {
  filters: VehicleFilters;
  offices: Office[];
  onChange: (patch: Partial<VehicleFilters>) => void;
  onReset: () => void;
  totalCount?: number;
}

export default function VehicleFilterBar({
  filters,
  offices,
  onChange,
  onReset,
  totalCount,
}: VehicleFilterBarProps) {
  const activeCount = countActiveFilters(filters);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        <TextField
          select
          size="small"
          label="Office"
          value={filters.office}
          onChange={(event) => onChange({ office: event.target.value })}
        >
          <MenuItem value="">All offices</MenuItem>
          {offices.map((office) => (
            <MenuItem key={office.id} value={String(office.id)}>
              {office.name} ({office.city})
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Status"
          value={filters.active}
          onChange={(event) => onChange({ active: event.target.value as VehicleFilters['active'] })}
        >
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>

        <TextField
          size="small"
          label="Make"
          value={filters.make}
          onChange={(event) => onChange({ make: event.target.value })}
        />

        <TextField
          size="small"
          label="Model"
          value={filters.model}
          onChange={(event) => onChange({ model: event.target.value })}
        />

        <TextField
          size="small"
          label="Mechanic cert #"
          value={filters.mechanic_certification_number}
          onChange={(event) => onChange({ mechanic_certification_number: event.target.value })}
        />

        <TextField
          size="small"
          type="date"
          label="Maintenance from"
          value={filters.maintenance_from}
          onChange={(event) => onChange({ maintenance_from: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          size="small"
          type="date"
          label="Maintenance to"
          value={filters.maintenance_to}
          onChange={(event) => onChange({ maintenance_to: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
          {activeCount > 0 ? <Chip size="small" label={`${activeCount} active`} /> : null}
          <Button onClick={onReset} disabled={activeCount === 0}>
            Reset
          </Button>
        </Stack>
      </Box>

      {typeof totalCount === 'number' ? (
        <Typography variant="body2" color="text.secondary" mt={2}>
          {totalCount} vehicle{totalCount === 1 ? '' : 's'} match the current filters.
        </Typography>
      ) : null}
    </Paper>
  );
}
