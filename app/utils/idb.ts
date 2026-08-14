import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/**
 * Local persistence:
 *  - `cache`: last known server responses (read fallback when offline)
 *  - `queue`: pending mutations to replay when connectivity returns
 */
export interface QueuedOp {
  id?: number
  createdAt: number
  kind: string
  method: 'POST' | 'PATCH' | 'DELETE'
  url: string
  body: Record<string, unknown> | null
  description: string
}

interface ArusDB extends DBSchema {
  cache: {
    key: string
    value: { key: string, data: unknown, updatedAt: number }
  }
  queue: {
    key: number
    value: QueuedOp
  }
}

let dbPromise: Promise<IDBPDatabase<ArusDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ArusDB>('arus', 1, {
      upgrade(db) {
        db.createObjectStore('cache', { keyPath: 'key' })
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      },
    })
  }
  return dbPromise
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    const db = await getDb()
    await db.put('cache', { key, data, updatedAt: Date.now() })
  }
  catch { /* private mode / quota — cache is best-effort */ }
}

export async function cacheGet<T>(key: string): Promise<{ data: T, updatedAt: number } | null> {
  try {
    const db = await getDb()
    const row = await db.get('cache', key)
    return row ? { data: row.data as T, updatedAt: row.updatedAt } : null
  }
  catch {
    return null
  }
}

export async function cacheClear(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('cache')
    await db.clear('queue')
  }
  catch { /* ignore */ }
}

export async function queueAdd(op: Omit<QueuedOp, 'id'>): Promise<number> {
  const db = await getDb()
  return db.add('queue', op as QueuedOp)
}

export async function queueAll(): Promise<QueuedOp[]> {
  try {
    const db = await getDb()
    return await db.getAll('queue')
  }
  catch {
    return []
  }
}

export async function queueRemove(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('queue', id)
}

export async function queueCount(): Promise<number> {
  try {
    const db = await getDb()
    return await db.count('queue')
  }
  catch {
    return 0
  }
}
