<script setup lang="ts">
import type { TransactionDto } from '#shared/types/api'

const props = defineProps<{
  items: TransactionDto[]
  grouped?: boolean
}>()

const { openEdit } = useQuickAdd()
const { money, dayLabel } = useFormat()

interface DayGroup {
  date: string
  items: TransactionDto[]
  expenseMinor: number
  incomeMinor: number
}

const groups = computed<DayGroup[]>(() => {
  if (!props.grouped) return []
  const map = new Map<string, DayGroup>()
  for (const tx of props.items) {
    let g = map.get(tx.date)
    if (!g) {
      g = { date: tx.date, items: [], expenseMinor: 0, incomeMinor: 0 }
      map.set(tx.date, g)
    }
    g.items.push(tx)
    if (tx.type === 'expense') g.expenseMinor += tx.amountMinor
    if (tx.type === 'income') g.incomeMinor += tx.amountMinor
  }
  return [...map.values()]
})
</script>

<template>
  <div v-if="grouped" class="space-y-4">
    <section v-for="g in groups" :key="g.date">
      <header class="flex items-baseline justify-between px-3 sm:px-4 pb-1.5">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ dayLabel(g.date) }}</h3>
        <span class="text-xs text-dimmed tnum">
          <template v-if="g.expenseMinor > 0">−{{ money(g.expenseMinor) }}</template>
          <template v-if="g.incomeMinor > 0"><span class="text-success/80 ml-2">+{{ money(g.incomeMinor) }}</span></template>
        </span>
      </header>
      <div class="panel py-1">
        <TransactionRow v-for="tx in g.items" :key="tx.id" :tx="tx" @edit="openEdit" />
      </div>
    </section>
  </div>
  <div v-else class="panel py-1">
    <TransactionRow v-for="tx in items" :key="tx.id" :tx="tx" show-date @edit="openEdit" />
  </div>
</template>
