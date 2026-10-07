'use client';

import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import ConfirmDialog from '@/app/components/ConfirmDialog';
import MaintenanceRecordFormDialog from '@/app/components/maintenance/MaintenanceRecordFormDialog';
import ResourceTable, { type Column } from '@/app/components/ResourceTable';
import { LoadingState } from '@/app/components/StateViews';
import VehicleDetailDrawer from '@/app/components/vehicles/VehicleDetailDrawer';
import VehicleFilterBar from '@/app/components/vehicles/VehicleFilterBar';
import VehicleFormDialog from '@/app/components/vehicles/VehicleFormDialog';
import { extractErrorMessage } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { useDebouncedValue } from '@/lib/hooks';
import { useDeleteVehicle, useMechanics, useOffices, useVehicles } from '@/lib/queries';
import {
  EMPTY_VEHICLE_FILTERS,
  type Vehicle,
  type VehicleDetail,
  type VehicleFilters,
} from '@/lib/types';
import { buildVehicleFilterQuery, parseVehicleFilters } from '@/lib/vehicle-filters';

function detailToVehicleRow(detail: VehicleDetail): Vehicle {
  return {
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
}

function VehiclesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notify } = useFeedback();

  const [filters, setFilters] = useState<VehicleFilters>(() => parseVehicleFilters(searchParams));
  const [page, setPage] = useState(1);
  const debouncedFilters = useDebouncedValue(filters, 350);

  const officesQuery = useOffices();
  const mechanicsQuery = useMechanics();
  const vehiclesQuery = useVehicles(debouncedFilters, page);
  const deleteMutation = useDeleteVehicle();

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<VehicleDetail | null>(null);

  // Reflect the effective filters in the URL so they are shareable.
  useEffect(() => {
    const query = buildVehicleFilterQuery(debouncedFilters);
    if (query !== searchParams.toString()) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [debouncedFilters, pathname, router, searchParams]);

  const rows = vehiclesQuery.data?.results ?? [];
  const totalCount = vehiclesQuery.data?.count ?? 0;

  // Changing filters returns the user to the first page.
  const handleFilterChange = (patch: Partial<VehicleFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({ ...EMPTY_VEHICLE_FILTERS });
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setDrawerOpen(false);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const openDetail = (vehicle: Vehicle) => {
    setSelected(vehicle);
    setDrawerOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notify('Vehicle deleted.');
      if (selected?.id === deleteTarget.id) {
        setDrawerOpen(false);
      }
      setDeleteTarget(null);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const columns: Column<Vehicle>[] = [
    {
      key: 'license_plate',
      label: 'Plate',
      render: (vehicle) => (
        <Typography variant="body2" fontWeight={600}>
          {vehicle.license_plate}
        </Typography>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    },
    {
      key: 'vin',
      label: 'VIN',
      render: (vehicle) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {vehicle.vin}
        </Typography>
      ),
    },
    { key: 'office', label: 'Office', render: (vehicle) => vehicle.office_name },
    {
      key: 'status',
      label: 'Status',
      render: (vehicle) => (
        <Chip
          size="small"
          color={vehicle.is_active ? 'success' : 'default'}
          label={vehicle.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (vehicle) => (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="small" onClick={() => openEdit(vehicle)}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => setDeleteTarget(vehicle)}>
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
            Vehicles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search, create, update and retire fleet vehicles.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>
          Add vehicle
        </Button>
      </Stack>

      <VehicleFilterBar
        filters={filters}
        offices={officesQuery.data ?? []}
        onChange={handleFilterChange}
        onReset={handleReset}
        totalCount={vehiclesQuery.data ? totalCount : undefined}
      />

      <ResourceTable
        columns={columns}
        rows={rows}
        getRowId={(vehicle) => vehicle.id}
        isLoading={vehiclesQuery.isLoading}
        isError={vehiclesQuery.isError}
        errorMessage={vehiclesQuery.error ? extractErrorMessage(vehiclesQuery.error) : undefined}
        onRetry={() => vehiclesQuery.refetch()}
        emptyTitle="No vehicles found"
        emptyDescription="Try clearing the filters or add a new vehicle."
        emptyAction={
          <Button variant="contained" onClick={openCreate}>
            Add vehicle
          </Button>
        }
        onRowClick={openDetail}
        page={page - 1}
        rowsPerPage={10}
        totalCount={totalCount}
        onPageChange={(newPage) => setPage(newPage + 1)}
      />

      <VehicleFormDialog
        key={formKey}
        open={formOpen}
        vehicle={editing}
        offices={officesQuery.data ?? []}
        onClose={() => setFormOpen(false)}
      />

      <VehicleDetailDrawer
        open={drawerOpen}
        vehicle={selected}
        offices={officesQuery.data ?? []}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
        onAddMaintenance={(detail) => {
          setMaintenanceVehicle(detail);
          setDrawerOpen(false);
        }}
      />

      <MaintenanceRecordFormDialog
        key={maintenanceVehicle?.id ?? 'none'}
        open={Boolean(maintenanceVehicle)}
        defaultVehicleId={maintenanceVehicle?.id ?? null}
        vehicles={maintenanceVehicle ? [detailToVehicleRow(maintenanceVehicle)] : []}
        mechanics={mechanicsQuery.data ?? []}
        onClose={() => setMaintenanceVehicle(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete vehicle?"
        description={
          deleteTarget
            ? `This permanently removes ${deleteTarget.license_plate} (${deleteTarget.year} ${deleteTarget.make} ${deleteTarget.model}) and its maintenance history.`
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

export default function VehiclesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VehiclesPageInner />
    </Suspense>
  );
}
