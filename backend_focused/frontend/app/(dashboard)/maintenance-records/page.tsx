'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import ConfirmDialog from '@/app/components/ConfirmDialog';
import MaintenanceRecordFormDialog from '@/app/components/maintenance/MaintenanceRecordFormDialog';
import ResourceTable, { type Column } from '@/app/components/ResourceTable';
import { extractErrorMessage } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  useAllVehicles,
  useDeleteMaintenanceRecord,
  useMaintenanceRecords,
  useMechanics,
} from '@/lib/queries';
import type { MaintenanceRecord } from '@/lib/types';

export default function MaintenanceRecordsPage() {
  const { notify } = useFeedback();
  const vehiclesQuery = useAllVehicles();
  const mechanicsQuery = useMechanics();

  const [page, setPage] = useState(1);

  const recordsQuery = useMaintenanceRecords(null, page);
  const deleteMutation = useDeleteMaintenanceRecord();

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);

  const vehicleNames = useMemo(() => {
    const map = new Map<number, string>();
    (vehiclesQuery.data ?? []).forEach((vehicle) => {
      map.set(
        vehicle.id,
        `${vehicle.license_plate} - ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      );
    });
    return map;
  }, [vehiclesQuery.data]);

  const mechanicNames = useMemo(() => {
    const map = new Map<number, string>();
    (mechanicsQuery.data ?? []).forEach((mechanic) => {
      map.set(mechanic.id, mechanic.name);
    });
    return map;
  }, [mechanicsQuery.data]);

  const openCreate = () => {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const openEdit = (record: MaintenanceRecord) => {
    setEditing(record);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notify('Maintenance record deleted.');
      setDeleteTarget(null);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const rows = recordsQuery.data?.results ?? [];
  const totalCount = recordsQuery.data?.count ?? 0;

  const columns: Column<MaintenanceRecord>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (record) => formatDate(record.maintenance_date),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (record) => vehicleNames.get(record.vehicle) ?? `#${record.vehicle}`,
    },
    {
      key: 'mechanic',
      label: 'Mechanic',
      render: (record) => mechanicNames.get(record.mechanic) ?? `#${record.mechanic}`,
    },
    { key: 'type', label: 'Type', render: (record) => record.maintenance_type },
    {
      key: 'cost',
      label: 'Cost',
      align: 'right',
      render: (record) => formatCurrency(record.cost),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (record) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
          {record.notes || '-'}
        </Typography>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (record) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(record)}>
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Maintenance records
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every service performed, newest first.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Add record
        </Button>
      </Stack>

      <ResourceTable
        columns={columns}
        rows={rows}
        getRowId={(record) => record.id}
        isLoading={recordsQuery.isLoading}
        isError={recordsQuery.isError}
        errorMessage={recordsQuery.error ? extractErrorMessage(recordsQuery.error) : undefined}
        onRetry={() => recordsQuery.refetch()}
        emptyTitle="No maintenance records"
        emptyDescription="Log a service to build up vehicle history."
        emptyAction={
          <Button variant="contained" onClick={openCreate}>
            Add record
          </Button>
        }
        page={page - 1}
        rowsPerPage={10}
        totalCount={totalCount}
        onPageChange={(newPage) => setPage(newPage + 1)}
      />

      <MaintenanceRecordFormDialog
        key={formKey}
        open={formOpen}
        record={editing}
        vehicles={vehiclesQuery.data ?? []}
        mechanics={mechanicsQuery.data ?? []}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete maintenance record?"
        description={
          deleteTarget
            ? `Delete the ${deleteTarget.maintenance_type} record from ${formatDate(deleteTarget.maintenance_date)}?`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
