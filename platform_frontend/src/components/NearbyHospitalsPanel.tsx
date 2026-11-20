import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ambulance, Building2, LocateFixed, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getHospitals } from '../lib/api'
import { getNearbyHospitals } from '../lib/nearbyHospitals'
import type { MapPoint } from './GoogleMapView'
import { Card } from './ui/card'

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was denied. Allow location access to sort hospitals by distance.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your device could not determine its location.'
  return 'Location lookup timed out. Please try again.'
}

export function NearbyHospitalsPanel() {
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const hospitalsQuery = useQuery({
    queryKey: ['hospitals'],
    queryFn: getHospitals,
  })
  const nearbyHospitals = useMemo(
    () => getNearbyHospitals(hospitalsQuery.data ?? [], userLocation).slice(0, 4),
    [hospitalsQuery.data, userLocation],
  )

  function useMyLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location access.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude })
        setIsLocating(false)
      },
      (error) => {
        setLocationError(locationErrorMessage(error))
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  function distanceLabel(distanceKm: number): string {
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`
    return `${distanceKm.toFixed(1)} km away`
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-forest" aria-hidden="true" />
            <h2 className="font-semibold text-ink">Hospitals near you</h2>
            <span className="rounded-full bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#28664e]">Live</span>
          </div>
          <p className="mt-1 text-sm text-muted">Active hospital locations from MediConnect.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-forest disabled:cursor-wait disabled:opacity-70"
          disabled={isLocating}
          onClick={useMyLocation}
          type="button"
        >
          <LocateFixed size={15} aria-hidden="true" />
          {isLocating ? 'Finding location…' : userLocation ? 'Refresh location' : 'Use my location'}
        </button>
      </div>
      {hospitalsQuery.isLoading && <p className="mt-4 text-sm text-muted">Loading live hospital locations…</p>}
      {hospitalsQuery.isError && (
        <p role="alert" className="mt-4 text-sm text-[#9d4937]">Live hospital data could not be loaded. Please try again later.</p>
      )}
      {locationError && <p role="alert" className="mt-3 text-sm text-[#9d4937]">{locationError}</p>}
      {!userLocation && !locationError && !hospitalsQuery.isLoading && (
        <p className="mt-3 text-xs text-muted">Share your device location to see the closest hospitals first.</p>
      )}
      {!hospitalsQuery.isLoading && !hospitalsQuery.isError && nearbyHospitals.length === 0 && (
        <p className="mt-4 text-sm text-muted">No active hospitals are currently listed.</p>
      )}
      <div className="mt-4 space-y-3">
        {nearbyHospitals.map(({ hospital, distanceKm }) => (
          <article key={hospital.id} className="rounded-lg border border-[#e4e9e5] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{hospital.name}</h3>
                <p className="mt-0.5 text-sm text-muted">{hospital.city}, {hospital.country}</p>
                {(hospital.facility_level || hospital.county || hospital.ownership_type || hospital.master_facility_code) && (
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {hospital.facility_level && `Level ${hospital.facility_level}`}
                    {hospital.county && `${hospital.facility_level ? ' · ' : ''}${hospital.county}${hospital.county_rank ? ` (#${hospital.county_rank})` : ''}`}
                    {hospital.sub_county && ` · ${hospital.sub_county}${hospital.sub_county_rank ? ` (#${hospital.sub_county_rank})` : ''}`}
                    {hospital.ownership_type && ` · ${hospital.ownership_type}`}
                    {hospital.master_facility_code && ` · MFL ${hospital.master_facility_code}`}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-forest">
                {distanceKm === null ? 'Distance unavailable' : distanceLabel(distanceKm)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {hospital.phone && (
                <a href={`tel:${hospital.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-forest underline">
                  <Phone size={13} aria-hidden="true" /> Call hospital
                </a>
              )}
              <Link to={`/ambulance?hospital=${hospital.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-forest underline">
                <Ambulance size={13} aria-hidden="true" /> Request transport
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
        <p className="flex items-center gap-1 text-xs leading-5 text-muted">
          <MapPin size={13} aria-hidden="true" />
          Distance is a direct estimate based on your device location and hospital coordinates.
        </p>
        <Link to="/hospitals" className="text-sm font-semibold text-forest hover:underline">Open hospital map</Link>
      </div>
    </Card>
  )
}
