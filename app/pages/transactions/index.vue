<script setup lang="ts">
import type { TransactionDto, TransactionListResponse } from '#shared/types/api'
import { useSyncStore } from '../../stores/sync'

const api = useApi()
const { version } = useQuickAdd()
const { openQuickAdd } = useQuickAdd()
const { categories, paymentMethods, load: loadLookups } = useLookups()
const { money } = useFormat()
const sync = useSyncStore()

await useAsyncData('tx-lookups', async () => { await loadLookups().catch(() => {}); return true }, { server: false, lazy: true })

const filters = reactive({
  q: '',
  type: undefined as 'income' | 'expense' | 'transfer' | undefined,
  categoryId: undefined as string | undefined,
  paymentMethodId: undefined as string | undefined,
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined,
  minAmount: '' as string,
  maxAmount: '' as string,
  source: 'all' as 'all' | 'manual' | 'installment' | 'recurring',
  sort: 'newest' as 'newest' | 'oldest' | 'amount_desc' | 'amount_asc',
})
const filtersOpen = ref(false)

const items = ref<TransactionDto[]>([])
const total = ref(0)
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const fromCache = ref(false)

const hasFilters = computed(() =>
  !!(filters.q || filters.type || filters.categoryId || filters.paymentMethodId
    || filters.startDate || filters.endDate || filters.minAmount || filters.maxAmount
    || filters.source !== 'all' || filters.sort !== 'newest'),
)

function buildParams(cursor?: string | null) {
  const p: Record<string, unknown> = { limit: 40, sort: filters.sort, source: filters.source }
  if (filters.q.trim()) p.q = filters.q.trim()
  if (filters.type) p.type = filters.type
  if (filters.categoryId) p.categoryId = filters.categoryId
  if (filters.paymentMethodId) p.paymentMethodId = filters.paymentMethodId
  if (filters.startDate) p.startDate = filters.startDate
  if (filters.endDate) p.endDate = filters.endDate
  const min = filters.minAmount.replace(/\D/g, '')
  const max = filters.maxAmount.replace(/\D/g, '')
  if (min) p.minAmountMinor = Number(min)
  if (max) p.maxAmountMinor = Number(max)
  if (cursor) p.cursor = cursor
  return p
}

async function fetchPage(reset = true) {
  if (reset) loading.value = true
  try {
    if (!hasFilters.value) {
      const res = await api.cachedGet<TransactionListResponse>('tx:recent', '/api/transactions', buildParams())
      items.value = res.data.items
      total.value = res.data.total
      nextCursor.value = res.data.nextCursor
      fromCache.value = res.fromCache
    }
    else {
      const res = await $fetch<TransactionListResponse>('/api/transactions', { params: buildParams() })
      items.value = res.items
      total.value = res.total
      nextCursor.value = res.nextCursor
      fromCache.value = false
    }
  }
  catch {
    // network failure with filters and no cache — show what we have
  }
  finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const res = await $fetch<TransactionListResponse>('/api/transactions', { params: buildParams(nextCursor.value) })
    items.value = [...items.value, ...res.items]
    nextCursor.value = res.nextCursor
  }
  catch { /* keep current page */ }
  finally {
    loadingMore.value = false
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined
watch(filters, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => fetchPage(), 300)
})
watch(version, () => fetchPage(false))
watch(() => sync.syncedAt, () => fetchPage(false))
onMounted(() => fetchPage())

function clearFilters() {
  Object.assign(filters, {
    q: '', type: undefined, categoryId: undefined, paymentMethodId: undefined,
    startDate: undefined, endDate: undefined, minAmount: '', maxAmount: '',
    source: 'all', sort: 'newest',
  })
}

const typeItems = [
  { label: 'All types', value: undefined },
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
]
const sortItems = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Highest amount', value: 'amount_desc' },
  { label: 'Lowest amount', value: 'amount_asc' },
]
const sourceItems = [
  { label: 'All sources', value: 'all' },
  { label: 'Manual only', value: 'manual' },
  { label: 'Installment payments', value: 'installment' },
  { label: 'Recurring', value: 'recurring' },
]
const categoryItems = computed(() => [
  { label: 'All categories', value: undefined },
  ...categories.value.map(c => ({ label: c.name, value: c.id })),
])
const pmItems = computed(() => [
  { label: 'All payment methods', value: undefined },
  ...paymentMethods.value.map(p => ({ label: p.name, value: p.id })),
])
</script>

<template>
  <div>
    <UiPageHeader title="Transactions" :subtitle="total ? `${total} record${total === 1 ? '' : 's'}` : undefined">
      <UButton icon="i-lucide-plus" class="hidden lg:flex" @click="openQuickAdd()">Add</UButton>
    </UiPageHeader>

    <div class="px-4 sm:px-6 lg:px-8 space-y-4">
      <!-- Search + filter bar -->
      <div class="flex gap-2">
        <UInput
          v-model="filters.q"
          icon="i-lucide-search"
          placeholder="Search merchant, note, category, amount…"
          class="flex-1"
          size="lg"
        />
        <UButton
          :icon="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
          :color="hasFilters ? 'primary' : 'neutral'"
          :variant="hasFilters ? 'soft' : 'outline'"
          size="lg"
          aria-label="Filters"
          @click="filtersOpen = !filtersOpen"
        />
      </div>

      <div v-if="filtersOpen" class="panel p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 fade-slide-up">
        <USelectMenu v-model="filters.type" :items="typeItems" value-key="value" placeholder="Type" />
        <USelectMenu v-model="filters.categoryId" :items="categoryItems" value-key="value" placeholder="Category" :search-input="{ placeholder: 'Search…' }" />
        <USelectMenu v-model="filters.paymentMethodId" :items="pmItems" value-key="value" placeholder="Payment method" :search-input="{ placeholder: 'Search…' }" />
        <USelectMenu v-model="filters.source" :items="sourceItems" value-key="value" placeholder="Source" />
        <UInput v-model="filters.startDate" type="date" aria-label="From date" />
        <UInput v-model="filters.endDate" type="date" aria-label="To date" />
        <UInput v-model="filters.minAmount" inputmode="numeric" placeholder="Min amount" aria-label="Minimum amount" />
        <UInput v-model="filters.maxAmount" inputmode="numeric" placeholder="Max amount" aria-label="Maximum amount" />
        <div class="col-span-2 lg:col-span-4 flex items-center justify-between gap-2">
          <USelectMenu v-model="filters.sort" :items="sortItems" value-key="value" class="w-44" />
          <UButton v-if="hasFilters" variant="ghost" color="neutral" size="sm" icon="i-lucide-x" @click="clearFilters">
            Clear filters
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="fromCache"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        title="Offline — showing recent transactions saved on this device"
      />

      <!-- List -->
      <div v-if="loading" class="space-y-3">
        <USkeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl" />
      </div>

      <UiEmptyState
        v-else-if="items.length === 0 && !hasFilters"
        icon="i-lucide-receipt-text"
        title="No transactions yet"
        description="Record your first expense, income, or transfer."
      >
        <UButton icon="i-lucide-plus" @click="openQuickAdd()">Add Transaction</UButton>
      </UiEmptyState>

      <UiEmptyState
        v-else-if="items.length === 0"
        icon="i-lucide-search-x"
        title="Nothing matches these filters"
        description="Try broadening the search or clearing some filters."
      >
        <UButton variant="soft" color="neutral" @click="clearFilters">Clear filters</UButton>
      </UiEmptyState>

      <template v-else>
        <TransactionList :items="items" :grouped="filters.sort === 'newest' || filters.sort === 'oldest'" />
        <div v-if="nextCursor" class="flex justify-center pt-2 pb-6">
          <UButton variant="soft" color="neutral" :loading="loadingMore" @click="loadMore">
            Load more
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
