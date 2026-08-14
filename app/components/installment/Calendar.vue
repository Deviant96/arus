<script setup lang="ts">
import type { InstallmentCalendarItem } from '#shared/types/api'
import { daysInMonth, monthStringRange, formatMonthString, pad2, todayInTz } from '#shared/utils/dates'

const { money, timezone, dayLabel } = useFormat()

const view = ref<'month' | 'list'>('month')
const month = ref(todayInTz(timezone.value).slice(0, 7))
const items = ref<InstallmentCalendarItem[]>([])
const loading = ref(false)

const api = useApi()

async function load() {
  loading.value = true
  try {
    const range = monthStringRange(month.value)
    const res = await api.cachedGet<{ items: InstallmentCalendarItem[] }>(
      `installment-cal:${month.value}`,
      '/api/installments/calendar',
      range as never,
    )
    items.value = res.data.items
  }
  finally {
    loading.value = false
  }
}

watch(month, load, { immediate: true })

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  month.value = `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

const monthLabel = computed(() => formatMonthString(month.value))
const today = computed(() => todayInTz(timezone.value))

// Month grid: weeks starting Monday
const grid = computed(() => {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const days = daysInMonth(y, m)
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // Mon=0
  const cells: { date: string | null, items: InstallmentCalendarItem[] }[] = []
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, items: [] })
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad2(m)}-${pad2(d)}`
    cells.push({ date, items: items.value.filter(it => it.dueDate === date) })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, items: [] })
  return cells
})

const statusDot: Record<string, string> = {
  paid: 'bg-success',
  upcoming: 'bg-info',
  late: 'bg-error',
  partially_paid: 'bg-warning',
  skipped: 'bg-zinc-600',
}

const listItems = computed(() => [...items.value].sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
</script>

<template>
  <div class="panel overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-default/60">
      <div class="flex items-center gap-1">
        <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="sm" aria-label="Previous month" @click="shiftMonth(-1)" />
        <span class="text-sm font-semibold w-36 text-center">{{ monthLabel }}</span>
        <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="sm" aria-label="Next month" @click="shiftMonth(1)" />
      </div>
      <div class="flex rounded-lg bg-elevated p-0.5">
        <button
          v-for="v in (['month', 'list'] as const)"
          :key="v"
          type="button"
          class="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
          :class="view === v ? 'bg-accented text-highlighted' : 'text-muted'"
          @click="view = v"
        >
          {{ v }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="p-4"><USkeleton class="h-64 w-full rounded-xl" /></div>

    <template v-else-if="view === 'month'">
      <div class="grid grid-cols-7 text-center text-[11px] font-medium text-dimmed uppercase py-2 border-b border-default/40">
        <span v-for="d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="d">{{ d }}</span>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="(cell, i) in grid"
          :key="i"
          class="min-h-16 sm:min-h-20 border-b border-r border-default/30 p-1 sm:p-1.5"
          :class="[(i + 1) % 7 === 0 ? 'border-r-0' : '', cell.date === today ? 'bg-primary/5' : '']"
        >
          <template v-if="cell.date">
            <span
              class="text-[11px] tnum"
              :class="cell.date === today ? 'flex items-center justify-center size-5 rounded-full bg-primary text-inverted font-semibold' : 'text-dimmed'"
            >
              {{ Number(cell.date.slice(8)) }}
            </span>
            <div class="mt-0.5 space-y-0.5">
              <NuxtLink
                v-for="it in cell.items"
                :key="it.itemId"
                :to="`/installments/${it.installmentId}`"
                class="block rounded-md bg-elevated/80 hover:bg-accented px-1 sm:px-1.5 py-0.5 transition-colors"
              >
                <span class="flex items-center gap-1">
                  <span class="size-1.5 rounded-full shrink-0" :class="statusDot[it.status]" />
                  <span class="text-[10px] sm:text-[11px] truncate font-medium">{{ it.installmentTitle }}</span>
                </span>
                <span class="hidden sm:block text-[10px] text-muted tnum truncate">{{ money(it.expectedAmountMinor, it.currency) }}</span>
              </NuxtLink>
            </div>
          </template>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11px] text-muted">
        <span v-for="(cls, s) in statusDot" :key="s" class="flex items-center gap-1.5 capitalize">
          <span class="size-1.5 rounded-full" :class="cls" /> {{ String(s).replace('_', ' ') }}
        </span>
      </div>
    </template>

    <template v-else>
      <div v-if="listItems.length === 0" class="px-6 py-10 text-center text-sm text-muted">
        No installments due in {{ monthLabel }}.
      </div>
      <div v-else class="divide-y divide-default/40">
        <NuxtLink
          v-for="it in listItems"
          :key="it.itemId"
          :to="`/installments/${it.installmentId}`"
          class="flex items-center gap-3 px-4 py-3 hover:bg-elevated/60 transition-colors"
        >
          <span class="flex flex-col items-center justify-center size-10 rounded-xl bg-elevated shrink-0">
            <span class="text-sm font-semibold tnum leading-none">{{ Number(it.dueDate.slice(8)) }}</span>
            <span class="text-[9px] text-dimmed uppercase mt-0.5">{{ dayLabel(it.dueDate, false).split(' ')[1] ?? '' }}</span>
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium truncate">{{ it.installmentTitle }}</span>
            <span class="block text-xs text-muted">#{{ it.sequence }} of {{ it.count }}</span>
          </span>
          <span class="text-right">
            <span class="block text-sm font-semibold tnum">{{ money(it.expectedAmountMinor, it.currency) }}</span>
            <InstallmentStatusBadge :status="it.status" class="mt-0.5" />
          </span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
