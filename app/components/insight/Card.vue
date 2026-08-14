<script setup lang="ts">
import type { InsightDto } from '#shared/types/api'

const props = defineProps<{ insight: InsightDto }>()

const toneClasses = computed(() => ({
  positive: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  neutral: 'text-info bg-info/10',
}[props.insight.tone]))
</script>

<template>
  <div class="panel px-4 py-3 flex gap-3">
    <span class="flex items-center justify-center size-8 rounded-lg shrink-0" :class="toneClasses">
      <UIcon :name="insight.icon" class="size-4" />
    </span>
    <div class="min-w-0">
      <p class="text-sm font-medium leading-snug">{{ insight.title }}</p>
      <p class="text-xs text-muted mt-0.5 leading-relaxed">{{ insight.body }}</p>
    </div>
  </div>
</template>
