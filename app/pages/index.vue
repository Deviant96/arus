<script setup lang="ts">
import type { DashboardData } from '#shared/types/api'
import { formatMonthString } from '#shared/utils/dates'
import { useSyncStore } from '../stores/sync'

const { user } = useSessionUser()
const { money, dayLabel } = useFormat()
const { openQuickAdd, version } = useQuickAdd()
const api = useApi()
const sync = useSyncStore()

const fromCache = ref(false)
const { data, refresh, status } = await useAsyncData<DashboardData | null>('dashboard', async () => {
  try {
    const res = await api.cachedGet<DashboardData>('dashboard', '/api/dashboard')
    fromCache.value = res.fromCache
    return res.data
  }
  catch {
    return null
  }
}, { server: false, lazy: true })

watch(version, () => refresh())
watch(() => sync.syncedAt, () => refresh())

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 4) return 'Good evening'
  if (h < 11) return 'Good morning'
  if (h < 15) return 'Good afternoon'
  return 'Good evening'
})

const firstName = computed(() => user.value?.name.split(' ')[0] ?? '')
const monthLabel = computed(() => (data.value ? formatMonthString(data.value.month) : ''))
const hasAny = computed(() => (data.value?.recentTransactions.length ?? 0) > 0)

const statusColor: Record<string, string> = {
  paid: 'text-success',
  upcoming: 'text-muted',
  late: 'text-error',
  partially_paid: 'text-warning',
  skipped: 'text-dimmed',
}
const statusLabel: Record<string, string> = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  late: 'Late',
  partially_paid: 'Partial',
  skipped: 'Skipped',
}
</script>

<template>
  <div>
    <UiPageHeader :title="`${greeting}${firstName ? `, ${firstName}` : ''}`" :subtitle="monthLabel">
      <UButton icon="i-lucide-plus" size="lg" class="hidden lg:flex" @click="openQuickAdd()">
        Add Transaction
      </UButton>
    </UiPageHeader>

    <div class="px-4 sm:px-6 lg:px-8 space-y-6">
      <UAlert
        v-if="fromCache"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        title="Showing data saved on this device"
        description="You appear to be offline. Figures update automatically once reconnected."
      />

      <!-- Summary -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="panel px-5 py-4">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Income</p>
          <p class="text-xl lg:text-2xl font-semibold tnum mt-1.5 text-success">
            {{ data ? money(data.summary.incomeMinor) : '—' }}
          </p>
        </div>
        <div class="panel px-5 py-4">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Expenses</p>
          <p class="text-xl lg:text-2xl font-semibold tnum mt-1.5">
            {{ data ? money(data.summary.expenseMinor) : '—' }}
          </p>
        </div>
        <div class="panel px-5 py-4">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Net</p>
          <p class="text-xl lg:text-2xl font-semibold tnum mt-1.5" :class="(data?.summary.netMinor ?? 0) >= 0 ? 'text-success' : 'text-error'">
            {{ data ? money(data.summary.netMinor) : '—' }}
          </p>
        </div>
      </section>

      <!-- Expected (never mixed with actuals) -->
      <section
        v-if="data && (data.summary.upcomingInstallmentsMinor > 0 || data.summary.expectedRecurringMinor > 0)"
        class="panel px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1.5"
      >
        <span class="text-xs font-medium text-muted uppercase tracking-wide flex items-center gap-1.5">
          <UIcon name="i-lucide-calendar-clock" class="size-3.5" /> Still expected this month
        </span>
        <span v-if="data.summary.upcomingInstallmentsMinor > 0" class="text-sm tnum">
          Installments <span class="font-semibold">{{ money(data.summary.upcomingInstallmentsMinor) }}</span>
        </span>
        <span v-if="data.summary.expectedRecurringMinor > 0" class="text-sm tnum">
          Recurring <span class="font-semibold">{{ money(data.summary.expectedRecurringMinor) }}</span>
        </span>
        <span class="text-[11px] text-dimmed ml-auto">not counted as spending yet</span>
      </section>

      <div v-if="status === 'pending' && !data" class="space-y-3">
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-64 w-full rounded-2xl" />
      </div>

      <UiEmptyState
        v-else-if="!hasAny"
        icon="i-lucide-receipt-text"
        title="No transactions yet"
        description="Record your first expense, income, or transfer — it takes about five seconds."
      >
        <UButton icon="i-lucide-plus" size="lg" @click="openQuickAdd()">Add Transaction</UButton>
      </UiEmptyState>

      <div v-else class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <!-- Recent transactions -->
        <section class="xl:col-span-2">
          <div class="flex items-center justify-between mb-2 px-1">
            <h2 class="text-sm font-semibold">Recent transactions</h2>
            <UButton to="/transactions" variant="link" color="neutral" size="xs" trailing-icon="i-lucide-arrow-right">
              View all
            </UButton>
          </div>
          <TransactionList :items="data!.recentTransactions" />
        </section>

        <div class="space-y-6">
          <!-- Upcoming installments -->
          <section v-if="data!.upcomingInstallments.length">
            <div class="flex items-center justify-between mb-2 px-1">
              <h2 class="text-sm font-semibold">Installments</h2>
              <UButton to="/installments" variant="link" color="neutral" size="xs" trailing-icon="i-lucide-arrow-right">
                All
              </UButton>
            </div>
            <div class="panel divide-y divide-default/50">
              <NuxtLink
                v-for="item in data!.upcomingInstallments"
                :key="item.itemId"
                :to="`/installments/${item.installmentId}`"
                class="flex items-center gap-3 px-4 py-3 hover:bg-elevated/60 transition-colors"
              >
                <span class="flex-1 min-w-0">
                  <span class="block text-sm font-medium truncate">{{ item.installmentTitle }}</span>
                  <span class="block text-xs text-muted mt-0.5">
                    #{{ item.sequence }}/{{ item.count }} · {{ dayLabel(item.dueDate) }}
                  </span>
                </span>
                <span class="text-right">
                  <span class="block text-sm font-semibold tnum">{{ money(item.expectedAmountMinor - item.paidMinor, item.currency) }}</span>
                  <span class="block text-[11px] font-medium" :class="statusColor[item.status]">{{ statusLabel[item.status] }}</span>
                </span>
              </NuxtLink>
            </div>
          </section>

          <!-- Budgets -->
          <section v-if="data!.budgets.length">
            <div class="flex items-center justify-between mb-2 px-1">
              <h2 class="text-sm font-semibold">Budgets</h2>
              <UButton to="/budgets" variant="link" color="neutral" size="xs" trailing-icon="i-lucide-arrow-right">
                All
              </UButton>
            </div>
            <div class="panel px-4 py-3 space-y-3">
              <BudgetProgress v-for="b in data!.budgets" :key="b.id" :budget="b" compact />
            </div>
          </section>

          <!-- Insights -->
          <section v-if="data!.insights.length">
            <h2 class="text-sm font-semibold mb-2 px-1">Insights</h2>
            <div class="space-y-2">
              <InsightCard v-for="i in data!.insights" :key="i.id" :insight="i" />
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
