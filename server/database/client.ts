/**
 * Database client with two drivers:
 *  - postgres-js when DATABASE_URL is a postgres:// URL (production/Docker)
 *  - PGlite (embedded Postgres) otherwise — zero-setup local development
 *
 * Services always call `useDb()`, so tests can inject their own instance
 * via `setDb()`.
 */
import type { PgDatabase } from 'drizzle-orm/pg-core'
import * as schema from './schema'

// Both drivers satisfy this shape for our purposes.
export type Db = PgDatabase<any, typeof schema>

let _db: Db | null = null
let _initPromise: Promise<Db> | null = null

export function setDb(db: Db) {
  _db = db
}

async function createDb(): Promise<Db> {
  const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || ''

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { drizzle } = await import('drizzle-orm/postgres-js')
    const { default: postgres } = await import('postgres')
    const client = postgres(url, { max: 10, onnotice: () => {} })
    return drizzle(client, { schema }) as unknown as Db
  }

  if (typeof __ARUS_ALLOW_PGLITE__ === 'undefined' || __ARUS_ALLOW_PGLITE__) {
    const { createPgliteDb } = await import('./embedded')
    return createPgliteDb(url)
  }

  throw new Error('This build requires a postgres:// DATABASE_URL (PGlite is not included).')
}

export async function useDb(): Promise<Db> {
  if (_db) return _db
  if (!_initPromise) {
    _initPromise = createDb().then((db) => {
      _db = db
      return db
    })
  }
  return _initPromise
}

export { schema }
