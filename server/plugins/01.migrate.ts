/**
 * Applies pending database migrations when the server boots, so both local
 * dev (PGlite) and Docker deployments are always on the current schema.
 */
export default defineNitroPlugin(async () => {
  if (process.env.SKIP_MIGRATIONS === '1') return
  const { runMigrations } = await import('../database/migrate')
  try {
    await runMigrations()
    console.log('[db] migrations up to date')
  }
  catch (err) {
    console.error('[db] migration failed at startup', err)
    throw err
  }
})
