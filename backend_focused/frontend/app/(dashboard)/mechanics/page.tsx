'use client';

import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import ConfirmDialog from '@/app/components/ConfirmDialog';
import MechanicFormDialog from '@/app/components/mechanics/MechanicFormDialog';
import ResourceTable, { type Column } from '@/app/components/ResourceTable';
import { extractErrorMessage, isServerError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { formatCurrency } from '@/lib/format';
import { useDeleteMechanic, useMechanics, useMechanicWorkload } from '@/lib/queries';
import type { Mechanic, MechanicWorkload } from '@/lib/types';

export default function MechanicsPage() {
  const { notify } = useFeedback();
  const mechanicsQuery = useMechanics();
  const workloadQuery = useMechanicWorkload();
  const deleteMutation = useDeleteMechanic();

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Mechanic | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const openEdit = (mechanic: Mechanic) => {
    setEditing(mechanic);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notify('Mechanic deleted.');
      setDeleteTarget(null);
    } catch (err) {
      notify(
        isServerError(err)
          ? 'This mechanic has maintenance records and cannot be deleted.'
          : extractErrorMessage(err),
        'error',
      );
    }
  };

  const workloadColumns: Column<MechanicWorkload>[] = [
    { key: 'name', label: 'Mechanic', render: (row) => row.name },
    { key: 'certification_number', label: 'Cert #', render: (row) => row.certification_number },
    {
      key: 'maintenance_count',
      label: 'Jobs this year',
      align: 'right',
      render: (row) => row.maintenance_count,
    },
    {
      key: 'total_cost',
      label: 'Total cost',
      align: 'right',
      render: (row) => formatCurrency(row.total_cost),
    },
  ];

  const mechanicColumns: Column<Mechanic>[] = [
    { key: 'name', label: 'Name', render: (mechanic) => mechanic.name },
    {
      key: 'certification_number',
      label: 'Certification #',
      render: (mechanic) => mechanic.certification_number,
    },
    {
      key: 'status',
      label: 'Status',
      render: (mechanic) => (
        <Chip
          size="small"
          color={mechanic.is_active ? 'success' : 'default'}
          label={mechanic.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (mechanic) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={() => openEdit(mechanic)}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(mechanic)}>
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
            Mechanics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Current-year workload plus mechanic management.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Add mechanic
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Workload (current year)
      </Typography>
      <Box mb={4}>
        <ResourceTable
          columns={workloadColumns}
          rows={workloadQuery.data ?? []}
          getRowId={(row) => row.id}
          isLoading={workloadQuery.isLoading}
          isError={workloadQuery.isError}
          errorMessage={workloadQuery.error ? extractErrorMessage(workloadQuery.error) : undefined}
          onRetry={() => workloadQuery.refetch()}
          emptyTitle="No workload data"
          emptyDescription="Workload appears once maintenance records are logged."
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 1 }}>
        All mechanics
      </Typography>
      <ResourceTable
        columns={mechanicColumns}
        rows={mechanicsQuery.data ?? []}
        getRowId={(mechanic) => mechanic.id}
        isLoading={mechanicsQuery.isLoading}
        isError={mechanicsQuery.isError}
        errorMessage={mechanicsQuery.error ? extractErrorMessage(mechanicsQuery.error) : undefined}
        onRetry={() => mechanicsQuery.refetch()}
        emptyTitle="No mechanics yet"
        emptyDescription="Add a mechanic to start recording maintenance."
        emptyAction={
          <Button variant="contained" onClick={openCreate}>
            Add mechanic
          </Button>
        }
      />

      <MechanicFormDialog
        key={formKey}
        open={formOpen}
        mechanic={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete mechanic?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? Mechanics with maintenance records cannot be deleted.`
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
