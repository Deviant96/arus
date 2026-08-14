import { cacheGet, cacheSet, queueAdd } from '../utils/idb'
import { useSyncStore } from '../stores/sync'

export interface CachedResult<T> {
  data: T
  /** True when served from IndexedDB because the network was unavailable. */
  fromCache: boolean
  cachedAt: number | null
}

/**
 * Network-first reads with IndexedDB fallback, and mutation queueing for
 * offline writes. All app data access goes through this.
 */
export function useApi() {
  const sync = useSyncStore()

  async function cachedGet<T>(key: string, url: string, params?: Record<string, unknown>): Promise<CachedResult<T>> {
    try {
      const data = await $fetch<T>(url, { params })
      cacheSet(key, data)
      return { data, fromCache: false, cachedAt: null }
    }
    catch (err: any) {
      const status: number | undefined = err?.statusCode ?? err?.status
      // Only fall back to cache for connectivity problems, never for 4xx.
      if (status && status < 500) throw err
      const hit = await cacheGet<T>(key)
      if (hit) return { data: hit.data, fromCache: true, cachedAt: hit.updatedAt }
      throw err
    }
  }

  interface MutateOptions {
    kind: string
    description: string
    /** Called to optimistically update local cache when queued offline. */
    onQueued?: () => Promise<void> | void
  }

  async function mutate<T>(method: 'POST' | 'PATCH' | 'DELETE', url: string, body: Record<string, unknown> | null, options: MutateOptions): Promise<{ result: T | null, queued: boolean }> {
    if (sync.isOnline) {
      try {
        const result = await $fetch<T>(url, { method, body: body ?? undefined })
        return { result, queued: false }
      }
      catch (err: any) {
        const status: number | undefined = err?.statusCode ?? err?.status
        // Real server responses (validation, conflicts) propagate to the form.
        if (status && status < 500) throw err
        // Network dropped mid-request → queue it.
      }
    }

    await queueAdd({
      createdAt: Date.now(),
      kind: options.kind,
      method,
      url,
      body,
      description: options.description,
    })
    await sync.refreshCount()
    await options.onQueued?.()
    return { result: null, queued: true }
  }

  return { cachedGet, mutate }
}
