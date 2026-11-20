import { useEffect, useMemo, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { ExternalLink, MapPin } from 'lucide-react'
import type { Hospital } from '../types'

export interface MapPoint {
  lat: number
  lng: number
}

interface GoogleMapViewProps {
  hospitals: Hospital[]
  origin: MapPoint | null
  destination: MapPoint | null
  vehicleLocation?: MapPoint | null
  vehicleLabel?: string
  originLabel: string
  destinationLabel: string
  selectedHospitalId?: number | null
  onHospitalSelect?: (hospitalId: number) => void
  heightClassName?: string
}

function hospitalPoint(hospital: Hospital): MapPoint | null {
  if (hospital.latitude == null || hospital.longitude == null) return null
  const lat = Number(hospital.latitude)
  const lng = Number(hospital.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function calculateStraightLineDistanceKm(origin: MapPoint, destination: MapPoint): number {
  const radians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = radians(destination.lat - origin.lat)
  const longitudeDelta = radians(destination.lng - origin.lng)
  const originLatitude = radians(origin.lat)
  const destinationLatitude = radians(destination.lat)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
    * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

let googleMapsPromise: Promise<void> | null = null

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!googleMapsPromise) {
    setOptions({ key: apiKey, v: 'weekly' })
    googleMapsPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('routes'),
    ]).then(() => undefined)
  }
  return googleMapsPromise
}

export function GoogleMapView({
  hospitals,
  origin,
  destination,
  vehicleLocation = null,
  vehicleLabel = 'Ambulance location',
  originLabel,
  destinationLabel,
  selectedHospitalId = null,
  onHospitalSelect,
  heightClassName = 'h-[420px]',
}: GoogleMapViewProps) {
  const mapElement = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null)
  const markers = useRef<google.maps.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

  const hospitalPoints = useMemo(
    () => hospitals.flatMap((hospital) => {
      const point = hospitalPoint(hospital)
      return point ? [{ hospital, point }] : []
    }),
    [hospitals],
  )

  const originKey = origin ? `${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}` : ''
  const destinationKey = destination ? `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}` : ''

  useEffect(() => {
    if (!apiKey || !mapElement.current) return
    let active = true
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!active || !mapElement.current || mapInstance.current) return
        const initialCenter = origin
          ?? hospitalPoints[0]?.point
          ?? { lat: -1.2864, lng: 36.8172 }
        mapInstance.current = new google.maps.Map(mapElement.current, {
          center: initialCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })
        directionsRenderer.current = new google.maps.DirectionsRenderer({
          map: mapInstance.current,
          suppressMarkers: true,
          preserveViewport: false,
        })
        setMapReady(true)
      })
      .catch(() => {
        if (active) setMapError('Google Maps could not load. Check the API key, enabled APIs, and billing configuration.')
      })
    return () => {
      active = false
    }
  }, [apiKey, hospitalPoints, origin])

  useEffect(() => {
    const map = mapInstance.current
    if (!mapReady || !map) return

    markers.current.forEach((marker) => marker.setMap(null))
    markers.current = []
    const bounds = new google.maps.LatLngBounds()
    let hasBounds = false

    for (const { hospital, point } of hospitalPoints) {
      const marker = new google.maps.Marker({
        map,
        position: point,
        title: `${hospital.name} — ${hospital.city}`,
        label: hospital.id === selectedHospitalId ? 'H' : undefined,
      })
      if (onHospitalSelect) {
        marker.addListener('click', () => onHospitalSelect(hospital.id))
      }
      markers.current.push(marker)
      bounds.extend(point)
      hasBounds = true
    }

    if (origin) {
      markers.current.push(new google.maps.Marker({
        map,
        position: origin,
        title: originLabel,
        label: 'P',
      }))
      bounds.extend(origin)
      hasBounds = true
    }

    if (destination) {
      markers.current.push(new google.maps.Marker({
        map,
        position: destination,
        title: destinationLabel,
        label: 'D',
      }))
      bounds.extend(destination)
      hasBounds = true
    }

    if (vehicleLocation) {
      markers.current.push(new google.maps.Marker({
        map,
        position: vehicleLocation,
        title: vehicleLabel,
        label: 'A',
      }))
    }

    if (hasBounds) map.fitBounds(bounds)
  }, [
    destination,
    destinationLabel,
    hospitalPoints,
    mapReady,
    onHospitalSelect,
    origin,
    originLabel,
    selectedHospitalId,
    vehicleLabel,
    vehicleLocation,
  ])

  useEffect(() => {
    if (!mapReady || !originKey || !destinationKey || !directionsRenderer.current) {
      setRouteSummary(null)
      return
    }
    const [originLatitude, originLongitude] = originKey.split(',').map(Number)
    const [destinationLatitude, destinationLongitude] = destinationKey.split(',').map(Number)
    const directionsService = new google.maps.DirectionsService()
    directionsService.route(
      {
        origin: { lat: originLatitude, lng: originLongitude },
        destination: { lat: destinationLatitude, lng: destinationLongitude },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, routeStatus) => {
        if (routeStatus === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.current?.setDirections(result)
          setMapError(null)
          const leg = result.routes[0]?.legs[0]
          setRouteSummary(
            leg?.distance?.text && leg.duration?.text
              ? { distance: leg.distance.text, duration: leg.duration.text }
              : null,
          )
        } else {
          setRouteSummary(null)
          setMapError('Google Maps could not calculate a driving route between these locations.')
        }
      },
    )
  }, [destinationKey, mapReady, originKey])

  const mapsDirectionsUrl = origin && destination
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`
    : destination
      ? `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`
      : null
  const directDistance = origin && destination
    ? calculateStraightLineDistanceKm(origin, destination)
    : null

  return (
    <section className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-panel">
      {apiKey ? (
        <div ref={mapElement} className={heightClassName} aria-label="Google map of hospitals and route" />
      ) : (
        <div className={`flex ${heightClassName} flex-col items-center justify-center bg-[#eaf0ec] px-6 text-center`}>
          <MapPin className="text-forest" size={30} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">Google Maps key required</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in the frontend environment and enable Maps JavaScript API and Directions API.
          </p>
          {mapsDirectionsUrl && (
            <a
              href={mapsDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-[#164333]"
            >
              Open in Google Maps <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {apiKey && mapError && (
        <p role="alert" className="border-t border-[#f1d8d1] bg-[#fff7f4] px-4 py-3 text-sm text-[#9d4937]">
          {mapError}
          {mapsDirectionsUrl && (
            <> <a className="font-semibold underline" href={mapsDirectionsUrl} target="_blank" rel="noreferrer">Open Google Maps</a>.</>
          )}
        </p>
      )}
      {routeSummary && (
        <p className="border-t border-black/[0.06] px-4 py-3 text-sm text-ink" role="status">
          Driving route: <strong>{routeSummary.distance}</strong> · estimated <strong>{routeSummary.duration}</strong>
        </p>
      )}
      {!apiKey && directDistance !== null && (
        <p className="border-t border-black/[0.06] px-4 py-3 text-sm text-muted" role="status">
          Direct-line distance: {directDistance.toFixed(1)} km. Driving distance and ETA require the Google Maps API key.
        </p>
      )}
    </section>
  )
}
