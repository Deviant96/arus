<script setup lang="ts">
import { z } from 'zod'
import { zPassword } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  password: zPassword,
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })

const form = reactive({ password: '', confirm: '' })
const loading = ref(false)
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', { method: 'POST', body: { token: token.value, password: form.password } })
    await refreshSession()
    toast.add({ title: 'Password updated', color: 'success' })
    await navigateTo('/')
  }
  catch (err: any) {
    toast.add({ title: err?.statusMessage ?? 'Reset failed', color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm" :ui="{ body: 'p-6 sm:p-7' }">
    <template v-if="token">
      <h1 class="text-lg font-semibold mb-1">Choose a new password</h1>
      <p class="text-sm text-muted mb-6">Your new password must be at least 8 characters.</p>

      <UForm :schema="schema" :state="form" class="space-y-4" @submit="submit">
        <UFormField label="New password" name="password">
          <UInput v-model="form.password" type="password" autocomplete="new-password" class="w-full" size="lg" />
        </UFormField>
        <UFormField label="Confirm password" name="confirm">
          <UInput v-model="form.confirm" type="password" autocomplete="new-password" class="w-full" size="lg" />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading">Update password</UButton>
      </UForm>
    </template>
    <template v-else>
      <div class="text-center py-4">
        <UIcon name="i-lucide-link-2-off" class="size-10 text-error mx-auto mb-3" />
        <h1 class="text-lg font-semibold mb-1">Invalid reset link</h1>
        <p class="text-sm text-muted">This link is missing its token. Request a new one.</p>
        <UButton to="/auth/forgot-password" class="mt-4" variant="soft">Request new link</UButton>
      </div>
    </template>
  </UCard>
</template>
