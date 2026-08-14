<script setup lang="ts">
import { useSyncStore } from '../stores/sync'

const { load: loadUser } = useSessionUser()
const { load: loadLookups } = useLookups()
const { openQuickAdd, state } = useQuickAdd()
const sync = useSyncStore()

await useAsyncData('bootstrap-user', async () => {
  await loadUser()
  return true
})

onMounted(() => {
  sync.init()
  loadLookups().catch(() => {})
})

// Ctrl/Cmd+N per spec (browsers may reserve it, so plain "n" also works
// whenever focus is not inside an input).
defineShortcuts({
  ctrl_n: {
    usingInput: true,
    handler: () => openQuickAdd(),
  },
  meta_n: {
    usingInput: true,
    handler: () => openQuickAdd(),
  },
  n: () => {
    if (!state.value.open) openQuickAdd()
  },
})
</script>

<template>
  <div class="min-h-screen flex bg-default text-default">
    <LayoutAppSidebar />

    <div class="flex-1 flex flex-col min-w-0">
      <LayoutOfflineBanner />
      <main class="flex-1 pb-24 lg:pb-10">
        <slot />
      </main>
    </div>

    <LayoutMobileNav />
    <TransactionQuickAdd />
  </div>
</template>
