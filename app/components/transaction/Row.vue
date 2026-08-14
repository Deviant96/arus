<script setup lang="ts">
import type { TransactionDto } from '#shared/types/api'

const props = defineProps<{
  tx: TransactionDto
  showDate?: boolean
}>()

const emit = defineEmits<{ edit: [tx: TransactionDto] }>()

const { signedMoney, dayLabel } = useFormat()

const title = computed(() => {
  if (props.tx.type === 'transfer') {
    return `${props.tx.fromPaymentMethod?.name ?? '—'} → ${props.tx.toPaymentMethod?.name ?? '—'}`
  }
  return props.tx.merchant?.name || props.tx.note || props.tx.category?.name || (props.tx.type === 'income' ? 'Income' : 'Expense')
})

const subtitle = computed(() => {
  const parts: string[] = []
  if (props.tx.type === 'transfer') {
    parts.push('Transfer')
  }
  else {
    if (props.tx.category?.name) parts.push(props.tx.category.name)
    if (props.tx.paymentMethod?.name) parts.push(props.tx.paymentMethod.name)
  }
  if (props.showDate) parts.push(dayLabel(props.tx.date))
  if (props.tx.installmentTitle) parts.push(`Installment: ${props.tx.installmentTitle}`)
  else if (props.tx.note && title.value !== props.tx.note) parts.push(props.tx.note)
  return parts.join(' · ')
})

const amountClass = computed(() => ({
  income: 'text-success',
  expense: 'text-default',
  transfer: 'text-muted',
}[props.tx.type]))
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 px-3 sm:px-4 py-2.5 text-left rounded-xl hover:bg-elevated/60 transition-colors group"
    @click="emit('edit', tx)"
  >
    <UiCategoryBadge
      v-if="tx.type !== 'transfer'"
      :category="tx.category"
      :fallback-icon="tx.type === 'income' ? 'i-lucide-arrow-down-left' : 'i-lucide-receipt'"
    />
    <span v-else class="flex items-center justify-center size-9 rounded-xl bg-info/10 text-info shrink-0">
      <UIcon name="i-lucide-arrow-left-right" class="size-4.5" />
    </span>

    <span class="flex-1 min-w-0">
      <span class="block truncate text-sm font-medium text-highlighted">{{ title }}</span>
      <span class="block truncate text-xs text-muted mt-0.5">{{ subtitle }}</span>
    </span>

    <span class="text-right shrink-0">
      <span class="block text-sm font-semibold tnum" :class="amountClass">
        {{ signedMoney(tx.amountMinor, tx.type, tx.currency) }}
      </span>
      <span class="block text-[11px] text-dimmed tnum mt-0.5">{{ tx.time }}</span>
    </span>
  </button>
</template>
