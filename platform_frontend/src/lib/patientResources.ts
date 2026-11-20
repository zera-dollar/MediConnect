import type { BloodStock, HospitalResource, OxygenSupply } from '../types'

export type PatientResourceTab = 'oxygen' | 'blood' | 'beds' | 'equipment'

export interface PatientResourceRecord {
  id: string
  hospitalId: number
  hospitalName: string
  name: string
  type: string
  availability: number
  availabilityKnown: boolean
  availabilityLabel: string
  detail: string
  updatedAt: string
  searchText: string
}

export interface PatientResourceFilters {
  hospitalId: string
  resourceType: string
  search: string
}

export function getHospitalActionPaths(hospitalId: number): {
  appointment: string
  ambulance: string
} {
  return {
    appointment: `/appointments?hospital=${hospitalId}`,
    ambulance: `/ambulance?hospital=${hospitalId}`,
  }
}

function asNumber(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resourceRecord(
  tab: PatientResourceTab,
  resources: HospitalResource[],
  oxygen: OxygenSupply[],
  blood: BloodStock[],
): PatientResourceRecord[] {
  if (tab === 'oxygen') {
    return oxygen.map((supply) => {
      const levelPercentage = asNumber(supply.level_percentage)
      const currentLevel = asNumber(supply.current_level_litres) ?? 0
      const capacity = asNumber(supply.capacity_litres)
      const detail = levelPercentage === null
        ? `${supply.available_units} units available · level not reported`
        : `${currentLevel.toLocaleString()} / ${(capacity ?? 0).toLocaleString()} litres`
      return {
        id: `oxygen-${supply.id}`,
        hospitalId: supply.hospital,
        hospitalName: supply.hospital_name,
        name: supply.supply_type.replace(/_/g, ' '),
        type: supply.supply_type.replace(/_/g, ' '),
        availability: levelPercentage ?? supply.available_units,
        availabilityKnown: levelPercentage !== null,
        availabilityLabel: levelPercentage === null
          ? `${supply.available_units} units available`
          : `${levelPercentage}% level`,
        detail,
        updatedAt: supply.last_updated,
        searchText: `${supply.hospital_name} ${supply.supply_type} ${supply.location}`.toLowerCase(),
      }
    })
  }

  if (tab === 'blood') {
    return blood.map((stock) => ({
      id: `blood-${stock.id}`,
      hospitalId: stock.hospital,
      hospitalName: stock.hospital_name,
      name: `${stock.blood_group} · ${stock.component.replace(/_/g, ' ')}`,
      type: stock.blood_group,
      availability: stock.units_available,
      availabilityKnown: true,
      availabilityLabel: `${stock.units_available} units available`,
      detail: `${stock.units_reserved} units reserved${stock.expiry_date ? ` · expires ${stock.expiry_date}` : ''}`,
      updatedAt: stock.last_updated,
      searchText: `${stock.hospital_name} ${stock.blood_group} ${stock.component} ${stock.batch_number}`.toLowerCase(),
    }))
  }

  const category = tab === 'beds' ? 'beds' : 'equipment'
  return resources
    .filter((resource) => {
      const resourceCategory = resource.resource_type.category_name.toLowerCase()
      return resource.is_active && resourceCategory.includes(category)
    })
    .map((resource) => ({
      id: `${tab}-${resource.id}`,
      hospitalId: resource.hospital,
      hospitalName: resource.hospital_name,
      name: resource.resource_type.name,
      type: resource.resource_type.name,
      availability: resource.available_quantity,
      availabilityKnown: true,
      availabilityLabel: `${resource.available_quantity} ${resource.unit || 'units'} available`,
      detail: `${resource.total_capacity} total${resource.reserved_quantity ? ` · ${resource.reserved_quantity} reserved` : ''}`,
      updatedAt: resource.last_updated,
      searchText: `${resource.hospital_name} ${resource.resource_type.name} ${resource.resource_type.category_name} ${resource.resource_type.code} ${resource.unit} ${resource.notes}`.toLowerCase(),
    }))
}

export function getPatientResourceTypes(
  tab: PatientResourceTab,
  resources: HospitalResource[],
  oxygen: OxygenSupply[],
  blood: BloodStock[],
): string[] {
  return [...new Set(resourceRecord(tab, resources, oxygen, blood).map((record) => record.type))]
    .sort((left, right) => left.localeCompare(right))
}

export function filterAndSortPatientResources(
  tab: PatientResourceTab,
  resources: HospitalResource[],
  oxygen: OxygenSupply[],
  blood: BloodStock[],
  filters: PatientResourceFilters,
): PatientResourceRecord[] {
  const search = filters.search.trim().toLowerCase()
  return resourceRecord(tab, resources, oxygen, blood)
    .filter((record) => filters.hospitalId === 'all' || String(record.hospitalId) === filters.hospitalId)
    .filter((record) => filters.resourceType === 'all' || record.type === filters.resourceType)
    .filter((record) => !search || record.searchText.includes(search))
    .sort((left, right) => (
      Number(right.availabilityKnown) - Number(left.availabilityKnown)
      || right.availability - left.availability
      || left.hospitalName.localeCompare(right.hospitalName)
      || left.name.localeCompare(right.name)
    ))
}
