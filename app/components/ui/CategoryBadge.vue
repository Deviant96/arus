<script setup lang="ts">
import type { CategoryRef } from '#shared/types/api'

const props = defineProps<{
  category?: CategoryRef | null
  size?: 'sm' | 'md' | 'lg'
  fallbackIcon?: string
}>()

const color = computed(() => props.category?.color ?? '#D4C4A8')
const sizeClass = computed(() => ({
  sm: 'size-7 rounded-xl',
  md: 'size-9 rounded-2xl',
  lg: 'size-11 rounded-2xl',
}[props.size ?? 'md']))

const iconClass = computed(() => ({ sm: 'size-3.5', md: 'size-4.5', lg: 'size-5' }[props.size ?? 'md']))
</script>

<template>
  <span
    class="flex items-center justify-center shrink-0"
    :class="sizeClass"
    :style="{ backgroundColor: `${color}38`, color }"

  >
    <UIcon :name="category?.icon || fallbackIcon || 'i-lucide-tag'" :class="iconClass" />
  </span>
</template>
