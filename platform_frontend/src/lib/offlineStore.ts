export interface QueuedResourceUpdate {
  idempotency_key: string
  user_id: number
  hospital_resource: number
  hospital_name: string
  resource_name: string
  expected_last_updated: string
  available_quantity: number
  status: 'QUEUED' | 'CONFLICT'
  detail: string
  created_at: string
}

interface CachedValue<T> {
  key: string
  data: T
  saved_at: string
}

const DB_NAME = 'mediconnect-offline'
const DB_VERSION = 1
const CACHE_STORE = 'facility-cache'
const UPDATE_STORE = 'resource-updates'

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('Offline storage is not available in this browser.'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains(UPDATE_STORE)) {
        const updates = database.createObjectStore(UPDATE_STORE, { keyPath: 'idempotency_key' })
        updates.createIndex('user_id', 'user_id')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'))
  })
}

async function storeRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))
    let result: T | undefined
    let requestSucceeded = false
    request.onsuccess = () => {
      result = request.result
      requestSucceeded = true
    }
    request.onerror = () => reject(request.error ?? new Error('Offline storage operation failed.'))
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Offline storage transaction aborted.'))
    }
    transaction.oncomplete = () => {
      database.close()
      if (requestSucceeded) resolve(result as T)
      else reject(new Error('Offline storage completed without a result.'))
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Offline storage transaction failed.'))
    }
  })
}

export async function cacheFacilityData<T>(key: string, data: T): Promise<void> {
  const record: CachedValue<T> = { key, data, saved_at: new Date().toISOString() }
  await storeRequest(CACHE_STORE, 'readwrite', (store) => store.put(record))
}

export async function readCachedFacilityData<T>(key: string): Promise<T | null> {
  const record = await storeRequest<CachedValue<T> | undefined>(
    CACHE_STORE,
    'readonly',
    (store) => store.get(key),
  )
  return record?.data ?? null
}

export async function queueResourceUpdate(update: QueuedResourceUpdate): Promise<void> {
  await storeRequest(UPDATE_STORE, 'readwrite', (store) => store.put(update))
}

export async function listQueuedResourceUpdates(userId: number): Promise<QueuedResourceUpdate[]> {
  const updates = await storeRequest<QueuedResourceUpdate[]>(
    UPDATE_STORE,
    'readonly',
    (store) => store.getAll(),
  )
  return updates.filter((update) => update.user_id === userId)
}

export async function removeQueuedResourceUpdate(idempotencyKey: string): Promise<void> {
  await storeRequest(UPDATE_STORE, 'readwrite', (store) => store.delete(idempotencyKey))
}

export async function updateQueuedResourceConflict(
  idempotencyKey: string,
  detail: string,
): Promise<void> {
  const update = await storeRequest<QueuedResourceUpdate | undefined>(
    UPDATE_STORE,
    'readonly',
    (store) => store.get(idempotencyKey),
  )
  if (!update) return
  update.status = 'CONFLICT'
  update.detail = detail
  await queueResourceUpdate(update)
}
