<script setup lang="ts">
import type { InstallmentItemStatus } from '#shared/schemas/installment'

const props = defineProps<{ status: InstallmentItemStatus }>()

const meta = computed(() => ({
  upcoming: { label: 'Upcoming', class: 'bg-elevated text-muted' },
  partially_paid: { label: 'Partially paid', class: 'bg-warning/15 text-warning' },
  paid: { label: 'Paid', class: 'bg-success/15 text-success' },
  late: { label: 'Late', class: 'bg-error/15 text-error' },
  skipped: { label: 'Skipped', class: 'bg-elevated text-dimmed line-through' },
}[props.status]))
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" :class="meta.class">
    {{ meta.label }}
  </span>
</template>
