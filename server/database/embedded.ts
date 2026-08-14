/**
 * PGlite driver — local development and tests only.
 * Docker production builds tree-shake this module (see nuxt.config nitro.replace).
 */
import type { Db } from './client'
import * as schema from './schema'

export async function createPgliteDb(url: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { mkdirSync } = await import('node:fs')
  const dataDir = url.replace(/^pglite:\/\//, '') || './.data/pglite'
  mkdirSync(dataDir, { recursive: true })
  const pglite = new PGlite(dataDir)
  return drizzle(pglite, { schema }) as unknown as Db
}

export async function migratePglite(folder: string, url: string): Promise<void> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const { mkdirSync } = await import('node:fs')
  const dataDir = url.replace(/^pglite:\/\//, '') || './.data/pglite'
  mkdirSync(dataDir, { recursive: true })
  const pglite = new PGlite(dataDir)
  try {
    await migrate(drizzle(pglite), { migrationsFolder: folder })
  }
  finally {
    await pglite.close()
  }
}
