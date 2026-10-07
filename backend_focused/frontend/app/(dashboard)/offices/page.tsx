'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import ConfirmDialog from '@/app/components/ConfirmDialog';
import OfficeFormDialog from '@/app/components/offices/OfficeFormDialog';
import ResourceTable, { type Column } from '@/app/components/ResourceTable';
import { extractErrorMessage, isServerError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDeleteOffice, useOffices, useOfficeSummary } from '@/lib/queries';
import type { Office, OfficeSummary } from '@/lib/types';

export default function OfficesPage() {
  const { notify } = useFeedback();
  const officesQuery = useOffices();
  const summaryQuery = useOfficeSummary();
  const deleteMutation = useDeleteOffice();

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Office | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Office | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const openEdit = (office: Office) => {
    setEditing(office);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notify('Office deleted.');
      setDeleteTarget(null);
    } catch (err) {
      notify(
        isServerError(err)
          ? 'This office still has vehicles assigned and cannot be deleted.'
          : extractErrorMessage(err),
        'error',
      );
    }
  };

  const summaryColumns: Column<OfficeSummary>[] = [
    { key: 'name', label: 'Office', render: (row) => row.name },
    { key: 'city', label: 'City', render: (row) => row.city },
    {
      key: 'active_vehicle_count',
      label: 'Active vehicles',
      align: 'right',
      render: (row) => row.active_vehicle_count,
    },
    {
      key: 'maintenance_cost_last_year',
      label: 'Cost (last 12 mo)',
      align: 'right',
      render: (row) => formatCurrency(row.maintenance_cost_last_year),
    },
    {
      key: 'last_maintenance',
      label: 'Last maintenance',
      render: (row) => formatDate(row.last_maintenance),
    },
  ];

  const officeColumns: Column<Office>[] = [
    { key: 'name', label: 'Name', render: (office) => office.name },
    { key: 'city', label: 'City', render: (office) => office.city },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (office) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={() => openEdit(office)}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(office)}>
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
            Offices
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fleet statistics per office plus office management.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Add office
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Office summary
      </Typography>
      <Box mb={4}>
        <ResourceTable
          columns={summaryColumns}
          rows={summaryQuery.data ?? []}
          getRowId={(row) => row.id}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          errorMessage={summaryQuery.error ? extractErrorMessage(summaryQuery.error) : undefined}
          onRetry={() => summaryQuery.refetch()}
          emptyTitle="No offices yet"
          emptyDescription="Add your first office to see fleet statistics."
        />
      </Box>

      <Typography variant="h6" sx={{ mb: 1 }}>
        All offices
      </Typography>
      <ResourceTable
        columns={officeColumns}
        rows={officesQuery.data ?? []}
        getRowId={(office) => office.id}
        isLoading={officesQuery.isLoading}
        isError={officesQuery.isError}
        errorMessage={officesQuery.error ? extractErrorMessage(officesQuery.error) : undefined}
        onRetry={() => officesQuery.refetch()}
        emptyTitle="No offices yet"
        emptyDescription="Create an office to start assigning vehicles."
        emptyAction={
          <Button variant="contained" onClick={openCreate}>
            Add office
          </Button>
        }
      />

      <OfficeFormDialog
        key={formKey}
        open={formOpen}
        office={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete office?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} (${deleteTarget.city})? Offices that still have vehicles cannot be deleted.`
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
