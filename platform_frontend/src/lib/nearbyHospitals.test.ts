import { describe, expect, it } from 'vitest'
import { getNearbyHospitals } from './nearbyHospitals'
import type { Hospital } from '../types'

const hospitals: Hospital[] = [
  {
    id: 1,
    name: 'Far Hospital',
    city: 'Nairobi',
    country: 'Kenya',
    is_active: true,
    latitude: -1.30,
    longitude: 36.82,
  },
  {
    id: 2,
    name: 'Nearby Hospital',
    city: 'Nairobi',
    country: 'Kenya',
    is_active: true,
    latitude: -1.29,
    longitude: 36.82,
  },
  {
    id: 3,
    name: 'Inactive Hospital',
    city: 'Nairobi',
    country: 'Kenya',
    is_active: false,
    latitude: -1.28,
    longitude: 36.82,
  },
  {
    id: 4,
    name: 'Unlocated Hospital',
    city: 'Nairobi',
    country: 'Kenya',
    is_active: true,
    latitude: null,
    longitude: null,
  },
]

describe('nearby hospitals', () => {
  it('orders live active hospitals by direct distance and puts missing coordinates last', () => {
    const nearby = getNearbyHospitals(hospitals, { lat: -1.291, lng: 36.82 })

    expect(nearby.map(({ hospital }) => hospital.name)).toEqual([
      'Nearby Hospital',
      'Far Hospital',
      'Unlocated Hospital',
    ])
    expect(nearby[0].distanceKm).not.toBeNull()
    expect(nearby[2].distanceKm).toBeNull()
  })

  it('lists active hospitals without distance until location is shared', () => {
    const nearby = getNearbyHospitals(hospitals, null)

    expect(nearby).toHaveLength(3)
    expect(nearby.every(({ distanceKm }) => distanceKm === null)).toBe(true)
  })
})
