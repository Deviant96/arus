import { defineStore } from 'pinia'
import { queueAll, queueCount, queueRemove, type QueuedOp } from '../utils/idb'

/**
 * Connectivity + offline mutation queue. Ops are replayed strictly in order;
 * every queued payload carries a client-generated UUID so replays are
 * idempotent on the server.
 */
export const useSyncStore = defineStore('sync', () => {
  const isOnline = ref(true)
  const pendingCount = ref(0)
  const syncing = ref(false)
  const failedOps = ref<{ op: QueuedOp, message: string }[]>([])
  /** Incremented after each successful sync so pages can refresh. */
  const syncedAt = ref(0)

  async function refreshCount() {
    pendingCount.value = await queueCount()
  }

  async function processQueue() {
    if (syncing.value || !isOnline.value) return
    syncing.value = true
    try {
      const ops = await queueAll()
      for (const op of ops.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
        try {
          await $fetch(op.url, {
            method: op.method,
            body: op.body ?? undefined,
          })
          await queueRemove(op.id!)
        }
        catch (err: any) {
          const status: number | undefined = err?.statusCode ?? err?.status
          if (status && status >= 400 && status < 500) {
            // The server rejected it (validation/conflict). Requeueing would
            // never succeed — surface it for user review instead.
            failedOps.value.push({ op, message: err?.statusMessage ?? err?.data?.statusMessage ?? 'Rejected by server' })
            await queueRemove(op.id!)
            continue
          }
          // Network / 5xx: stop and retry later, order preserved.
          break
        }
      }
    }
    finally {
      await refreshCount()
      syncing.value = false
      if (pendingCount.value === 0) syncedAt.value = Date.now()
    }
  }

  function init() {
    if (!import.meta.client) return
    isOnline.value = navigator.onLine
    window.addEventListener('online', () => {
      isOnline.value = true
      processQueue()
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
    refreshCount()
    if (isOnline.value) processQueue()
  }

  function dismissFailed(index: number) {
    failedOps.value.splice(index, 1)
  }

  return { isOnline, pendingCount, syncing, failedOps, syncedAt, init, processQueue, refreshCount, dismissFailed }
})
