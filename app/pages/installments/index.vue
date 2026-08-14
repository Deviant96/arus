<script setup lang="ts">
import type { InstallmentDto } from '#shared/types/api'

const api = useApi()

const tab = ref<'active' | 'completed' | 'calendar'>('active')
const createOpen = ref(false)

const { data, refresh, status } = await useAsyncData('installments', async () => {
  const res = await api.cachedGet<{ items: InstallmentDto[] }>('installments', '/api/installments')
  return res.data.items
}, { server: false, lazy: true, default: () => [] })

const active = computed(() => (data.value ?? []).filter(i => i.status === 'active'))
const completed = computed(() => (data.value ?? []).filter(i => i.status === 'completed'))

const tabs = computed(() => [
  { value: 'active', label: `Active${active.value.length ? ` (${active.value.length})` : ''}` },
  { value: 'completed', label: `Completed${completed.value.length ? ` (${completed.value.length})` : ''}` },
  { value: 'calendar', label: 'Calendar' },
])

async function onCreated(id: string) {
  await refresh()
  navigateTo(`/installments/${id}`)
}
</script>

<template>
  <div>
    <UiPageHeader title="Installments" subtitle="Expected schedules, actual payments">
      <UButton icon="i-lucide-plus" @click="createOpen = true">New installment</UButton>
    </UiPageHeader>

    <div class="px-4 sm:px-6 lg:px-8 space-y-4">
      <div class="flex rounded-xl bg-elevated/60 p-1 w-fit">
        <button
          v-for="t in tabs"
          :key="t.value"
          type="button"
          class="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
          :class="tab === t.value ? 'bg-accented text-highlighted' : 'text-muted hover:text-highlighted'"
          @click="tab = t.value as never"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="status === 'pending' && !data?.length" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <USkeleton v-for="i in 3" :key="i" class="h-40 rounded-2xl" />
      </div>

      <template v-else-if="tab === 'active'">
        <UiEmptyState
          v-if="active.length === 0"
          icon="i-lucide-calendar-clock"
          title="No installments yet"
          description="Turn a purchase into an installment when you need to track payments over time — down payment, schedule and actual payment history included."
        >
          <UButton icon="i-lucide-plus" @click="createOpen = true">New installment</UButton>
        </UiEmptyState>
        <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <InstallmentCard v-for="inst in active" :key="inst.id" :installment="inst" />
        </div>
      </template>

      <template v-else-if="tab === 'completed'">
        <UiEmptyState
          v-if="completed.length === 0"
          icon="i-lucide-check-circle-2"
          title="Nothing completed yet"
          description="Installments move here once every scheduled payment is settled."
        />
        <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <InstallmentCard v-for="inst in completed" :key="inst.id" :installment="inst" />
        </div>
      </template>

      <InstallmentCalendar v-else />
    </div>

    <InstallmentFormModal v-model:open="createOpen" @created="onCreated" />
  </div>
</template>
