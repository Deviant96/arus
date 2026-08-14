<script setup lang="ts">
import type { AISettingsDto } from '#shared/types/api'
import { DEFAULT_AI_MODELS, type AIProviderName } from '#shared/schemas/ai'

const toast = useToast()

const { data: settings, refresh } = await useAsyncData('ai-settings', () => $fetch<AISettingsDto>('/api/ai/settings'), { server: false, lazy: true })

const form = reactive({
  provider: 'openai' as AIProviderName,
  apiKey: '',
  model: DEFAULT_AI_MODELS.openai[0]!,
})
const saving = ref(false)
const deleting = ref(false)

watch(() => form.provider, (p) => {
  form.model = DEFAULT_AI_MODELS[p][0]!
})

watch(settings, (s) => {
  if (s?.configured && s.provider) {
    form.provider = s.provider
    form.model = s.model ?? DEFAULT_AI_MODELS[s.provider][0]!
  }
}, { immediate: true })

const modelItems = computed(() => DEFAULT_AI_MODELS[form.provider].map(m => ({ label: m, value: m })))

async function save() {
  if (!form.apiKey.trim()) return toast.add({ title: 'Enter your API key', color: 'error' })
  saving.value = true
  try {
    await $fetch('/api/ai/settings', { method: 'POST', body: form })
    form.apiKey = ''
    await refresh()
    toast.add({ title: 'AI provider saved', description: 'Your key is encrypted and never sent to the browser again.', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function removeKey() {
  deleting.value = true
  try {
    await $fetch('/api/ai/settings', { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'AI configuration removed', color: 'success' })
  }
  finally {
    deleting.value = false
  }
}

function onCreateModel(item: string) {
  form.model = item
}
</script>

<template>
  <div>
    <UiPageHeader title="AI" subtitle="Optional — Arus works fully without it" />
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-4 max-w-2xl">
      <UAlert
        v-if="settings?.configured"
        color="success"
        variant="subtle"
        icon="i-lucide-shield-check"
        :title="`Connected: ${settings.provider === 'openai' ? 'OpenAI' : 'Gemini'} · ${settings.model}`"
        :description="`Stored key: ${settings.keyMasked}. It is encrypted at rest and only decrypted server-side per request.`"
      >
        <template #actions>
          <UButton color="error" variant="soft" size="xs" :loading="deleting" @click="removeKey">Remove key</UButton>
        </template>
      </UAlert>

      <section class="panel p-5 space-y-4">
        <h2 class="text-sm font-semibold">{{ settings?.configured ? 'Replace configuration' : 'Connect a provider' }}</h2>

        <UFormField label="AI Provider">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in (['openai', 'gemini'] as const)"
              :key="p"
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors"
              :class="form.provider === p ? 'border-primary/60 bg-primary/10 text-primary' : 'border-default text-muted hover:bg-elevated'"
              @click="form.provider = p"
            >
              <UIcon :name="p === 'openai' ? 'i-simple-icons-openai' : 'i-simple-icons-googlegemini'" class="size-4" />
              {{ p === 'openai' ? 'OpenAI' : 'Gemini' }}
            </button>
          </div>
        </UFormField>

        <UFormField label="API Key" :help="`Get one from ${form.provider === 'openai' ? 'platform.openai.com' : 'aistudio.google.com'}`">
          <UInput v-model="form.apiKey" type="password" placeholder="sk-… / AIza…" class="w-full" autocomplete="off" />
        </UFormField>

        <UFormField label="Model">
          <USelectMenu v-model="form.model" :items="modelItems" value-key="value" class="w-full" :create-item="true" @create="onCreateModel" />
        </UFormField>

        <div class="flex justify-end">
          <UButton :loading="saving" icon="i-lucide-check" @click="save">Save & encrypt</UButton>
        </div>
      </section>

      <section class="panel p-5">
        <h2 class="text-sm font-semibold mb-2">How your key is protected</h2>
        <ul class="text-xs text-muted space-y-1.5 list-disc pl-4">
          <li>Encrypted with AES-256-GCM before it touches the database.</li>
          <li>Never returned by any API — the UI only ever sees the masked suffix.</li>
          <li>Never logged; decrypted in memory only while calling the provider.</li>
          <li>Analysis requests send pre-aggregated summaries, not raw transactions.</li>
          <li>You can delete or replace the key at any time.</li>
        </ul>
      </section>
    </div>
  </div>
</template>
