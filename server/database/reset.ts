/**
 * Drops all tables and re-applies migrations (development only).
 * Run: npm run db:reset
 */
import { runMigrations } from './migrate'

async function reset() {
  const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || ''

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { default: postgres } = await import('postgres')
    const client = postgres(url, { max: 1, onnotice: () => {} })
    await client.unsafe('drop schema public cascade; create schema public;')
    await client.unsafe('drop schema if exists drizzle cascade;')
    await client.end()
  }
  else {
    const { rmSync, existsSync } = await import('node:fs')
    const dataDir = url.replace(/^pglite:\/\//, '') || './.data/pglite'
    if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true })
  }

  await runMigrations()
  console.log('✔ database reset and migrated')
}

reset().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
