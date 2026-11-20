import { describe, expect, it } from 'vitest'
import {
  filterAndSortPatientResources,
  getHospitalActionPaths,
  getPatientResourceTypes,
} from './patientResources'
import type { BloodStock, HospitalResource, OxygenSupply } from '../types'

const resources: HospitalResource[] = [
  {
    id: 1,
    hospital: 1,
    hospital_name: 'Riverside Hospital',
    resource_type: { id: 1, category: 1, category_name: 'Beds', name: 'ICU Bed', code: 'ICU', is_active: true },
    department: null,
    total_capacity: 20,
    available_quantity: 4,
    reserved_quantity: 1,
    low_stock_threshold: 3,
    is_active: true,
    is_low_stock: false,
    is_critical: false,
    occupancy_rate: 80,
    unit: 'beds',
    last_updated: '2026-11-01T10:00:00Z',
    notes: '',
  },
  {
    id: 2,
    hospital: 2,
    hospital_name: 'Central Hospital',
    resource_type: { id: 2, category: 2, category_name: 'Beds', name: 'ICU Bed', code: 'ICU', is_active: true },
    department: null,
    total_capacity: 30,
    available_quantity: 12,
    reserved_quantity: 0,
    low_stock_threshold: 4,
    is_active: true,
    is_low_stock: false,
    is_critical: false,
    occupancy_rate: 60,
    unit: 'beds',
    last_updated: '2026-11-01T10:00:00Z',
    notes: '',
  },
  {
    id: 3,
    hospital: 2,
    hospital_name: 'Central Hospital',
    resource_type: { id: 3, category: 3, category_name: 'Medical Equipment', name: 'Ventilator', code: 'VENT', is_active: true },
    department: null,
    total_capacity: 8,
    available_quantity: 3,
    reserved_quantity: 0,
    low_stock_threshold: 1,
    is_active: true,
    is_low_stock: false,
    is_critical: false,
    occupancy_rate: 60,
    unit: 'units',
    last_updated: '2026-11-01T10:00:00Z',
    notes: '',
  },
]

const oxygen: OxygenSupply[] = [
  {
    id: 1,
    hospital: 1,
    hospital_name: 'Riverside Hospital',
    supply_type: 'CYLINDER',
    capacity_litres: 100,
    current_level_litres: 20,
    number_of_units: 4,
    available_units: 2,
    low_level_threshold_pct: 10,
    location: 'Ward A',
    last_refilled: null,
    last_updated: '2026-11-01T10:00:00Z',
    level_percentage: 20,
    is_low: false,
  },
  {
    id: 2,
    hospital: 2,
    hospital_name: 'Central Hospital',
    supply_type: 'LIQUID',
    capacity_litres: 100,
    current_level_litres: 85,
    number_of_units: 1,
    available_units: 1,
    low_level_threshold_pct: 10,
    location: 'Main store',
    last_refilled: null,
    last_updated: '2026-11-01T10:00:00Z',
    level_percentage: 85,
    is_low: false,
  },
  {
    id: 3,
    hospital: 3,
    hospital_name: 'Unknown Level Hospital',
    supply_type: 'CYLINDER',
    capacity_litres: null,
    current_level_litres: 0,
    number_of_units: 100,
    available_units: 100,
    low_level_threshold_pct: 10,
    location: '',
    last_refilled: null,
    last_updated: '2026-11-01T10:00:00Z',
    level_percentage: null,
    is_low: false,
  },
]

const blood: BloodStock[] = [
  {
    id: 1,
    hospital: 1,
    hospital_name: 'Riverside Hospital',
    blood_group: 'O+',
    component: 'WHOLE',
    units_available: 2,
    units_reserved: 1,
    expiry_date: null,
    batch_number: 'B1',
    low_stock_threshold: 2,
    last_updated: '2026-11-01T10:00:00Z',
    is_low_stock: true,
  },
  {
    id: 2,
    hospital: 2,
    hospital_name: 'Central Hospital',
    blood_group: 'A+',
    component: 'WHOLE',
    units_available: 9,
    units_reserved: 0,
    expiry_date: null,
    batch_number: 'B2',
    low_stock_threshold: 3,
    last_updated: '2026-11-01T10:00:00Z',
    is_low_stock: false,
  },
]

describe('patient resource availability', () => {
  it('carries the selected hospital into appointment and ambulance flows', () => {
    expect(getHospitalActionPaths(42)).toEqual({
      appointment: '/appointments?hospital=42',
      ambulance: '/ambulance?hospital=42',
    })
  })

  it('sorts oxygen, blood, beds, and equipment from highest availability first', () => {
    const emptyFilters = { hospitalId: 'all', resourceType: 'all', search: '' }

    expect(filterAndSortPatientResources('oxygen', resources, oxygen, blood, emptyFilters).map((row) => row.availability))
      .toEqual([85, 20, 100])
    expect(filterAndSortPatientResources('oxygen', resources, oxygen, blood, emptyFilters).map((row) => row.availabilityKnown))
      .toEqual([true, true, false])
    expect(filterAndSortPatientResources('blood', resources, oxygen, blood, emptyFilters).map((row) => row.availability))
      .toEqual([9, 2])
    expect(filterAndSortPatientResources('beds', resources, oxygen, blood, emptyFilters).map((row) => row.availability))
      .toEqual([12, 4])
    expect(filterAndSortPatientResources('equipment', resources, oxygen, blood, emptyFilters).map((row) => row.availability))
      .toEqual([3])
  })

  it('filters by hospital, resource type, and search text', () => {
    const rows = filterAndSortPatientResources('blood', resources, oxygen, blood, {
      hospitalId: '1',
      resourceType: 'O+',
      search: 'riverside',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].hospitalName).toBe('Riverside Hospital')
    expect(getPatientResourceTypes('blood', resources, oxygen, blood)).toEqual(['A+', 'O+'])
  })
})
