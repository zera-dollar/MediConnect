import type { Hospital } from '../types'
import { calculateStraightLineDistanceKm, type MapPoint } from '../components/GoogleMapView'

export interface NearbyHospital {
  hospital: Hospital
  distanceKm: number | null
}

export function getNearbyHospitals(
  hospitals: Hospital[],
  userLocation: MapPoint | null,
): NearbyHospital[] {
  return hospitals
    .filter((hospital) => hospital.is_active)
    .map((hospital) => {
      const latitude = hospital.latitude == null ? Number.NaN : Number(hospital.latitude)
      const longitude = hospital.longitude == null ? Number.NaN : Number(hospital.longitude)
      const hasCoordinates = Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180
      const hospitalLocation = hasCoordinates ? { lat: latitude, lng: longitude } : null
      return {
        hospital,
        distanceKm: userLocation && hospitalLocation
          ? calculateStraightLineDistanceKm(userLocation, hospitalLocation)
          : null,
      }
    })
    .sort((left, right) => (
      (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY)
      || left.hospital.name.localeCompare(right.hospital.name)
    ))
}
