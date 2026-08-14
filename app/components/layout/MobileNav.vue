<script setup lang="ts">
const route = useRoute()
const { openQuickAdd } = useQuickAdd()

const left = [
  { label: 'Home', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Activity', to: '/transactions', icon: 'i-lucide-arrow-left-right' },
]
const right = [
  { label: 'Reports', to: '/reports', icon: 'i-lucide-chart-pie' },
  { label: 'More', to: '/more', icon: 'i-lucide-menu' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-default bg-default/95 backdrop-blur pb-safe">
    <div class="grid grid-cols-5 items-center h-16">
      <NuxtLink
        v-for="item in left"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center justify-center gap-1 h-full"
        :class="isActive(item.to) ? 'text-primary' : 'text-muted'"
      >
        <UIcon :name="item.icon" class="size-5" />
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </NuxtLink>

      <div class="flex items-center justify-center">
        <button
          class="flex items-center justify-center size-13 -mt-5 rounded-2xl bg-primary text-inverted shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          aria-label="Add transaction"
          @click="openQuickAdd()"
        >
          <UIcon name="i-lucide-plus" class="size-6" />
        </button>
      </div>

      <NuxtLink
        v-for="item in right"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center justify-center gap-1 h-full"
        :class="isActive(item.to) ? 'text-primary' : 'text-muted'"
      >
        <UIcon :name="item.icon" class="size-5" />
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
