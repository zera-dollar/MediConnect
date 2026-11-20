import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CloudOff, RefreshCw, Wifi } from 'lucide-react'
import { postOfflineResourceUpdate } from '../lib/api'
import {
  listQueuedResourceUpdates,
  queueResourceUpdate,
  removeQueuedResourceUpdate,
  updateQueuedResourceConflict,
  type QueuedResourceUpdate,
} from '../lib/offlineStore'
import type { HospitalResource } from '../types'

interface OfflineResourceSyncPanelProps {
  resources: HospitalResource[]
  userId: number
}

function canSyncOnCurrentNetwork(): boolean {
  if (!navigator.onLine) return false
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
}

export function OfflineResourceSyncPanel({ resources, userId }: OfflineResourceSyncPanelProps) {
  const [updates, setUpdates] = useState<QueuedResourceUpdate[]>([])
  const [resourceId, setResourceId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [message, setMessage] = useState('')
  const [storageError, setStorageError] = useState<string | null>(null)
  const syncing = useRef(false)
  const availableResources = resources.filter((resource) => resource.is_active)

  const loadQueue = useCallback(async () => {
    try {
      setUpdates(await listQueuedResourceUpdates(userId))
      setStorageError(null)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Offline storage could not be opened.')
    }
  }, [userId])

  const syncQueue = useCallback(async () => {
    if (!canSyncOnCurrentNetwork() || syncing.current) return
    syncing.current = true
    try {
      const pending = (await listQueuedResourceUpdates(userId))
        .filter((update) => update.status === 'QUEUED')
      for (const update of pending) {
        try {
          const result = await postOfflineResourceUpdate({
            idempotency_key: update.idempotency_key,
            hospital_resource: update.hospital_resource,
            expected_last_updated: update.expected_last_updated,
            available_quantity: update.available_quantity,
          })
          if (result.status === 'APPLIED') {
            await removeQueuedResourceUpdate(update.idempotency_key)
            setMessage('Queued resource updates synced.')
          } else if (result.status === 'CONFLICT') {
            await updateQueuedResourceConflict(update.idempotency_key, result.detail)
          }
        } catch (error) {
          const response = typeof error === 'object' && error !== null && 'response' in error
            ? error.response
            : null
          const status = typeof response === 'object' && response !== null && 'status' in response
            ? response.status
            : null
          const data = typeof response === 'object' && response !== null && 'data' in response
            ? response.data
            : null
          const detail = typeof data === 'object' && data !== null && 'detail' in data &&
            typeof data.detail === 'string'
            ? data.detail
            : null
          if (status === 409) {
            await updateQueuedResourceConflict(update.idempotency_key, detail ?? 'Resource changed; review before resubmitting.')
            continue
          }
          setMessage('Sync paused. Queued updates are kept on this device for a later retry.')
          break
        }
      }
    } finally {
      syncing.current = false
      await loadQueue()
    }
  }, [loadQueue, userId])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useEffect(() => {
    function updateConnection() {
      setOnline(navigator.onLine)
      if (navigator.onLine) void syncQueue()
    }
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    const timer = window.setInterval(() => {
      if (canSyncOnCurrentNetwork()) void syncQueue()
    }, 60_000)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      window.clearInterval(timer)
    }
  }, [syncQueue])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const resource = availableResources.find((item) => item.id === Number(resourceId))
    const nextQuantity = Number(quantity)
    if (!resource || !Number.isInteger(nextQuantity) || nextQuantity < 0) return
    const update: QueuedResourceUpdate = {
      idempotency_key: crypto.randomUUID(),
      user_id: userId,
      hospital_resource: resource.id,
      hospital_name: resource.hospital_name,
      resource_name: resource.resource_type.name,
      expected_last_updated: resource.last_updated,
      available_quantity: nextQuantity,
      status: 'QUEUED',
      detail: '',
      created_at: new Date().toISOString(),
    }
    try {
      await queueResourceUpdate(update)
      setQuantity('')
      setMessage('Update safely queued without patient information.')
      await loadQueue()
      if (canSyncOnCurrentNetwork()) void syncQueue()
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save this update on the device.')
    }
  }

  return (
    <section aria-label="Offline resource updates" className="mt-5 rounded-xl border border-[#dce8e0] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Offline resource updates</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            Queue non-clinical availability counts on this device. Updates sync when the network is available; conflicting changes require review. Do not enter patient or triage information here.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${online ? 'bg-[#eaf3ee] text-[#28664e]' : 'bg-[#fbf1df] text-[#8b641d]'}`}>
          {online ? <Wifi size={13} aria-hidden="true" /> : <CloudOff size={13} aria-hidden="true" />}
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor="offline-resource">Hospital resource</label>
        <select
          id="offline-resource"
          className="h-10 min-w-0 rounded-md border border-[#d8e0db] bg-white px-3 text-sm"
          onChange={(event) => setResourceId(event.target.value)}
          required
          value={resourceId}
        >
          <option value="">Select a resource</option>
          {availableResources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.hospital_name} · {resource.resource_type.name} ({resource.available_quantity} {resource.unit || 'units'})
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="offline-quantity">New available quantity</label>
        <input
          id="offline-quantity"
          aria-label="New available quantity"
          className="h-10 rounded-md border border-[#d8e0db] px-3 text-sm"
          min={0}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Available quantity"
          required
          type="number"
          value={quantity}
        />
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest px-4 text-xs font-semibold text-white disabled:opacity-50" disabled={!resourceId || !quantity} type="submit">
          <RefreshCw size={14} aria-hidden="true" /> Queue update
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-xs text-muted">{storageError || message || `${updates.length} update${updates.length === 1 ? '' : 's'} waiting on this device.`}</p>
        <button className="text-xs font-semibold text-forest underline-offset-2 hover:underline disabled:opacity-50" disabled={!online || !updates.some((update) => update.status === 'QUEUED')} onClick={() => void syncQueue()} type="button">
          Sync now
        </button>
      </div>

      {updates.length > 0 && (
        <ul className="mt-3 divide-y divide-[#edf1ee] border-t border-[#edf1ee] text-xs">
          {updates.map((update) => (
            <li className="flex flex-wrap justify-between gap-2 py-2" key={update.idempotency_key}>
              <span>{update.hospital_name} · {update.resource_name}: {update.available_quantity} available</span>
              <span className={update.status === 'CONFLICT' ? 'font-medium text-[#9d4937]' : 'text-muted'}>
                {update.status === 'CONFLICT' ? update.detail : 'Queued'}
              </span>
              {update.status === 'CONFLICT' && (
                <button
                  type="button"
                  className="font-semibold text-forest underline-offset-2 hover:underline"
                  onClick={() => {
                    void removeQueuedResourceUpdate(update.idempotency_key)
                      .then(loadQueue)
                      .catch((error: unknown) => setStorageError(error instanceof Error ? error.message : 'Could not remove the conflicted update.'))
                  }}
                >
                  Discard and review current data
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
