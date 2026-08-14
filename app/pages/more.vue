<script setup lang="ts">
const { user, logout } = useSessionUser()

const links = [
  { label: 'Installments', description: 'Schedules & payment history', to: '/installments', icon: 'i-lucide-calendar-clock' },
  { label: 'Recurring', description: 'Subscriptions & regular bills', to: '/recurring', icon: 'i-lucide-repeat' },
  { label: 'Budgets', description: 'Monthly category limits', to: '/budgets', icon: 'i-lucide-target' },
  { label: 'Insights', description: 'What changed and why', to: '/insights', icon: 'i-lucide-lightbulb' },
  { label: 'Settings', description: 'Profile, categories, data & AI', to: '/settings', icon: 'i-lucide-settings' },
]
</script>

<template>
  <div>
    <UiPageHeader title="More" />
    <div class="px-4 sm:px-6 lg:px-8 space-y-4 max-w-xl">
      <div class="panel px-4 py-3.5 flex items-center gap-3">
        <UAvatar :src="user?.avatarUrl ?? undefined" :alt="user?.name ?? 'User'" size="md" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ user?.name }}</p>
          <p class="text-xs text-muted truncate">{{ user?.email }}</p>
        </div>
      </div>

      <div class="panel divide-y divide-default/50">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-4 py-3.5 hover:bg-elevated/60 transition-colors"
        >
          <UIcon :name="link.icon" class="size-5 text-muted" />
          <span class="flex-1">
            <span class="block text-sm font-medium">{{ link.label }}</span>
            <span class="block text-xs text-muted">{{ link.description }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
        </NuxtLink>
      </div>

      <UButton block variant="soft" color="error" icon="i-lucide-log-out" @click="logout">
        Sign out
      </UButton>
    </div>
  </div>
</template>
