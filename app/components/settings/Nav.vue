<script setup lang="ts">
const route = useRoute()

const items = [
  { label: 'General', to: '/settings', icon: 'i-lucide-user' },
  { label: 'Categories', to: '/settings/categories', icon: 'i-lucide-tags' },
  { label: 'Payment Methods', to: '/settings/payment-methods', icon: 'i-lucide-credit-card' },
  { label: 'Merchants', to: '/settings/merchants', icon: 'i-lucide-store' },
  { label: 'AI', to: '/settings/ai', icon: 'i-lucide-sparkles' },
  { label: 'Import / Export', to: '/settings/data', icon: 'i-lucide-database' },
]
</script>

<template>
  <div class="flex gap-1.5 overflow-x-auto scroll-thin px-4 sm:px-6 lg:px-8 pb-4 -mt-1">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
      :class="route.path === item.to
        ? 'border-primary/60 bg-primary/15 text-primary'
        : 'border-default bg-elevated/40 text-muted hover:text-highlighted'"
    >
      <UIcon :name="item.icon" class="size-3.5" />
      {{ item.label }}
    </NuxtLink>
  </div>
</template>
