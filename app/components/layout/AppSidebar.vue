<script setup lang="ts">
const route = useRoute()
const { user, logout } = useSessionUser()
const { openQuickAdd } = useQuickAdd()

const nav = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Transactions', to: '/transactions', icon: 'i-lucide-arrow-left-right' },
  { label: 'Installments', to: '/installments', icon: 'i-lucide-calendar-clock' },
  { label: 'Recurring', to: '/recurring', icon: 'i-lucide-repeat' },
  { label: 'Budgets', to: '/budgets', icon: 'i-lucide-target' },
  { label: 'Reports', to: '/reports', icon: 'i-lucide-chart-pie' },
  { label: 'Insights', to: '/insights', icon: 'i-lucide-lightbulb' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const userMenuItems = computed(() => [[
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: () => logout() },
]])
</script>

<template>
  <aside class="hidden lg:flex w-60 shrink-0 flex-col border-r border-default bg-muted/30 h-screen sticky top-0">
    <div class="flex items-center gap-2.5 px-5 h-16">
      <span class="flex items-center justify-center size-8 rounded-xl bg-primary/15 text-primary">
        <UIcon name="i-lucide-waves" class="size-4.5" />
      </span>
      <span class="font-semibold text-[15px] tracking-tight">Arus</span>
    </div>

    <div class="px-3 pb-2">
      <UButton
        block
        size="lg"
        icon="i-lucide-plus"
        class="justify-between rounded-xl"
        @click="openQuickAdd()"
      >
        <span class="flex-1 text-left">Quick Add</span>
        <span class="text-[11px] font-normal opacity-70 border border-white/25 rounded px-1.5 py-0.5">Ctrl N</span>
      </UButton>
    </div>

    <nav class="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
        :class="isActive(item.to)
          ? 'bg-elevated text-highlighted font-medium'
          : 'text-muted hover:text-highlighted hover:bg-elevated/60'"
      >
        <UIcon :name="item.icon" class="size-4.5 shrink-0" :class="isActive(item.to) ? 'text-primary' : ''" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="border-t border-default p-3">
      <UDropdownMenu :items="userMenuItems" :content="{ side: 'top' }" :ui="{ content: 'w-52' }">
        <button class="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevated/60 transition-colors text-left">
          <UAvatar :src="user?.avatarUrl ?? undefined" :alt="user?.name ?? 'User'" size="sm" />
          <span class="flex-1 min-w-0">
            <span class="block truncate text-sm font-medium">{{ user?.name }}</span>
            <span class="block truncate text-xs text-muted">{{ user?.email }}</span>
          </span>
          <UIcon name="i-lucide-chevrons-up-down" class="size-4 text-muted" />
        </button>
      </UDropdownMenu>
    </div>
  </aside>
</template>
