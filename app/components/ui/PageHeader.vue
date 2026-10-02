<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-5 flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <h1 class="text-xl lg:text-3xl font-bold tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-muted mt-1">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="flex items-center gap-2 shrink-0">
      <slot />
    </div>
  </header>
</template>
