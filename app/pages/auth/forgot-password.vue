<script setup lang="ts">
import { forgotPasswordSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })

const form = reactive({ email: '' })
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: form })
    sent.value = true
  }
  catch {
    sent.value = true // same response either way — never reveal account existence
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm" :ui="{ body: 'p-6 sm:p-7' }">
    <template v-if="!sent">
      <h1 class="text-lg font-semibold mb-1">Reset your password</h1>
      <p class="text-sm text-muted mb-6">We'll send a reset link to your email if an account exists.</p>

      <UForm :schema="forgotPasswordSchema" :state="form" class="space-y-4" @submit="submit">
        <UFormField label="Email" name="email">
          <UInput v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" class="w-full" size="lg" />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading">Send reset link</UButton>
      </UForm>
    </template>

    <template v-else>
      <div class="text-center py-4">
        <UIcon name="i-lucide-mail-check" class="size-10 text-primary mx-auto mb-3" />
        <h1 class="text-lg font-semibold mb-1">Check your inbox</h1>
        <p class="text-sm text-muted">If an account exists for {{ form.email }}, a reset link is on its way.</p>
      </div>
    </template>

    <p class="mt-6 text-sm text-center">
      <NuxtLink to="/auth/login" class="text-primary font-medium">Back to sign in</NuxtLink>
    </p>
  </UCard>
</template>
