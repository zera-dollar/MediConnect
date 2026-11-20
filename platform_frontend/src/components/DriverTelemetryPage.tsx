import { useEffect, useRef, useState } from 'react'
import { Activity, MapPin, Radio, ShieldCheck, Square } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { exchangeDriverLink } from '../lib/api'

interface LiveCoordinates {
  latitude: number
  longitude: number
}

function websocketUrl(path: string): string {
  const base = new URL(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = path
  base.search = ''
  return base.toString()
}

export function DriverTelemetryPage() {
  const { linkToken = '' } = useParams()
  const [status, setStatus] = useState('The dispatch team has issued a one-time tracking link.')
  const [error, setError] = useState<string | null>(null)
  const [coordinates, setCoordinates] = useState<LiveCoordinates | null>(null)
  const [sharing, setSharing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const accessToken = useRef<string | null>(null)
  const coordinatesRef = useRef<LiveCoordinates | null>(null)
  const expiresAtRef = useRef<string | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const watchId = useRef<number | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const stopped = useRef(false)
  const authenticated = useRef(false)

  function sendLatestLocation() {
    const latest = coordinatesRef.current
    if (!latest || socket.current?.readyState !== WebSocket.OPEN || !authenticated.current) return
    socket.current.send(JSON.stringify({ type: 'location', ...latest }))
  }

  function connect() {
    const token = accessToken.current
    if (!token || stopped.current) return
    const currentSocket = new WebSocket(websocketUrl('/ws/driver-telemetry/driver/'))
    socket.current = currentSocket
    currentSocket.onopen = () => {
      currentSocket.send(JSON.stringify({ type: 'authenticate', token }))
    }
    currentSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: string; detail?: string }
        if (message.type === 'authenticated') {
          authenticated.current = true
          setStatus('Live location sharing is active.')
          if (navigator.geolocation && watchId.current === null) {
            watchId.current = navigator.geolocation.watchPosition(
              ({ coords: point }) => {
                const latest = { latitude: point.latitude, longitude: point.longitude }
                coordinatesRef.current = latest
                setCoordinates(latest)
                setError(null)
                if (currentSocket.readyState === WebSocket.OPEN) {
                  currentSocket.send(JSON.stringify({
                    type: 'location',
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }))
                }
              },
              (locationError) => {
                setError(locationError.message || 'Location access is unavailable.')
                setStatus('Location sharing paused.')
              },
              { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
            )
          } else {
            const expires = expiresAtRef.current
            if (expires && new Date(expires).getTime() <= Date.now()) {
              setError('This tracking session has expired. Ask the dispatcher for a new link.')
              stopSharing()
              return
            }
            sendLatestLocation()
          }
        } else if (message.type === 'error') {
          setError(message.detail ?? 'The location update was rejected.')
        }
      } catch {
        setError('Received an unreadable tracking response.')
      }
    }
    currentSocket.onerror = () => setStatus('Connection interrupted; attempting to reconnect.')
    currentSocket.onclose = () => {
      authenticated.current = false
      if (!stopped.current && expiresAtRef.current && new Date(expiresAtRef.current).getTime() > Date.now()) {
        setStatus('Connection interrupted; reconnecting when possible.')
        reconnectTimer.current = window.setTimeout(connect, 3000)
      }
    }
  }

  async function startSharing() {
    if (!linkToken || !navigator.geolocation) {
      setError('This browser does not support secure location sharing.')
      return
    }
    setError(null)
    setStarting(true)
    setStatus('Validating the one-time tracking link...')
    try {
      const session = await exchangeDriverLink(linkToken)
      accessToken.current = session.access_token
      expiresAtRef.current = session.expires_at
      setExpiresAt(session.expires_at)
      stopped.current = false
      setSharing(true)
      connect()
    } catch (requestError) {
      setStatus('Could not start location sharing.')
      setError(requestError instanceof Error ? requestError.message : 'The tracking link may have expired or already been used.')
    } finally {
      setStarting(false)
    }
  }

  function stopSharing() {
    stopped.current = true
    setSharing(false)
    authenticated.current = false
    setStatus('Location sharing stopped.')
    if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: 'stop' }))
    }
    socket.current?.close()
    socket.current = null
    accessToken.current = null
  }

  useEffect(() => () => {
    stopped.current = true
    if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    socket.current?.close()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f8f6] px-5 py-10 text-ink">
      <section className="w-full max-w-lg rounded-2xl border border-[#dce8e0] bg-white p-6 shadow-panel sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4ed] text-forest">
          <Activity size={23} aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-forest">MediConnect driver link</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Share transport location</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          With your permission, this page sends the vehicle's current coordinates to the receiving hospital and patient while the dispatch is active. It does not record a route history.
        </p>
        <div role="status" aria-live="polite" className="mt-5 rounded-lg bg-[#f4f8f6] p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-ink">
            {sharing ? <Radio size={16} className="text-forest" aria-hidden="true" /> : <MapPin size={16} className="text-forest" aria-hidden="true" />}
            {status}
          </div>
          {coordinates && <p className="mt-2 text-xs text-muted">Last sent: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p>}
          {expiresAt && <p className="mt-2 text-xs text-muted">Session expires: {new Date(expiresAt).toLocaleString()}</p>}
        </div>
        {error && <p role="alert" className="mt-4 rounded-md bg-[#fff1ed] px-3 py-2.5 text-sm text-[#9d4937]">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          {!sharing ? (
            <button type="button" disabled={starting} onClick={() => void startSharing()} className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              <ShieldCheck size={16} aria-hidden="true" /> {starting ? 'Validating link…' : 'Allow and start sharing'}
            </button>
          ) : (
            <button type="button" onClick={stopSharing} className="inline-flex items-center gap-2 rounded-lg border border-[#d8e0db] px-4 py-3 text-sm font-semibold text-ink">
              <Square size={15} aria-hidden="true" /> Stop sharing
            </button>
          )}
        </div>
        <p className="mt-5 text-xs leading-5 text-muted">
          Keep this page open while the vehicle is en route. If the connection drops, it will retry; location updates expire from the live service after five minutes without a new signal.
        </p>
      </section>
    </main>
  )
}
