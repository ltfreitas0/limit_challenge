// Shared API types for the Fleet Tracker backend.
// Field names mirror the DRF serializers in backend/fleet/serializers.py.

export interface Office {
  id: number;
  name: string;
  city: string;
}

export interface OfficeSummary extends Office {
  active_vehicle_count: number;
  maintenance_cost_last_year: string;
  last_maintenance: string | null;
}

export interface Mechanic {
  id: number;
  name: string;
  certification_number: string;
  is_active: boolean;
}

export interface MechanicWorkload {
  id: number;
  name: string;
  certification_number: string;
  maintenance_count: number;
  total_cost: string;
}

export interface Vehicle {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  office_name: string;
  is_active: boolean;
}

export interface MaintenanceRecordRead {
  id: number;
  mechanic: Mechanic;
  maintenance_date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
}

export interface VehicleDetail {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  is_active: boolean;
  office: Office;
  maintenance_history: MaintenanceRecordRead[];
}

export interface VehicleAlert {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  is_active: boolean;
  office: Office;
  last_maintenance_date: string | null;
}

export interface MaintenanceRecord {
  id: number;
  vehicle: number;
  mechanic: number;
  maintenance_date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuthTokens {
  access: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface OfficeInput {
  name: string;
  city: string;
}

export interface MechanicInput {
  name: string;
  certification_number: string;
  is_active: boolean;
}

export interface VehicleInput {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  is_active: boolean;
}

export interface MaintenanceRecordInput {
  vehicle: number;
  mechanic: number;
  maintenance_date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
}

export interface VehicleFilters {
  office: string;
  active: '' | 'true' | 'false';
  make: string;
  model: string;
  mechanic_certification_number: string;
  maintenance_from: string;
  maintenance_to: string;
}

export const EMPTY_VEHICLE_FILTERS: VehicleFilters = {
  office: '',
  active: '',
  make: '',
  model: '',
  mechanic_certification_number: '',
  maintenance_from: '',
  maintenance_to: '',
};

export interface DuplicateCheck {
  conflicts: string[];
}

// Normalised shape for DRF validation errors (which may be string | string[] | nested).
export type FieldErrors = Record<string, string>;
