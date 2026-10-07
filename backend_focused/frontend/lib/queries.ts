'use client';

// React Query hooks for every Fleet Tracker endpoint. Each CRUD resource has
// list/read/create/update/delete hooks plus its report actions.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './api-client';
import { setTokens } from './auth';
import type {
  DuplicateCheck,
  MaintenanceRecord,
  MaintenanceRecordInput,
  Mechanic,
  MechanicInput,
  MechanicWorkload,
  Office,
  OfficeInput,
  OfficeSummary,
  Paginated,
  TokenPair,
  Vehicle,
  VehicleAlert,
  VehicleDetail,
  VehicleFilters,
  VehicleInput,
} from './types';

export const queryKeys = {
  offices: ['offices'] as const,
  officeSummary: ['offices', 'summary'] as const,
  mechanics: ['mechanics'] as const,
  mechanicWorkload: ['mechanics', 'workload'] as const,
  vehicles: (filters: VehicleFilters, page: number) => ['vehicles', { filters, page }] as const,
  vehicle: (id: number) => ['vehicles', id] as const,
  vehicleAlerts: ['vehicles', 'needing-maintenance'] as const,
  maintenanceRecords: (vehicleId: number | null) => ['maintenance-records', { vehicleId }] as const,
};

// Walk DRF's ``next`` links so dropdowns and small tables get every row.
async function fetchAllPages<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = url;
  while (next) {
    const response: { data: Paginated<T> } = await apiClient.get(next);
    items.push(...response.data.results);
    next = response.data.next;
  }
  return items;
}

// --- Auth ------------------------------------------------------------------
export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) =>
      (await apiClient.post<TokenPair>('/token/', credentials)).data,
    onSuccess: (tokens) => setTokens(tokens),
  });
}

// --- Offices ---------------------------------------------------------------
export function useOffices() {
  return useQuery({
    queryKey: queryKeys.offices,
    queryFn: () => fetchAllPages<Office>('/offices/'),
  });
}

export function useOfficeSummary() {
  return useQuery({
    queryKey: queryKeys.officeSummary,
    queryFn: async () => (await apiClient.get<OfficeSummary[]>('/offices/summary/')).data,
  });
}

export function useCreateOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OfficeInput) =>
      (await apiClient.post<Office>('/offices/', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.offices });
      qc.invalidateQueries({ queryKey: queryKeys.officeSummary });
    },
  });
}

export function useUpdateOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: OfficeInput }) =>
      (await apiClient.patch<Office>(`/offices/${id}/`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.offices });
      qc.invalidateQueries({ queryKey: queryKeys.officeSummary });
    },
  });
}

export function useDeleteOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/offices/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.offices });
      qc.invalidateQueries({ queryKey: queryKeys.officeSummary });
    },
  });
}

// --- Mechanics -------------------------------------------------------------
export function useMechanics() {
  return useQuery({
    queryKey: queryKeys.mechanics,
    queryFn: () => fetchAllPages<Mechanic>('/mechanics/'),
  });
}

export function useMechanicWorkload() {
  return useQuery({
    queryKey: queryKeys.mechanicWorkload,
    queryFn: async () => (await apiClient.get<MechanicWorkload[]>('/mechanics/workload/')).data,
  });
}

export function useCreateMechanic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MechanicInput) =>
      (await apiClient.post<Mechanic>('/mechanics/', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      qc.invalidateQueries({ queryKey: queryKeys.mechanicWorkload });
    },
  });
}

export function useUpdateMechanic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: MechanicInput }) =>
      (await apiClient.patch<Mechanic>(`/mechanics/${id}/`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      qc.invalidateQueries({ queryKey: queryKeys.mechanicWorkload });
    },
  });
}

export function useDeleteMechanic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/mechanics/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      qc.invalidateQueries({ queryKey: queryKeys.mechanicWorkload });
    },
  });
}

// --- Vehicles --------------------------------------------------------------
function invalidateVehicles(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['vehicles'] });
  qc.invalidateQueries({ queryKey: queryKeys.officeSummary });
}

export function useVehicles(filters: VehicleFilters, page: number) {
  return useQuery({
    queryKey: queryKeys.vehicles(filters, page),
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (filters.office) params.office = filters.office;
      if (filters.active) params.active = filters.active;
      if (filters.make) params.make = filters.make;
      if (filters.model) params.model = filters.model;
      if (filters.mechanic_certification_number) {
        params.mechanic_certification_number = filters.mechanic_certification_number;
      }
      if (filters.maintenance_from) params.maintenance_from = filters.maintenance_from;
      if (filters.maintenance_to) params.maintenance_to = filters.maintenance_to;
      const { data } = await apiClient.get<Paginated<Vehicle>>('/vehicles/', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

// Every vehicle (all pages), for selectors and id -> label lookups.
export function useAllVehicles() {
  return useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => fetchAllPages<Vehicle>('/vehicles/'),
  });
}

export function useVehicle(id: number | null) {
  return useQuery({
    queryKey: queryKeys.vehicle(id ?? 0),
    queryFn: async () => (await apiClient.get<VehicleDetail>(`/vehicles/${id}/`)).data,
    enabled: id !== null,
  });
}

export function useVehicleAlerts() {
  return useQuery({
    queryKey: queryKeys.vehicleAlerts,
    queryFn: async () =>
      (await apiClient.get<VehicleAlert[]>('/vehicles/needing-maintenance/')).data,
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleInput) =>
      (await apiClient.post<Vehicle>('/vehicles/', input)).data,
    onSuccess: () => invalidateVehicles(qc),
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: VehicleInput }) =>
      (await apiClient.patch<Vehicle>(`/vehicles/${id}/`, input)).data,
    onSuccess: (_data, variables) => {
      invalidateVehicles(qc);
      qc.invalidateQueries({ queryKey: queryKeys.vehicle(variables.id) });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/vehicles/${id}/`);
    },
    onSuccess: () => invalidateVehicles(qc),
  });
}

export function useAssignVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, office }: { id: number; office: number }) =>
      (await apiClient.post<Vehicle>(`/vehicles/${id}/assign/`, { office })).data,
    onSuccess: (_data, variables) => {
      invalidateVehicles(qc);
      qc.invalidateQueries({ queryKey: queryKeys.vehicle(variables.id) });
    },
  });
}

export function useCheckDuplicate() {
  return useMutation({
    mutationFn: async (params: { vin?: string; license_plate?: string; exclude_id?: number }) =>
      (await apiClient.get<DuplicateCheck>('/vehicles/check-duplicate/', { params })).data,
  });
}

// --- Maintenance records ---------------------------------------------------
export function useMaintenanceRecords(vehicleId: number | null, page: number) {
  return useQuery({
    queryKey: [...queryKeys.maintenanceRecords(vehicleId), page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (vehicleId) params.vehicle = vehicleId;
      const { data } = await apiClient.get<Paginated<MaintenanceRecord>>('/maintenance-records/', {
        params,
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateMaintenanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaintenanceRecordInput) =>
      (await apiClient.post<MaintenanceRecord>('/maintenance-records/', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-records'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateMaintenanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: MaintenanceRecordInput }) =>
      (await apiClient.patch<MaintenanceRecord>(`/maintenance-records/${id}/`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-records'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteMaintenanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/maintenance-records/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-records'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
