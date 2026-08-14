<script setup lang="ts">
/**
 * Global Quick Add container: bottom sheet on mobile, dialog on desktop.
 * Mounted once in the default layout; opened from anywhere via useQuickAdd().
 */
const { state, close } = useQuickAdd()

const isMobile = ref(false)
let mq: MediaQueryList | null = null
function onMq(e: MediaQueryListEvent | MediaQueryList) {
  isMobile.value = e.matches
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 640px)')
  onMq(mq)
  mq.addEventListener('change', onMq)
})
onUnmounted(() => mq?.removeEventListener('change', onMq))

const open = computed({
  get: () => state.value.open,
  set: (v: boolean) => { if (!v) close() },
})

const title = computed(() => state.value.editing ? 'Edit transaction' : 'Add transaction')
</script>

<template>
  <ClientOnly>
    <UDrawer
      v-if="isMobile"
      v-model:open="open"
      :title="title"
      direction="bottom"
      :handle="true"
      :ui="{ content: 'max-h-[94dvh]' }"
    >
      <template #body>
        <TransactionFormBody
          v-if="open"
          :editing-tx="state.editing"
          :prefill="state.prefill"
          @close="close"
        />
      </template>
    </UDrawer>

    <UModal
      v-else
      v-model:open="open"
      :title="title"
      :description="state.editing ? undefined : 'Amount, category, payment method — done.'"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <TransactionFormBody
          v-if="open"
          :editing-tx="state.editing"
          :prefill="state.prefill"
          @close="close"
        />
      </template>
    </UModal>
  </ClientOnly>
</template>
