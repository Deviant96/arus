/**
 * Cross-origin protection for state-changing API requests. Sessions live in
 * SameSite=Lax cookies which already blocks most CSRF; this adds an explicit
 * Origin check as defense in depth.
 */
export default defineEventHandler((event) => {
  const method = event.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (!event.path.startsWith('/api/')) return

  const origin = getRequestHeader(event, 'origin')
  if (!origin) return // non-browser clients (curl, tests)

  const host = getRequestHeader(event, 'host')
  try {
    const originHost = new URL(origin).host
    if (host && originHost !== host) {
      throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
    }
  }
  catch (err: any) {
    if (err?.statusCode) throw err
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
  }
})
