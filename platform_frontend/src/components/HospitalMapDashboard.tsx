import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Ambulance, Building2, LocateFixed, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getHospitals } from '../lib/api'
import { useAuthStore } from '../store/auth'
import type { Hospital } from '../types'
import { GoogleMapView, calculateStraightLineDistanceKm, type MapPoint } from './GoogleMapView'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Card, CardHeader, CardTitle } from './ui/card'

function getHospitalPoint(hospital: Hospital): MapPoint | null {
  if (hospital.latitude == null || hospital.longitude == null) return null
  const lat = Number(hospital.latitude)
  const lng = Number(hospital.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was denied. Allow location access or select a hospital to view its map.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your device could not determine its location.'
  return 'Location lookup timed out. Please try again.'
}

export function HospitalMapDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const hospitalsQuery = useQuery({
    queryKey: ['hospitals'],
    queryFn: getHospitals,
    enabled: Boolean(token),
  })
  const [patientLocation, setPatientLocation] = useState<MapPoint | null>(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const hospitals = hospitalsQuery.data ?? []

  const nearbyHospitals = useMemo(() => hospitals
    .map((hospital) => {
      const point = getHospitalPoint(hospital)
      return {
        hospital,
        point,
        distance: patientLocation && point
          ? calculateStraightLineDistanceKm(patientLocation, point)
          : null,
      }
    })
    .sort((left, right) => (left.distance ?? Infinity) - (right.distance ?? Infinity)),
  [hospitals, patientLocation])

  useEffect(() => {
    if (selectedHospitalId !== null || nearbyHospitals.length === 0) return
    setSelectedHospitalId(nearbyHospitals[0].hospital.id)
  }, [nearbyHospitals, selectedHospitalId])

  const selectedHospital = hospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null
  const destination = selectedHospital ? getHospitalPoint(selectedHospital) : null
  const selectHospital = useCallback((hospitalId: number) => {
    setSelectedHospitalId(hospitalId)
  }, [])

  function useMyLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location access.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPatientLocation({ lat: coords.latitude, lng: coords.longitude }),
      (error) => setLocationError(locationErrorMessage(error)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-ink">
        <Card className="max-w-lg p-7">
          <CardHeader>
            <CardTitle>Find a hospital</CardTitle>
          </CardHeader>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in or create a patient account to view nearby hospitals and route estimates.</p>
          <div className="mt-5 flex gap-3">
            <Link to="/connect" className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
            <Link to="/register" className="rounded-md border border-[#d8e0db] px-4 py-2 text-sm font-semibold text-ink">Create patient account</Link>
          </div>
        </Card>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside className="flex shrink-0 flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:w-[236px]">
        <Link to="/" className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#d8eee4] text-forest">
            <Activity size={21} aria-hidden="true" />
          </span>
          <span><span className="block text-[15px] font-semibold">MediConnect</span><span className="mt-0.5 block text-[11px] text-white/55">CARE OPERATIONS</span></span>
        </Link>
        <WorkspaceNavigation current="/hospitals" />
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-forest">Hospital locations</p>
              <h1 className="mt-1 text-2xl font-semibold">Find care near you</h1>
              <p className="mt-1 text-sm text-muted">Select a hospital to see the driving distance and estimated travel time from your location.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{user?.full_name || user?.email}</span>
              <Link to="/ambulance" className="inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#164333]">
                <Ambulance size={16} aria-hidden="true" /> Ambulance request
              </Link>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {patientLocation ? 'Using your current device location.' : 'Allow location access to rank hospitals by distance.'}
                </p>
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="inline-flex items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-forest"
                >
                  <LocateFixed size={16} aria-hidden="true" /> Use my location
                </button>
              </div>
              {locationError && <p role="alert" className="mb-3 rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{locationError}</p>}
              {hospitalsQuery.isError && <p role="alert" className="mb-3 rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">Could not load hospitals. Check your connection and try again.</p>}
              <GoogleMapView
                hospitals={hospitals}
                origin={patientLocation}
                destination={destination}
                originLabel="Your location"
                destinationLabel={selectedHospital?.name ?? 'Selected hospital'}
                selectedHospitalId={selectedHospitalId}
                onHospitalSelect={selectHospital}
                heightClassName="h-[480px]"
              />
            </section>

            <Card className="p-5">
              <CardHeader>
                <CardTitle>Nearby hospitals</CardTitle>
                <p className="mt-1 text-sm text-muted">
                  {hospitalsQuery.isLoading ? 'Loading hospital locations…' : `${nearbyHospitals.length} active hospitals`}
                </p>
              </CardHeader>
              <div className="mt-4 max-h-[570px] space-y-3 overflow-y-auto pr-1">
                {nearbyHospitals.map(({ hospital, point, distance }) => (
                  <div
                    key={hospital.id}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      hospital.id === selectedHospitalId
                        ? 'border-forest bg-[#f0f7f3]'
                        : 'border-black/[0.07] bg-white hover:border-[#9db8a9]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedHospitalId(hospital.id)}
                      className="w-full text-left"
                    >
                      <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="flex items-center gap-2 font-semibold text-ink"><Building2 size={16} aria-hidden="true" />{hospital.name}</span>
                        <span className="mt-1 block text-sm text-muted">{hospital.city}, {hospital.country}</span>
                        {(hospital.facility_level || hospital.county || hospital.ownership_type || hospital.master_facility_code) && (
                          <span className="mt-1 block text-[11px] leading-5 text-muted">
                            {hospital.facility_level && `Level ${hospital.facility_level}`}
                            {hospital.county && `${hospital.facility_level ? ' · ' : ''}${hospital.county}${hospital.county_rank ? ` (#${hospital.county_rank})` : ''}`}
                            {hospital.sub_county && ` · ${hospital.sub_county}${hospital.sub_county_rank ? ` (#${hospital.sub_county_rank})` : ''}`}
                            {hospital.ownership_type && ` · ${hospital.ownership_type}`}
                            {hospital.master_facility_code && ` · MFL ${hospital.master_facility_code}`}
                          </span>
                        )}
                      </span>
                      {distance !== null && <span className="shrink-0 text-sm font-semibold text-forest">{distance.toFixed(1)} km direct</span>}
                      </span>
                      {!point && <span className="mt-2 block text-xs text-[#9d4937]">Location coordinates unavailable</span>}
                    </button>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {hospital.phone && (
                        <a
                          href={`tel:${hospital.phone}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-forest underline"
                        >
                          <Phone size={13} aria-hidden="true" /> Call hospital
                        </a>
                      )}
                      <Link
                        to={`/ambulance?hospital=${hospital.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-forest underline"
                      >
                        <MapPin size={13} aria-hidden="true" /> Request transport
                      </Link>
                    </div>
                  </div>
                ))}
                {!hospitalsQuery.isLoading && nearbyHospitals.length === 0 && (
                  <p className="rounded-md bg-[#f4f7f5] p-4 text-sm text-muted">No active hospitals are available.</p>
                )}
              </div>
              <p className="mt-4 border-t border-black/[0.06] pt-3 text-xs leading-5 text-muted">
                Direct distance is approximate. Google Maps driving distance and ETA are shown for the selected hospital when the API key is configured.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
