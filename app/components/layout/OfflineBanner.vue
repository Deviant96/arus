<script setup lang="ts">
import { useSyncStore } from '../../stores/sync'

const sync = useSyncStore()
</script>

<template>
  <div>
    <div
      v-if="!sync.isOnline"
      class="flex items-center justify-center gap-2 bg-warning/10 text-warning text-xs font-medium px-4 py-2 border-b border-warning/20"
    >
      <UIcon name="i-lucide-wifi-off" class="size-3.5" />
      You're offline — changes are saved on this device and will sync automatically.
      <span v-if="sync.pendingCount > 0" class="opacity-80">({{ sync.pendingCount }} pending)</span>
    </div>
    <div
      v-else-if="sync.syncing || sync.pendingCount > 0"
      class="flex items-center justify-center gap-2 bg-info/10 text-info text-xs font-medium px-4 py-2 border-b border-info/20"
    >
      <UIcon name="i-lucide-refresh-cw" class="size-3.5 animate-spin" />
      Syncing {{ sync.pendingCount }} offline change{{ sync.pendingCount === 1 ? '' : 's' }}…
    </div>
    <div
      v-for="(fail, i) in sync.failedOps"
      :key="fail.op.id ?? i"
      class="flex items-center justify-between gap-2 bg-error/10 text-error text-xs px-4 py-2 border-b border-error/20"
    >
      <span class="min-w-0 truncate">
        <span class="font-semibold">Couldn't sync:</span> {{ fail.op.description }} — {{ fail.message }}
      </span>
      <UButton color="error" variant="ghost" size="xs" icon="i-lucide-x" @click="sync.dismissFailed(i)" />
    </div>
  </div>
</template>
