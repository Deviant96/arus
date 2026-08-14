<script setup lang="ts">
import { registerSchema, type RegisterInput } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })

const toast = useToast()
const { fetch: refreshSession } = useUserSession()
const { load: loadUser } = useSessionUser()

const form = reactive<RegisterInput>({ name: '', email: '', password: '' })
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: form })
    await refreshSession()
    await loadUser(true)
    await navigateTo('/')
  }
  catch (err: any) {
    toast.add({ title: err?.statusMessage ?? err?.data?.statusMessage ?? 'Registration failed', color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm" :ui="{ body: 'p-6 sm:p-7' }">
    <h1 class="text-lg font-semibold mb-1">Create your account</h1>
    <p class="text-sm text-muted mb-6">Free, fast and private — your data stays yours.</p>

    <UForm :schema="registerSchema" :state="form" class="space-y-4" @submit="submit">
      <UFormField label="Name" name="name">
        <UInput v-model="form.name" autocomplete="name" placeholder="Your name" class="w-full" size="lg" />
      </UFormField>
      <UFormField label="Email" name="email">
        <UInput v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" class="w-full" size="lg" />
      </UFormField>
      <UFormField label="Password" name="password" help="At least 8 characters">
        <UInput v-model="form.password" type="password" autocomplete="new-password" placeholder="••••••••" class="w-full" size="lg" />
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">Create account</UButton>
    </UForm>

    <USeparator label="or" class="my-5" />

    <UButton to="/api/auth/google" external block size="lg" color="neutral" variant="outline" icon="i-simple-icons-google">
      Continue with Google
    </UButton>

    <p class="mt-6 text-sm text-center text-muted">
      Already have an account?
      <NuxtLink to="/auth/login" class="text-primary font-medium">Sign in</NuxtLink>
    </p>
  </UCard>
</template>
