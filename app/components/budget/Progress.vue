<script setup lang="ts">
import type { BudgetDto } from '#shared/types/api'

const props = defineProps<{
  budget: BudgetDto
  compact?: boolean
}>()

const { money } = useFormat()

const pct = computed(() => Math.min(100, props.budget.percent))
const barColor = computed(() => {
  if (props.budget.percent >= 100) return 'bg-error'
  if (props.budget.percent >= 85) return 'bg-warning'
  return 'bg-primary'
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="flex items-center gap-1.5 text-sm min-w-0">
        <UIcon :name="budget.category?.icon || 'i-lucide-tag'" class="size-3.5 shrink-0" :style="{ color: budget.category?.color ?? undefined }" />
        <span class="truncate font-medium">{{ budget.category?.name }}</span>
        <span v-if="budget.month" class="text-[10px] text-dimmed border border-default rounded px-1">{{ budget.month }}</span>
      </span>
      <span class="text-xs tnum shrink-0" :class="budget.percent >= 100 ? 'text-error font-semibold' : 'text-muted'">
        {{ budget.percent }}%
      </span>
    </div>
    <div class="h-1.5 rounded-full bg-elevated overflow-hidden" role="progressbar" :aria-valuenow="budget.percent" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full rounded-full transition-all" :class="barColor" :style="{ width: `${pct}%` }" />
    </div>
    <div v-if="!compact" class="flex items-center justify-between mt-1 text-xs text-muted tnum">
      <span>{{ money(budget.spentMinor, budget.currency) }} spent</span>
      <span v-if="budget.remainingMinor >= 0">{{ money(budget.remainingMinor, budget.currency) }} left</span>
      <span v-else class="text-error">{{ money(-budget.remainingMinor, budget.currency) }} over</span>
    </div>
  </div>
</template>
