<script setup lang="ts">
import type { CategoryRef } from '#shared/types/api'

const props = defineProps<{
  category?: CategoryRef | null
  size?: 'sm' | 'md' | 'lg'
  fallbackIcon?: string
}>()

const color = computed(() => props.category?.color ?? '#64748b')
const sizeClass = computed(() => ({
  sm: 'size-7 rounded-lg',
  md: 'size-9 rounded-xl',
  lg: 'size-11 rounded-xl',
}[props.size ?? 'md']))
const iconClass = computed(() => ({ sm: 'size-3.5', md: 'size-4.5', lg: 'size-5' }[props.size ?? 'md']))
</script>

<template>
  <span
    class="flex items-center justify-center shrink-0"
    :class="sizeClass"
    :style="{ backgroundColor: `${color}1f`, color }"
  >
    <UIcon :name="category?.icon || fallbackIcon || 'i-lucide-tag'" :class="iconClass" />
  </span>
</template>
