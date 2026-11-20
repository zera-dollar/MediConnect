import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Ambulance, Clock3, LocateFixed, MapPin, ShieldAlert, Link2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cancelAmbulanceRequest,
  createDriverTelemetrySession,
  createAmbulanceRequest,
  dispatchAmbulanceRequest,
  getAmbulanceRequests,
  getHospitals,
  updateAmbulanceLocation,
  updateAmbulanceStatus,
} from '../lib/api'
import { useAuthStore } from '../store/auth'
import type {
  AmbulanceDispatch,
  AmbulanceLocationUpdate,
  AmbulanceRequest,
  AmbulanceRequestStatus,
  Hospital,
} from '../types'
import { GoogleMapView, type MapPoint } from './GoogleMapView'
import { WorkspaceNavigation } from './WorkspaceNavigation'
import { Card, CardHeader, CardTitle } from './ui/card'
import { useAmbulanceLiveLocation } from '../lib/useAmbulanceLiveLocation'

interface DispatchForm {
  ambulance_code: string
  latitude: string
  longitude: string
  eta_minutes: string
}

const initialDispatchForm: DispatchForm = {
  ambulance_code: '',
  latitude: '',
  longitude: '',
  eta_minutes: '10',
}

function mapPoint(latitude: number | string | null, longitude: number | string | null): MapPoint | null {
  if (latitude === null || longitude === null) return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function statusLabel(status: AmbulanceRequestStatus): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function geolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was denied. Allow location access or enter coordinates manually.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your device could not determine its location.'
  return 'Location lookup timed out. Please try again.'
}

export function AmbulanceDashboard() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [destinationHospitalId, setDestinationHospitalId] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupPoint, setPickupPoint] = useState<MapPoint | null>(null)
  const [pickupLatitudeInput, setPickupLatitudeInput] = useState('')
  const [pickupLongitudeInput, setPickupLongitudeInput] = useState('')
  const [patientNotes, setPatientNotes] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [dispatchForms, setDispatchForms] = useState<Record<number, DispatchForm>>({})
  const [driverLinks, setDriverLinks] = useState<Record<number, string>>({})
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const hospitalsQuery = useQuery({
    queryKey: ['hospitals'],
    queryFn: getHospitals,
    enabled: Boolean(token),
  })
  const requestsQuery = useQuery({
    queryKey: ['ambulance-requests'],
    queryFn: getAmbulanceRequests,
    enabled: Boolean(token),
    refetchInterval: 5000,
  })
  const hospitals = hospitalsQuery.data ?? []
  const requests = requestsQuery.data ?? []
  const canDispatch = user?.role === 'ADMIN'
    || user?.role === 'HOSPITAL_ADMIN'
    || requests.some((request) => request.patient !== user?.id)
  const callNumber = import.meta.env.VITE_AMBULANCE_PHONE?.trim()

  useEffect(() => {
    const queryHospital = searchParams.get('hospital')
    if (queryHospital && hospitals.some((hospital) => hospital.id === Number(queryHospital))) {
      setDestinationHospitalId(queryHospital)
    } else if (!destinationHospitalId && hospitals.length) {
      setDestinationHospitalId(String(hospitals[0].id))
    }
  }, [destinationHospitalId, hospitals, searchParams])

  const createMutation = useMutation({
    mutationFn: createAmbulanceRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] })
      setPickupAddress('')
      setPatientNotes('')
    },
  })
  const dispatchMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: AmbulanceDispatch }) =>
      dispatchAmbulanceRequest(requestId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] }),
  })
  const locationMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: AmbulanceLocationUpdate }) =>
      updateAmbulanceLocation(requestId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] }),
  })
  const statusMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: number; status: AmbulanceRequestStatus }) =>
      updateAmbulanceStatus(requestId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] }),
  })
  const cancelMutation = useMutation({
    mutationFn: cancelAmbulanceRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ambulance-requests'] }),
  })
  const driverLinkMutation = useMutation({
    mutationFn: createDriverTelemetrySession,
    onSuccess: (session, requestId) => {
      setDriverLinks((current) => ({ ...current, [requestId]: session.driver_url }))
    },
  })

  function useDeviceLocation(onLocated: (point: MapPoint) => void) {
    setLocationError(null)
    setTrackingError(null)
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location access.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onLocated({ lat: coords.latitude, lng: coords.longitude }),
      (error) => setLocationError(geolocationError(error)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    )
  }

  function updateDispatchForm(requestId: number, patch: Partial<DispatchForm>) {
    setDispatchForms((current) => ({
      ...current,
      [requestId]: { ...initialDispatchForm, ...current[requestId], ...patch },
    }))
  }

  function getDispatchForm(requestId: number): DispatchForm {
    return dispatchForms[requestId] ?? initialDispatchForm
  }

  function submitAmbulanceRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pickupPoint) {
      setLocationError('Set your pickup location before requesting an ambulance.')
      return
    }
    createMutation.mutate({
      destination_hospital: Number(destinationHospitalId),
      pickup_address: pickupAddress.trim(),
      pickup_latitude: pickupPoint.lat,
      pickup_longitude: pickupPoint.lng,
      patient_notes: patientNotes.trim(),
    })
  }

  function dispatch(requestId: number) {
    const form = getDispatchForm(requestId)
    const payload = {
      ambulance_code: form.ambulance_code.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      eta_minutes: Number(form.eta_minutes),
    }
    dispatchMutation.mutate({ requestId, payload })
  }

  function updateVehicleLocation(requestId: number) {
    const form = getDispatchForm(requestId)
    locationMutation.mutate({
      requestId,
      payload: {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        eta_minutes: Number(form.eta_minutes),
      },
    })
  }

  function useVehicleLocation(requestId: number) {
    if (!navigator.geolocation) {
      setTrackingError('This browser does not support location access.')
      return
    }
    setTrackingError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => updateDispatchForm(requestId, {
        latitude: coords.latitude.toFixed(6),
        longitude: coords.longitude.toFixed(6),
      }),
      (error) => setTrackingError(geolocationError(error)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
  }

  const trackedRequest = requests.find((request) => request.status === 'EN_ROUTE')
    ?? requests.find((request) => request.status === 'REQUESTED')
  const liveLocation = useAmbulanceLiveLocation(
    trackedRequest?.status === 'EN_ROUTE' ? trackedRequest.id : null,
    token,
  )
  const hospitalMapPoints = hospitals
  const trackerOrigin = liveLocation.location
    ? { lat: liveLocation.location.latitude, lng: liveLocation.location.longitude }
    : trackedRequest
      ? mapPoint(trackedRequest.ambulance_latitude, trackedRequest.ambulance_longitude)
      : null
  const trackerRouteOrigin = trackedRequest
    ? trackedRequest.source_hospital
      ? mapPoint(trackedRequest.source_hospital.latitude, trackedRequest.source_hospital.longitude)
      : mapPoint(trackedRequest.pickup_latitude, trackedRequest.pickup_longitude)
    : null
  const trackerDestination = trackedRequest
    ? mapPoint(trackedRequest.destination_hospital_latitude, trackedRequest.destination_hospital_longitude)
    : null

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-5 text-ink">
        <Card className="max-w-lg p-7">
          <CardHeader><CardTitle>Ambulance services</CardTitle></CardHeader>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in or create a patient account to request and track transport.</p>
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
        <WorkspaceNavigation current="/ambulance" />
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-forest">Patient transport</p>
            <h1 className="mt-1 text-2xl font-semibold">Ambulance services</h1>
            <p className="mt-1 text-sm text-muted">Request transport and follow dispatch updates from the destination hospital.</p>
          </header>

          <p role="note" className="mb-5 flex items-start gap-3 rounded-lg border border-[#ecd9ae] bg-[#fff9ed] p-4 text-sm leading-6 text-[#76551a]">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            This app is not connected to a real ambulance provider. Requests go to the destination hospital’s in-app dispatch team. For an emergency, call your local emergency service.
            {callNumber
              ? <a href={`tel:${callNumber}`} className="shrink-0 font-semibold underline">Call ambulance service</a>
              : <span className="shrink-0">Direct call: configure <code>VITE_AMBULANCE_PHONE</code>.</span>}
          </p>

          <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <Card className="p-5">
              <CardHeader>
                <CardTitle>Request an ambulance</CardTitle>
                <p className="mt-1 text-sm text-muted">Share your pickup location and destination hospital.</p>
              </CardHeader>
              <form className="mt-5 space-y-4" onSubmit={submitAmbulanceRequest}>
                <label className="block text-sm font-medium text-ink">
                  Destination hospital
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] bg-white px-3"
                    value={destinationHospitalId}
                    onChange={(event) => setDestinationHospitalId(event.target.value)}
                    required
                  >
                    {hospitals.map((hospital: Hospital) => (
                      <option key={hospital.id} value={hospital.id}>{hospital.name} — {hospital.city}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Pickup address or landmark
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#d8e0db] px-3"
                    value={pickupAddress}
                    onChange={(event) => setPickupAddress(event.target.value)}
                    placeholder="Street, building, or nearby landmark"
                    required
                  />
                </label>
                <div className="rounded-md bg-[#f4f7f5] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {pickupPoint
                        ? `Pickup coordinates: ${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`
                        : 'Pickup coordinates not set'}
                    </span>
                    <button
                      type="button"
                      onClick={() => useDeviceLocation((point) => {
                        setPickupPoint(point)
                        setPickupLatitudeInput(point.lat.toFixed(6))
                        setPickupLongitudeInput(point.lng.toFixed(6))
                      })}
                      className="inline-flex items-center gap-2 rounded-md border border-[#d8e0db] bg-white px-3 py-2 text-sm font-semibold text-ink"
                    >
                      <LocateFixed size={15} aria-hidden="true" /> Use my location
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium text-muted">Latitude
                      <input
                        type="number"
                        step="0.000001"
                        value={pickupLatitudeInput}
                        onChange={(event) => {
                          const value = event.target.value
                          setPickupLatitudeInput(value)
                          const latitude = Number(value)
                          const longitude = Number(pickupLongitudeInput)
                          setPickupPoint(value && pickupLongitudeInput && Number.isFinite(latitude) && Number.isFinite(longitude)
                            ? { lat: latitude, lng: longitude }
                            : null)
                        }}
                        className="mt-1 h-9 w-full rounded border border-[#d8e0db] bg-white px-2 text-sm text-ink"
                      />
                    </label>
                    <label className="text-xs font-medium text-muted">Longitude
                      <input
                        type="number"
                        step="0.000001"
                        value={pickupLongitudeInput}
                        onChange={(event) => {
                          const value = event.target.value
                          setPickupLongitudeInput(value)
                          const latitude = Number(pickupLatitudeInput)
                          const longitude = Number(value)
                          setPickupPoint(pickupLatitudeInput && value && Number.isFinite(latitude) && Number.isFinite(longitude)
                            ? { lat: latitude, lng: longitude }
                            : null)
                        }}
                        className="mt-1 h-9 w-full rounded border border-[#d8e0db] bg-white px-2 text-sm text-ink"
                      />
                    </label>
                  </div>
                </div>
                <label className="block text-sm font-medium text-ink">
                  Notes for dispatch <span className="font-normal text-muted">(optional; avoid sensitive details)</span>
                  <textarea
                    className="mt-2 w-full rounded-md border border-[#d8e0db] px-3 py-2"
                    rows={3}
                    maxLength={1000}
                    value={patientNotes}
                    onChange={(event) => setPatientNotes(event.target.value)}
                  />
                </label>
                {locationError && <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{locationError}</p>}
                {createMutation.isError && <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">Could not create the request. Confirm the hospital and location, then retry.</p>}
                <button
                  type="submit"
                  disabled={createMutation.isPending || !hospitals.length || !pickupPoint}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-[#164333] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Ambulance size={17} aria-hidden="true" />{createMutation.isPending ? 'Sending request…' : 'Request ambulance'}
                </button>
              </form>
            </Card>

            <div className="space-y-5">
              {trackedRequest && (
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Live request tracking</h2>
                    <span className="inline-flex items-center gap-2 text-xs text-muted">
                      <span className={`h-2 w-2 rounded-full ${liveLocation.status === 'live' && liveLocation.location ? 'animate-pulse bg-[#3e8a69]' : 'bg-[#d49a36]'}`} />
                      {liveLocation.location ? `Live GPS · ${new Date(liveLocation.location.received_at).toLocaleTimeString()}` : 'Waiting for driver GPS'}
                    </span>
                  </div>
                  <GoogleMapView
                    hospitals={hospitalMapPoints}
                    origin={trackerRouteOrigin}
                    destination={trackerDestination}
                    originLabel={trackedRequest.source_hospital?.name ?? `Pickup: ${trackedRequest.pickup_address}`}
                    destinationLabel={trackedRequest.destination_hospital_name ?? 'Receiving hospital'}
                    vehicleLocation={trackerOrigin}
                    vehicleLabel={trackedRequest.ambulance_code || 'Ambulance location'}
                    heightClassName="h-[360px]"
                  />
                  <p className="mt-2 text-xs text-muted">Live location is streamed only while the driver shares it; coordinates expire from the live service after five minutes without an update.</p>
                </section>
              )}

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Your requests</CardTitle>
                  <p className="mt-1 text-sm text-muted">{requestsQuery.isLoading ? 'Loading requests…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}</p>
                </CardHeader>
                {requestsQuery.isError && <p role="alert" className="mt-4 rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">Could not load ambulance requests. Check your access and retry.</p>}
                <div className="mt-4 space-y-4">
                  {requests.map((ambulanceRequest: AmbulanceRequest) => (
                    <AmbulanceRequestCard
                      key={ambulanceRequest.id}
                      request={ambulanceRequest}
                      canDispatch={Boolean(canDispatch)}
                      currentUserId={user?.id}
                      form={getDispatchForm(ambulanceRequest.id)}
                      dispatchPending={dispatchMutation.isPending}
                      locationPending={locationMutation.isPending}
                      statusPending={statusMutation.isPending}
                      cancelPending={cancelMutation.isPending}
                      onFormChange={(patch) => updateDispatchForm(ambulanceRequest.id, patch)}
                      onDispatch={() => dispatch(ambulanceRequest.id)}
                      onUseVehicleLocation={() => useVehicleLocation(ambulanceRequest.id)}
                      onUpdateVehicleLocation={() => updateVehicleLocation(ambulanceRequest.id)}
                      onStatusChange={(status) => statusMutation.mutate({ requestId: ambulanceRequest.id, status })}
                      onCancel={() => cancelMutation.mutate(ambulanceRequest.id)}
                      onCreateDriverLink={() => driverLinkMutation.mutate(ambulanceRequest.id)}
                      driverLink={driverLinks[ambulanceRequest.id]}
                      driverLinkPending={driverLinkMutation.isPending}
                    />
                  ))}
                  {!requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0 && (
                    <p className="rounded-md bg-[#f4f7f5] p-4 text-sm text-muted">No ambulance requests yet.</p>
                  )}
                  {trackingError && <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{trackingError}</p>}
                  {(dispatchMutation.isError || locationMutation.isError || statusMutation.isError || cancelMutation.isError) && (
                    <p role="alert" className="rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">The dispatch update could not be saved. Check your hospital permissions and request status.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function AmbulanceRequestCard({
  request,
  canDispatch,
  currentUserId,
  form,
  dispatchPending,
  locationPending,
  statusPending,
  cancelPending,
  onFormChange,
  onDispatch,
  onUseVehicleLocation,
  onUpdateVehicleLocation,
  onStatusChange,
  onCancel,
  onCreateDriverLink,
  driverLink,
  driverLinkPending,
}: {
  request: AmbulanceRequest
  canDispatch: boolean
  currentUserId: number | undefined
  form: DispatchForm
  dispatchPending: boolean
  locationPending: boolean
  statusPending: boolean
  cancelPending: boolean
  onFormChange: (patch: Partial<DispatchForm>) => void
  onDispatch: () => void
  onUseVehicleLocation: () => void
  onUpdateVehicleLocation: () => void
  onStatusChange: (status: AmbulanceRequestStatus) => void
  onCancel: () => void
  onCreateDriverLink: () => void
  driverLink?: string
  driverLinkPending: boolean
}) {
  const patientOwnsRequest = request.patient === currentUserId
  return (
    <article className="rounded-lg border border-black/[0.07] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{request.destination_hospital_name}</p>
          <p className="mt-1 text-sm text-muted">{request.pickup_address} · {request.destination_hospital_city}</p>
          {canDispatch && <p className="mt-1 text-xs text-muted">Patient: {request.patient_name}{request.patient_phone ? ` · ${request.patient_phone}` : ''}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          request.status === 'EN_ROUTE' ? 'bg-[#e4f1eb] text-[#28664e]' : 'bg-[#f1f4f2] text-[#58665e]'
        }`}>{statusLabel(request.status)}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
        <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />Requested {formatTime(request.requested_at)}</span>
        {request.ambulance_code && <span className="inline-flex items-center gap-1.5"><Ambulance size={14} aria-hidden="true" />{request.ambulance_code}{request.dispatcher_name ? ` · ${request.dispatcher_name}` : ''}</span>}
        {request.eta_minutes !== null && <span>Estimated arrival: {request.eta_minutes} minutes</span>}
        {request.arrived_at && <span>Arrived {formatTime(request.arrived_at)}</span>}
      </div>

      {canDispatch && request.status === 'REQUESTED' && (
        <div className="mt-4 rounded-md bg-[#f4f7f5] p-3">
          <p className="mb-3 text-sm font-semibold text-ink">Dispatch vehicle</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Ambulance identifier" placeholder="Ambulance ID" value={form.ambulance_code} onChange={(event) => onFormChange({ ambulance_code: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
            <input aria-label="Estimated minutes to arrival" type="number" min={0} max={1440} placeholder="ETA minutes" value={form.eta_minutes} onChange={(event) => onFormChange({ eta_minutes: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
            <input aria-label="Ambulance latitude" type="number" step="0.000001" placeholder="Vehicle latitude" value={form.latitude} onChange={(event) => onFormChange({ latitude: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
            <input aria-label="Ambulance longitude" type="number" step="0.000001" placeholder="Vehicle longitude" value={form.longitude} onChange={(event) => onFormChange({ longitude: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onUseVehicleLocation} className="inline-flex items-center gap-1.5 rounded border border-[#d8e0db] bg-white px-3 py-2 text-xs font-semibold">
              <LocateFixed size={14} aria-hidden="true" /> Use this device’s location
            </button>
            <button
              type="button"
              onClick={onDispatch}
              disabled={dispatchPending || !form.ambulance_code.trim() || !form.latitude || !form.longitude}
              className="inline-flex items-center gap-1.5 rounded bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Ambulance size={14} aria-hidden="true" /> Dispatch
            </button>
          </div>
        </div>
      )}

      {canDispatch && request.status === 'EN_ROUTE' && (
        <div className="mt-4 rounded-md bg-[#f4f7f5] p-3">
          <p className="mb-3 text-sm font-semibold text-ink">Update vehicle tracking</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input aria-label="Updated vehicle latitude" type="number" step="0.000001" placeholder="Latitude" value={form.latitude} onChange={(event) => onFormChange({ latitude: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
            <input aria-label="Updated vehicle longitude" type="number" step="0.000001" placeholder="Longitude" value={form.longitude} onChange={(event) => onFormChange({ longitude: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
            <input aria-label="Updated ETA minutes" type="number" min={0} max={1440} placeholder="ETA minutes" value={form.eta_minutes} onChange={(event) => onFormChange({ eta_minutes: event.target.value })} className="h-9 rounded border border-[#d8e0db] px-2 text-sm" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onCreateDriverLink} disabled={driverLinkPending} className="inline-flex items-center gap-1.5 rounded border border-[#d8e0db] bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60">
              <Link2 size={14} aria-hidden="true" /> {driverLinkPending ? 'Creating link…' : 'Create one-time driver link'}
            </button>
            <button type="button" onClick={onUseVehicleLocation} className="inline-flex items-center gap-1.5 rounded border border-[#d8e0db] bg-white px-3 py-2 text-xs font-semibold">
              <LocateFixed size={14} aria-hidden="true" /> Get current location
            </button>
            <button type="button" onClick={onUpdateVehicleLocation} disabled={locationPending || !form.latitude || !form.longitude} className="inline-flex items-center gap-1.5 rounded bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
              <MapPin size={14} aria-hidden="true" /> Update location
            </button>
            <button type="button" onClick={() => onStatusChange('ARRIVED')} disabled={statusPending} className="rounded border border-[#d8e0db] bg-white px-3 py-2 text-xs font-semibold">
              Mark arrived
            </button>
            <button type="button" onClick={() => onStatusChange('CANCELLED')} disabled={statusPending} className="rounded border border-[#eed5d0] bg-white px-3 py-2 text-xs font-semibold text-[#9d4937]">
              Cancel dispatch
            </button>
          </div>
          {driverLink && (
            <div className="mt-3 rounded border border-[#d8e0db] bg-white p-3">
              <p className="text-xs font-semibold text-ink">Share once with the assigned driver</p>
              <a className="mt-1 block break-all text-xs text-forest underline" href={driverLink} rel="noreferrer" target="_blank">{driverLink}</a>
              <p className="mt-1 text-[11px] leading-5 text-muted">The link expires in up to eight hours and can be exchanged only once. Creating a replacement link revokes the previous one.</p>
            </div>
          )}
        </div>
      )}

      {canDispatch && request.status === 'ARRIVED' && (
        <button type="button" onClick={() => onStatusChange('COMPLETED')} disabled={statusPending} className="mt-4 rounded bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          Mark transport complete
        </button>
      )}
      {patientOwnsRequest && request.status === 'REQUESTED' && (
        <button type="button" onClick={onCancel} disabled={cancelPending} className="mt-4 rounded border border-[#eed5d0] px-3 py-2 text-xs font-semibold text-[#9d4937] disabled:opacity-60">
          Cancel request
        </button>
      )}
    </article>
  )
}
