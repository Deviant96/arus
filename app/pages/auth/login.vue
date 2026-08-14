<script setup lang="ts">
import { loginSchema, type LoginInput } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })

const route = useRoute()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()
const { load: loadUser } = useSessionUser()

const form = reactive<LoginInput>({ email: '', password: '' })
const loading = ref(false)

const oauthError = computed(() => {
  if (route.query.error === 'google_failed') return 'Google sign-in failed. Please try again.'
  if (route.query.error === 'google_no_email') return 'Google did not provide an email address for this account.'
  return null
})

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    await refreshSession()
    await loadUser(true)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  }
  catch (err: any) {
    toast.add({ title: err?.statusMessage ?? err?.data?.statusMessage ?? 'Sign in failed', color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm" :ui="{ body: 'p-6 sm:p-7' }">
    <h1 class="text-lg font-semibold mb-1">Welcome back</h1>
    <p class="text-sm text-muted mb-6">Sign in to continue tracking your spending.</p>

    <UAlert v-if="oauthError" color="error" variant="subtle" :title="oauthError" class="mb-4" />

    <UForm :schema="loginSchema" :state="form" class="space-y-4" @submit="submit">
      <UFormField label="Email" name="email">
        <UInput v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" class="w-full" size="lg" />
      </UFormField>
      <UFormField label="Password" name="password">
        <UInput v-model="form.password" type="password" autocomplete="current-password" placeholder="••••••••" class="w-full" size="lg" />
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">Sign in</UButton>
    </UForm>

    <USeparator label="or" class="my-5" />

    <UButton
      to="/api/auth/google"
      external
      block
      size="lg"
      color="neutral"
      variant="outline"
      icon="i-simple-icons-google"
    >
      Continue with Google
    </UButton>

    <div class="flex items-center justify-between mt-6 text-sm">
      <NuxtLink to="/auth/forgot-password" class="text-muted hover:text-highlighted">Forgot password?</NuxtLink>
      <NuxtLink to="/auth/register" class="text-primary font-medium">Create account</NuxtLink>
    </div>
  </UCard>
</template>
