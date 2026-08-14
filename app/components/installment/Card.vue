<script setup lang="ts">
import type { InstallmentDto } from '#shared/types/api'

const props = defineProps<{ installment: InstallmentDto }>()
const { money, dayLabel } = useFormat()

const progress = computed(() => {
  const done = props.installment.items === undefined
    ? props.installment.paidCount
    : props.installment.paidCount
  return Math.round((done / props.installment.count) * 100)
})
</script>

<template>
  <NuxtLink
    :to="`/installments/${installment.id}`"
    class="panel panel-hover block px-5 py-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-medium text-[15px] truncate">{{ installment.title }}</h3>
        <p class="text-xs text-muted mt-0.5">
          {{ installment.category?.name }} · {{ installment.paymentMethod?.name }}
        </p>
      </div>
      <UBadge v-if="installment.status === 'completed'" color="success" variant="subtle" size="sm">Completed</UBadge>
      <UBadge v-else-if="installment.lateCount > 0" color="error" variant="subtle" size="sm">
        {{ installment.lateCount }} late
      </UBadge>
    </div>

    <div class="mt-3">
      <div class="flex items-baseline justify-between text-xs text-muted mb-1">
        <span>{{ installment.paidCount }}/{{ installment.count }} paid</span>
        <span class="tnum">{{ money(installment.totalPaidMinor, installment.currency) }} of {{ money(installment.totalExpectedMinor, installment.currency) }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
        <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <div v-if="installment.nextItem" class="flex items-center justify-between mt-3 text-sm">
      <span class="text-muted text-xs">
        Next: #{{ installment.nextItem.sequence }} · {{ dayLabel(installment.nextItem.dueDate) }}
      </span>
      <span class="font-semibold tnum">{{ money(installment.nextItem.remainingMinor, installment.currency) }}</span>
    </div>
  </NuxtLink>
</template>
