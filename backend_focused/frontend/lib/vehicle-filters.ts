import { EMPTY_VEHICLE_FILTERS, type VehicleFilters } from './types';

type FilterReader = { get: (key: string) => string | null };

const FILTER_KEYS = Object.keys(EMPTY_VEHICLE_FILTERS) as (keyof VehicleFilters)[];

// Read vehicle filters out of a URLSearchParams-like object.
export function parseVehicleFilters(params: FilterReader): VehicleFilters {
  return {
    office: params.get('office') ?? '',
    active: (params.get('active') as VehicleFilters['active']) ?? '',
    make: params.get('make') ?? '',
    model: params.get('model') ?? '',
    mechanic_certification_number: params.get('mechanic_certification_number') ?? '',
    maintenance_from: params.get('maintenance_from') ?? '',
    maintenance_to: params.get('maintenance_to') ?? '',
  };
}

// Serialise the non-empty filters back into a query string.
export function buildVehicleFilterQuery(filters: VehicleFilters): string {
  const params = new URLSearchParams();
  FILTER_KEYS.forEach((key) => {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export function countActiveFilters(filters: VehicleFilters): number {
  return FILTER_KEYS.filter((key) => Boolean(filters[key])).length;
}
