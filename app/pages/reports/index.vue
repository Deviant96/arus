<script setup lang="ts">
import type { CategoryBreakdownRow, InstallmentReport, MerchantBreakdownRow, PaymentMethodBreakdownRow, RecurringReport, ReportSummary, TrendPoint } from '#shared/types/api'
import { minorToMajor } from '#shared/utils/money'

const { money, currency } = useFormat()
const { tooltip, moneyAxis, axisLabel, splitLine, palette } = useChartTheme()
const api = useApi()

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'custom', label: 'Custom' },
] as const

const period = ref<typeof PERIODS[number]['value']>('this_month')
const customStart = ref('')
const customEnd = ref('')

const params = computed(() => {
  const p: Record<string, string> = { period: period.value }
  if (period.value === 'custom') {
    if (customStart.value) p.startDate = customStart.value
    if (customEnd.value) p.endDate = customEnd.value
  }
  return p
})

const loading = ref(false)
const summary = ref<ReportSummary | null>(null)
const cats = ref<CategoryBreakdownRow[]>([])
const trend = ref<{ granularity: string, points: TrendPoint[] } | null>(null)
const pms = ref<PaymentMethodBreakdownRow[]>([])
const merchants = ref<MerchantBreakdownRow[]>([])
const instReport = ref<InstallmentReport | null>(null)
const recReport = ref<RecurringReport | null>(null)

async function load() {
  loading.value = true
  const key = `${period.value}:${customStart.value}:${customEnd.value}`
  try {
    const [s, c, t, p, m, ir, rr] = await Promise.all([
      api.cachedGet<ReportSummary>(`rep:sum:${key}`, '/api/reports/summary', params.value),
      api.cachedGet<{ items: CategoryBreakdownRow[] }>(`rep:cat:${key}`, '/api/reports/categories', params.value),
      api.cachedGet<{ granularity: string, points: TrendPoint[] }>(`rep:trend:${key}`, '/api/reports/trends', params.value),
      api.cachedGet<{ items: PaymentMethodBreakdownRow[] }>(`rep:pm:${key}`, '/api/reports/payment-methods', params.value),
      api.cachedGet<{ items: MerchantBreakdownRow[] }>(`rep:mer:${key}`, '/api/reports/merchants', params.value),
      api.cachedGet<InstallmentReport>(`rep:inst:${key}`, '/api/reports/installments', params.value),
      api.cachedGet<RecurringReport>(`rep:rec:${key}`, '/api/reports/recurring', params.value),
    ])
    summary.value = s.data
    cats.value = c.data.items
    trend.value = t.data
    pms.value = p.data.items
    merchants.value = m.data.items
    instReport.value = ir.data
    recReport.value = rr.data
  }
  catch { /* offline without cache */ }
  finally {
    loading.value = false
  }
}

watch([period, customStart, customEnd], load, { immediate: false })
onMounted(load)

const hasData = computed(() => (summary.value?.transactionCount ?? 0) > 0)

// ---- Chart options ----
const donutOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: '#17171a',
    borderColor: '#2a2a30',
    textStyle: { color: '#e4e4e7', fontSize: 12 },
    valueFormatter: (v: number) => money(Math.round(v * (currency.value === 'IDR' ? 1 : 100))),
  },
  series: [{
    type: 'pie',
    radius: ['58%', '85%'],
    itemStyle: { borderColor: '#0a0a0b', borderWidth: 2 },
    label: { show: false },
    data: cats.value.slice(0, 9).map((c, i) => ({
      name: c.name,
      value: minorToMajor(c.amountMinor, currency.value),
      itemStyle: { color: c.color ?? palette[i % palette.length] },
    })),
  }],
}))

const trendOption = computed(() => {
  const points = trend.value?.points ?? []
  return {
    tooltip: tooltip(),
    legend: { textStyle: { color: '#8b8b94', fontSize: 11 }, top: 0, icon: 'circle' },
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map(p => p.bucket.length === 10 ? p.bucket.slice(8) + '/' + p.bucket.slice(5, 7) : p.bucket),
      axisLabel,
      axisLine: { lineStyle: { color: '#212126' } },
      axisTick: { show: false },
    },
    yAxis: moneyAxis(),
    series: [
      {
        name: 'Income',
        type: 'bar',
        data: points.map(p => minorToMajor(p.incomeMinor, currency.value)),
        itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
      {
        name: 'Expenses',
        type: 'bar',
        data: points.map(p => minorToMajor(p.expenseMinor, currency.value)),
        itemStyle: { color: '#f43f5e', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
    ],
  }
})

const statusMeta: Record<string, { label: string, class: string }> = {
  paid: { label: 'Paid', class: 'text-success' },
  upcoming: { label: 'Upcoming', class: 'text-info' },
  late: { label: 'Late', class: 'text-error' },
  partially_paid: { label: 'Partial', class: 'text-warning' },
  skipped: { label: 'Skipped', class: 'text-dimmed' },
}
</script>

<template>
  <div>
    <UiPageHeader title="Reports" subtitle="Objective numbers — actual first, expected clearly separated" />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6">
      <!-- Period selector -->
      <div class="space-y-2">
        <div class="flex gap-1.5 overflow-x-auto scroll-thin -mx-1 px-1">
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            class="shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
            :class="period === p.value
              ? 'border-primary/60 bg-primary/15 text-primary'
              : 'border-default bg-elevated/40 text-muted hover:text-highlighted'"
            @click="period = p.value"
          >
            {{ p.label }}
          </button>
        </div>
        <div v-if="period === 'custom'" class="flex gap-2 items-center">
          <UInput v-model="customStart" type="date" size="sm" aria-label="Start date" />
          <span class="text-muted text-xs">to</span>
          <UInput v-model="customEnd" type="date" size="sm" aria-label="End date" />
        </div>
      </div>

      <div v-if="loading && !summary" class="space-y-3">
        <USkeleton class="h-24 rounded-2xl" />
        <USkeleton class="h-72 rounded-2xl" />
      </div>

      <UiEmptyState
        v-else-if="!hasData"
        icon="i-lucide-chart-pie"
        title="Not enough data yet"
        description="Record a few transactions to start seeing spending patterns for this period."
      />

      <template v-else>
        <!-- Summary -->
        <section class="grid grid-cols-3 gap-3">
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Income</p>
            <p class="text-base sm:text-xl font-semibold tnum mt-1 text-success">{{ money(summary!.incomeMinor) }}</p>
          </div>
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Expenses</p>
            <p class="text-base sm:text-xl font-semibold tnum mt-1">{{ money(summary!.expenseMinor) }}</p>
          </div>
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Net</p>
            <p class="text-base sm:text-xl font-semibold tnum mt-1" :class="summary!.netMinor >= 0 ? 'text-success' : 'text-error'">
              {{ money(summary!.netMinor) }}
            </p>
          </div>
        </section>

        <section
          v-if="summary!.upcomingInstallmentsMinor > 0 || summary!.expectedRecurringMinor > 0"
          class="panel px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1.5"
        >
          <span class="text-xs font-medium text-muted uppercase tracking-wide">Expected (not spent yet)</span>
          <span v-if="summary!.upcomingInstallmentsMinor > 0" class="text-sm tnum">Installments <b>{{ money(summary!.upcomingInstallmentsMinor) }}</b></span>
          <span v-if="summary!.expectedRecurringMinor > 0" class="text-sm tnum">Recurring <b>{{ money(summary!.expectedRecurringMinor) }}</b></span>
        </section>

        <!-- Income vs Expense trend -->
        <section class="panel p-5">
          <h2 class="text-sm font-semibold mb-3">Income vs Expenses</h2>
          <ClientOnly>
            <VChart :option="trendOption" :autoresize="true" class="h-72 w-full" />
          </ClientOnly>
        </section>

        <div class="grid lg:grid-cols-2 gap-6">
          <!-- Category breakdown -->
          <section class="panel p-5">
            <h2 class="text-sm font-semibold mb-3">Expenses by category</h2>
            <div v-if="cats.length === 0" class="text-sm text-muted py-8 text-center">No expenses in this period.</div>
            <template v-else>
              <div class="flex items-center gap-4">
                <ClientOnly>
                  <VChart :option="donutOption" :autoresize="true" class="h-44 w-44 shrink-0" />
                </ClientOnly>
                <div class="flex-1 space-y-2 min-w-0">
                  <div v-for="c in cats.slice(0, 5)" :key="c.categoryId ?? 'none'" class="flex items-center gap-2 text-sm">
                    <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: c.color ?? '#64748b' }" />
                    <span class="truncate flex-1">{{ c.name }}</span>
                    <span class="tnum text-muted text-xs">{{ c.percent }}%</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 divide-y divide-default/40">
                <div v-for="c in cats" :key="c.categoryId ?? 'none'" class="flex items-center gap-3 py-2 text-sm">
                  <UIcon :name="c.icon || 'i-lucide-tag'" class="size-4 shrink-0" :style="{ color: c.color ?? undefined }" />
                  <span class="flex-1 truncate">{{ c.name }}</span>
                  <span class="text-xs text-dimmed">{{ c.count }}×</span>
                  <span class="tnum font-medium">{{ money(c.amountMinor) }}</span>
                </div>
              </div>
            </template>
          </section>

          <!-- Payment methods -->
          <section class="panel p-5">
            <h2 class="text-sm font-semibold mb-3">Spending by payment method</h2>
            <div v-if="pms.filter(p => p.expenseMinor > 0).length === 0" class="text-sm text-muted py-8 text-center">No expenses in this period.</div>
            <div v-else class="space-y-3">
              <div v-for="p in pms.filter(x => x.expenseMinor > 0)" :key="p.paymentMethodId ?? 'none'">
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="truncate">{{ p.name }}</span>
                  <span class="tnum font-medium">{{ money(p.expenseMinor) }}</span>
                </div>
                <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
                  <div class="h-full rounded-full bg-info" :style="{ width: `${Math.min(100, p.percent)}%` }" />
                </div>
                <p class="text-[11px] text-dimmed mt-0.5">{{ p.count }} transactions · {{ p.percent }}%</p>
              </div>
            </div>
          </section>

          <!-- Merchants -->
          <section class="panel p-5">
            <h2 class="text-sm font-semibold mb-3">Top merchants</h2>
            <div v-if="merchants.length === 0" class="text-sm text-muted py-8 text-center">No merchant data in this period.</div>
            <div v-else class="divide-y divide-default/40">
              <div v-for="(m, i) in merchants" :key="m.merchantId ?? i" class="flex items-center gap-3 py-2 text-sm">
                <span class="text-xs text-dimmed w-5 tnum">{{ i + 1 }}.</span>
                <span class="flex-1 truncate">{{ m.name }}</span>
                <span class="text-xs text-dimmed">{{ m.count }}×</span>
                <span class="tnum font-medium">{{ money(m.amountMinor) }}</span>
              </div>
            </div>
          </section>

          <!-- Installments: actual vs expected -->
          <section class="panel p-5">
            <h2 class="text-sm font-semibold mb-3">Installments</h2>
            <div class="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p class="text-[11px] text-muted uppercase tracking-wide">Actually paid</p>
                <p class="text-sm font-semibold tnum mt-0.5 text-success">{{ money(instReport?.paidMinor ?? 0) }}</p>
                <p class="text-[11px] text-dimmed">{{ instReport?.paidCount ?? 0 }} payment{{ (instReport?.paidCount ?? 0) === 1 ? '' : 's' }}</p>
              </div>
              <div>
                <p class="text-[11px] text-muted uppercase tracking-wide">Still due</p>
                <p class="text-sm font-semibold tnum mt-0.5">{{ money(instReport?.upcomingMinor ?? 0) }}</p>
                <p class="text-[11px] text-dimmed">{{ instReport?.upcomingCount ?? 0 }} scheduled</p>
              </div>
              <div>
                <p class="text-[11px] text-muted uppercase tracking-wide">Late</p>
                <p class="text-sm font-semibold tnum mt-0.5" :class="(instReport?.lateMinor ?? 0) > 0 ? 'text-error' : ''">{{ money(instReport?.lateMinor ?? 0) }}</p>
                <p class="text-[11px] text-dimmed">{{ instReport?.lateCount ?? 0 }} overdue</p>
              </div>
            </div>
            <div v-if="(instReport?.items.length ?? 0) > 0" class="divide-y divide-default/40 max-h-56 overflow-y-auto">
              <NuxtLink
                v-for="it in instReport!.items"
                :key="it.itemId"
                :to="`/installments/${it.installmentId}`"
                class="flex items-center gap-3 py-2 text-sm hover:bg-elevated/40 rounded-md px-1 transition-colors"
              >
                <span class="text-xs text-dimmed tnum w-14">{{ it.dueDate.slice(5) }}</span>
                <span class="flex-1 truncate">{{ it.installmentTitle }} <span class="text-dimmed text-xs">#{{ it.sequence }}</span></span>
                <span class="text-[11px] font-medium" :class="statusMeta[it.status]?.class">{{ statusMeta[it.status]?.label }}</span>
                <span class="tnum font-medium">{{ money(it.expectedAmountMinor, it.currency) }}</span>
              </NuxtLink>
            </div>
            <p v-else class="text-sm text-muted py-4 text-center">No installments due in this period.</p>
          </section>
        </div>

        <!-- Recurring: expected vs actual -->
        <section class="panel p-5">
          <h2 class="text-sm font-semibold mb-1">Recurring — expected vs actual</h2>
          <p class="text-xs text-muted mb-4">Confirmed items are real transactions; expected items have not happened yet.</p>
          <div class="grid grid-cols-2 gap-3 mb-4 max-w-sm">
            <div>
              <p class="text-[11px] text-muted uppercase tracking-wide">Confirmed (actual)</p>
              <p class="text-sm font-semibold tnum mt-0.5 text-success">{{ money(recReport?.confirmedMinor ?? 0) }}</p>
            </div>
            <div>
              <p class="text-[11px] text-muted uppercase tracking-wide">Still expected</p>
              <p class="text-sm font-semibold tnum mt-0.5">{{ money(recReport?.expectedMinor ?? 0) }}</p>
            </div>
          </div>
          <div v-if="(recReport?.rows.length ?? 0) > 0" class="divide-y divide-default/40 max-h-64 overflow-y-auto">
            <div v-for="(r, i) in recReport!.rows" :key="i" class="flex items-center gap-3 py-2 text-sm">
              <span class="text-xs text-dimmed tnum w-14">{{ r.dueDate.slice(5) }}</span>
              <span class="flex-1 truncate">{{ r.name }}</span>
              <UBadge :color="r.confirmed ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ r.confirmed ? 'Confirmed' : 'Expected' }}
              </UBadge>
              <span class="tnum font-medium">
                {{ money(r.actualAmountMinor ?? r.expectedAmountMinor) }}
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-muted py-4 text-center">No recurring activity in this period.</p>
        </section>
      </template>
    </div>
  </div>
</template>
