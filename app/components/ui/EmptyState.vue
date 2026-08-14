<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="panel flex flex-col items-center justify-center text-center px-6 py-14">
    <span class="flex items-center justify-center size-12 rounded-2xl bg-elevated text-muted mb-4">
      <UIcon :name="icon" class="size-6" />
    </span>
    <h3 class="font-medium text-[15px]">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted mt-1 max-w-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
