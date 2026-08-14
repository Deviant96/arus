import type { H3Event } from 'h3'
import { createError, getRequestIP } from 'h3'

/**
 * Simple in-memory sliding-window rate limiter for sensitive endpoints
 * (auth, AI). Suitable for a single-instance VPS deployment; swap for a
 * Redis-backed limiter if the app is ever scaled horizontally.
 */
const buckets = new Map<string, number[]>()

let lastSweep = Date.now()

function sweep(windowMs: number) {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, hits] of buckets) {
    const alive = hits.filter(t => now - t < windowMs)
    if (alive.length === 0) buckets.delete(key)
    else buckets.set(key, alive)
  }
}

export function rateLimit(event: H3Event, options: { key: string, max: number, windowMs: number }) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = `${options.key}:${ip}`
  const now = Date.now()
  sweep(options.windowMs)

  const hits = (buckets.get(key) ?? []).filter(t => now - t < options.windowMs)
  if (hits.length >= options.max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please wait a moment and try again.',
    })
  }
  hits.push(now)
  buckets.set(key, hits)
}
