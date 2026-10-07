'use client';

import {
  Box,
  Button,
  Chip,
  Drawer,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { extractErrorMessage } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAssignVehicle, useVehicle } from '@/lib/queries';
import type { Office, Vehicle, VehicleDetail } from '@/lib/types';

import { ErrorState, LoadingState } from '../StateViews';

interface VehicleDetailDrawerProps {
  open: boolean;
  vehicle: Vehicle | null;
  offices: Office[];
  onClose: () => void;
  onEdit: (vehicle: Vehicle) => void;
  onAddMaintenance: (vehicle: VehicleDetail) => void;
}

export default function VehicleDetailDrawer({
  open,
  vehicle,
  offices,
  onClose,
  onEdit,
  onAddMaintenance,
}: VehicleDetailDrawerProps) {
  const { notify } = useFeedback();
  const detailQuery = useVehicle(open ? (vehicle?.id ?? null) : null);
  const assignMutation = useAssignVehicle();

  const detail = detailQuery.data;

  const handleAssign = async (office: number) => {
    if (!vehicle) return;
    try {
      await assignMutation.mutateAsync({ id: vehicle.id, office });
      notify('Vehicle reassigned.');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } } } }}
    >
      <Box sx={{ p: 3 }}>
        {detailQuery.isLoading ? <LoadingState /> : null}
        {detailQuery.isError ? (
          <ErrorState
            message={extractErrorMessage(detailQuery.error)}
            onRetry={() => detailQuery.refetch()}
          />
        ) : null}
        {detail ? (
          <DrawerBody
            key={detail.id}
            detail={detail}
            offices={offices}
            assigning={assignMutation.isPending}
            onAssign={handleAssign}
            onEdit={onEdit}
            onAddMaintenance={onAddMaintenance}
          />
        ) : null}
      </Box>
    </Drawer>
  );
}

interface DrawerBodyProps {
  detail: VehicleDetail;
  offices: Office[];
  assigning: boolean;
  onAssign: (office: number) => void;
  onEdit: (vehicle: Vehicle) => void;
  onAddMaintenance: (vehicle: VehicleDetail) => void;
}

function DrawerBody({
  detail,
  offices,
  assigning,
  onAssign,
  onEdit,
  onAddMaintenance,
}: DrawerBodyProps) {
  // The body is keyed by vehicle id, so this runs once per vehicle.
  const [targetOffice, setTargetOffice] = useState(() => String(detail.office.id));
  const canAssign = targetOffice !== '' && Number(targetOffice) !== detail.office.id;

  const asVehicle: Vehicle = {
    id: detail.id,
    vin: detail.vin,
    license_plate: detail.license_plate,
    make: detail.make,
    model: detail.model,
    year: detail.year,
    office: detail.office.id,
    office_name: `${detail.office.name} (${detail.office.city})`,
    is_active: detail.is_active,
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6">
          {detail.year} {detail.make} {detail.model}
        </Typography>
        <Stack direction="row" spacing={1} mt={1}>
          <Chip size="small" label={detail.license_plate} />
          <Chip
            size="small"
            color={detail.is_active ? 'success' : 'default'}
            label={detail.is_active ? 'Active' : 'Inactive'}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">
          Vehicle
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="body2">VIN: {detail.vin}</Typography>
          <Typography variant="body2">
            Office: {detail.office.name} ({detail.office.city})
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={() => onEdit(asVehicle)}>
          Edit
        </Button>
        <Button variant="contained" onClick={() => onAddMaintenance(detail)}>
          Add maintenance
        </Button>
      </Stack>

      <Box>
        <Typography variant="overline" color="text.secondary">
          Reassign office
        </Typography>
        <Stack direction="row" spacing={1} mt={0.5}>
          <TextField
            select
            size="small"
            value={targetOffice}
            onChange={(event) => setTargetOffice(event.target.value)}
            sx={{ minWidth: 200 }}
          >
            {offices.map((office) => (
              <MenuItem key={office.id} value={String(office.id)}>
                {office.name} ({office.city})
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() => onAssign(Number(targetOffice))}
            disabled={!canAssign || assigning}
          >
            {assigning ? 'Saving...' : 'Assign'}
          </Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">
          Maintenance history ({detail.maintenance_history.length})
        </Typography>
        {detail.maintenance_history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No maintenance recorded yet.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Mechanic</TableCell>
                  <TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.maintenance_history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.maintenance_date)}</TableCell>
                    <TableCell>{record.maintenance_type}</TableCell>
                    <TableCell>{record.mechanic.name}</TableCell>
                    <TableCell align="right">{formatCurrency(record.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
