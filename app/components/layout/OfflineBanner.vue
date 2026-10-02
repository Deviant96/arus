<script setup lang="ts">
import { useSyncStore } from '../../stores/sync'

const sync = useSyncStore()
</script>

<template>
  <div>
    <div
      v-if="!sync.isOnline"
      class="flex items-center justify-center gap-2 text-xs font-medium px-4 py-2 border-b"
      style="background: color-mix(in srgb, var(--snug-butter) 70%, white); color: var(--snug-warning-ink); border-color: color-mix(in srgb, var(--snug-butter) 80%, var(--snug-border));"
    >
      <UIcon name="i-lucide-wifi-off" class="size-3.5" />
      You're offline — changes are saved on this device and will sync automatically.
      <span v-if="sync.pendingCount > 0" class="opacity-80">({{ sync.pendingCount }} pending)</span>
    </div>
    <div
      v-else-if="sync.syncing || sync.pendingCount > 0"
      class="flex items-center justify-center gap-2 text-xs font-medium px-4 py-2 border-b"
      style="background: color-mix(in srgb, var(--snug-dusty-blue) 35%, white); color: var(--snug-info-ink); border-color: color-mix(in srgb, var(--snug-dusty-blue) 50%, var(--snug-border));"
    >
      <UIcon name="i-lucide-refresh-cw" class="size-3.5 animate-spin" />
      Syncing {{ sync.pendingCount }} offline change{{ sync.pendingCount === 1 ? '' : 's' }}…
    </div>
    <div
      v-for="(fail, i) in sync.failedOps"
      :key="fail.op.id ?? i"
      class="flex items-center justify-between gap-2 text-xs px-4 py-2 border-b"
      style="background: color-mix(in srgb, var(--snug-rose) 45%, white); color: var(--snug-error-ink); border-color: color-mix(in srgb, var(--snug-rose) 60%, var(--snug-border));"
    >
      <span class="min-w-0 truncate">
        <span class="font-semibold">Couldn't sync:</span> {{ fail.op.description }} — {{ fail.message }}
      </span>
      <UButton color="error" variant="ghost" size="xs" icon="i-lucide-x" @click="sync.dismissFailed(i)" />
    </div>
  </div>
</template>
