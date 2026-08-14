<script setup lang="ts">
import { SUPPORTED_CURRENCIES } from '#shared/utils/money'

const { user, load } = useSessionUser()
const { activeCategories, activePaymentMethods, load: loadLookups } = useLookups()
const toast = useToast()

await useAsyncData('settings-lookups', async () => { await loadLookups().catch(() => {}); return true }, { server: false, lazy: true })

const profile = reactive({ name: '', preferredCurrency: 'IDR', timezone: 'Asia/Jakarta', defaultPaymentMethodId: null as string | null, defaultCategoryId: null as string | null })
const savingProfile = ref(false)

watch(user, (u) => {
  if (u) {
    profile.name = u.name
    profile.preferredCurrency = u.preferredCurrency
    profile.timezone = u.timezone
    profile.defaultPaymentMethodId = u.defaultPaymentMethodId
    profile.defaultCategoryId = u.defaultCategoryId
  }
}, { immediate: true })

async function saveProfile() {
  savingProfile.value = true
  try {
    await $fetch('/api/me', { method: 'PATCH', body: profile })
    await load(true)
    toast.add({ title: 'Settings saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage, color: 'error' })
  }
  finally {
    savingProfile.value = false
  }
}

const pwd = reactive({ currentPassword: '', newPassword: '', confirm: '' })
const savingPwd = ref(false)

async function changePassword() {
  if (pwd.newPassword.length < 8) return toast.add({ title: 'New password must be at least 8 characters', color: 'error' })
  if (pwd.newPassword !== pwd.confirm) return toast.add({ title: 'Passwords do not match', color: 'error' })
  savingPwd.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: pwd.currentPassword || undefined, newPassword: pwd.newPassword },
    })
    Object.assign(pwd, { currentPassword: '', newPassword: '', confirm: '' })
    toast.add({ title: 'Password updated', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err: any) {
    toast.add({ title: "Couldn't change password", description: err?.statusMessage, color: 'error' })
  }
  finally {
    savingPwd.value = false
  }
}

const currencyItems = SUPPORTED_CURRENCIES.map(c => ({ label: c, value: c }))
const tzItems = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'UTC'].map(t => ({ label: t, value: t }))
const pmItems = computed(() => [{ label: 'None', value: null }, ...activePaymentMethods.value.map(p => ({ label: p.name, value: p.id }))])
const catItems = computed(() => [{ label: 'None', value: null }, ...activeCategories.value.map(c => ({ label: c.name, value: c.id }))])
</script>

<template>
  <div>
    <UiPageHeader title="Settings" />
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6 max-w-2xl">
      <section class="panel p-5 space-y-4">
        <div class="flex items-center gap-3">
          <UAvatar :src="user?.avatarUrl ?? undefined" :alt="user?.name ?? 'User'" size="lg" />
          <div>
            <h2 class="text-sm font-semibold">Profile & preferences</h2>
            <p class="text-xs text-muted">{{ user?.email }} · {{ user?.hasGoogle ? 'Google linked' : 'Email account' }}</p>
          </div>
        </div>

        <UFormField label="Name">
          <UInput v-model="profile.name" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Currency" help="Used for reports & budgets">
            <USelectMenu v-model="profile.preferredCurrency" :items="currencyItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="Timezone">
            <USelectMenu v-model="profile.timezone" :items="tzItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="Default payment method" help="Preselected in Quick Add">
            <USelectMenu v-model="profile.defaultPaymentMethodId" :items="pmItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="Default category">
            <USelectMenu v-model="profile.defaultCategoryId" :items="catItems" value-key="value" class="w-full" />
          </UFormField>
        </div>
        <div class="flex justify-end">
          <UButton :loading="savingProfile" icon="i-lucide-check" @click="saveProfile">Save</UButton>
        </div>
      </section>

      <section class="panel p-5 space-y-4">
        <h2 class="text-sm font-semibold">{{ user?.hasPassword ? 'Change password' : 'Set a password' }}</h2>
        <p v-if="!user?.hasPassword" class="text-xs text-muted -mt-2">
          You signed up with Google. Setting a password also enables email sign-in.
        </p>
        <UFormField v-if="user?.hasPassword" label="Current password">
          <UInput v-model="pwd.currentPassword" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="New password">
            <UInput v-model="pwd.newPassword" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
          <UFormField label="Confirm">
            <UInput v-model="pwd.confirm" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
        </div>
        <div class="flex justify-end">
          <UButton :loading="savingPwd" variant="soft" @click="changePassword">Update password</UButton>
        </div>
      </section>
    </div>
  </div>
</template>
