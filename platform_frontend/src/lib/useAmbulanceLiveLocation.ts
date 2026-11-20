import { useEffect, useState } from 'react'

export interface LiveAmbulanceLocation {
  latitude: number
  longitude: number
  received_at: string
}

export type LiveLocationStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

function websocketUrl(requestId: number): string {
  const base = new URL(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = `/ws/driver-telemetry/ambulance/${requestId}/`
  base.search = ''
  return base.toString()
}

export function useAmbulanceLiveLocation(
  requestId: number | null,
  accessToken: string | null,
): { location: LiveAmbulanceLocation | null; status: LiveLocationStatus } {
  const [location, setLocation] = useState<LiveAmbulanceLocation | null>(null)
  const [status, setStatus] = useState<LiveLocationStatus>('offline')

  useEffect(() => {
    if (requestId === null || !accessToken) {
      setLocation(null)
      setStatus('offline')
      return
    }

    const activeRequestId = requestId
    let active = true
    let socket: WebSocket | null = null
    let retryTimer: number | null = null
    setLocation(null)
    setStatus('connecting')

    function connect() {
      if (!active) return
      socket = new WebSocket(websocketUrl(activeRequestId))
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: 'authenticate', token: accessToken }))
      }
      socket.onmessage = (event) => {
        let message: unknown
        try {
          message = JSON.parse(String(event.data))
        } catch (error) {
          console.error('Could not parse live ambulance location.', error)
          return
        }
        if (typeof message !== 'object' || message === null || !('type' in message)) return
        if (message.type === 'authenticated') {
          setStatus('live')
        } else if (
          message.type === 'location'
          && 'latitude' in message && typeof message.latitude === 'number'
          && 'longitude' in message && typeof message.longitude === 'number'
          && 'received_at' in message && typeof message.received_at === 'string'
        ) {
          setLocation({
            latitude: message.latitude,
            longitude: message.longitude,
            received_at: message.received_at,
          })
          setStatus('live')
        }
      }
      socket.onerror = () => setStatus('reconnecting')
      socket.onclose = () => {
        if (!active) return
        setStatus('reconnecting')
        retryTimer = window.setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      active = false
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      socket?.close()
    }
  }, [accessToken, requestId])

  return { location, status }
}
