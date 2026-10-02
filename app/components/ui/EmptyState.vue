<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="panel flex flex-col items-center justify-center text-center px-6 py-14">
    <span
      class="flex items-center justify-center size-14 rounded-3xl mb-4"
      style="background: color-mix(in srgb, var(--snug-butter) 65%, white); color: var(--snug-ink-muted);"
    >
      <UIcon :name="icon" class="size-7" />
    </span>
    <h3 class="font-bold text-base">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted mt-1.5 max-w-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
