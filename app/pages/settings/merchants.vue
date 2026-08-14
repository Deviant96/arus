<script setup lang="ts">
import type { MerchantDto } from '#shared/types/api'

const toast = useToast()
const { activeCategories, load: loadLookups } = useLookups()
const { dayLabel } = useFormat()

const q = ref('')
const merchants = ref<MerchantDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ items: MerchantDto[] }>('/api/merchants', { params: { q: q.value || undefined, limit: 100 } })
    merchants.value = res.items
  }
  finally {
    loading.value = false
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(debounce)
  debounce = setTimeout(load, 300)
})
onMounted(() => {
  load()
  loadLookups().catch(() => {})
})

const formOpen = ref(false)
const editing = ref<MerchantDto | null>(null)
const form = reactive({ name: '', defaultCategoryId: null as string | null })
const saving = ref(false)

const catItems = computed(() => [{ label: 'None', value: null }, ...activeCategories.value.map(c => ({ label: c.name, value: c.id }))])

function openEdit(m: MerchantDto) {
  editing.value = m
  Object.assign(form, { name: m.name, defaultCategoryId: m.defaultCategoryId })
  formOpen.value = true
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', defaultCategoryId: null })
  formOpen.value = true
}

async function submit() {
  if (!form.name.trim()) return toast.add({ title: 'Name is required', color: 'error' })
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/merchants/${editing.value.id}`, { method: 'PATCH', body: form })
    }
    else {
      await $fetch('/api/merchants', { method: 'POST', body: form })
    }
    toast.add({ title: 'Merchant saved', color: 'success', icon: 'i-lucide-check' })
    formOpen.value = false
    await load()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function remove(m: MerchantDto) {
  try {
    await $fetch(`/api/merchants/${m.id}`, { method: 'DELETE' })
    toast.add({ title: `${m.name} deleted`, description: 'Transactions keep their history.', color: 'success' })
    await load()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't delete", description: err?.statusMessage, color: 'error' })
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Merchants">
      <UButton icon="i-lucide-plus" @click="openCreate">New merchant</UButton>
    </UiPageHeader>
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-4 max-w-2xl">
      <UInput v-model="q" icon="i-lucide-search" placeholder="Search merchants…" class="w-full" />

      <div v-if="loading && merchants.length === 0" class="space-y-2">
        <USkeleton v-for="i in 4" :key="i" class="h-14 rounded-xl" />
      </div>

      <UiEmptyState
        v-else-if="merchants.length === 0"
        icon="i-lucide-store"
        title="No merchants yet"
        description="Merchants are created automatically as you type them in transactions, or add them here."
      />

      <div v-else class="panel divide-y divide-default/40">
        <div v-for="m in merchants" :key="m.id" class="flex items-center gap-3 px-4 py-3">
          <span class="flex items-center justify-center size-8 rounded-lg bg-elevated text-muted">
            <UIcon name="i-lucide-store" class="size-4" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium truncate">{{ m.name }}</span>
            <span class="block text-xs text-muted">
              {{ m.transactionCount ?? 0 }} transaction{{ (m.transactionCount ?? 0) === 1 ? '' : 's' }}
              <template v-if="m.lastUsedAt"> · last {{ dayLabel(m.lastUsedAt.slice(0, 10)) }}</template>
            </span>
          </span>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edit" @click="openEdit(m)" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" aria-label="Delete" @click="remove(m)" />
        </div>
      </div>
    </div>

    <UModal v-model:open="formOpen" :title="editing ? 'Edit merchant' : 'New merchant'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" class="w-full" size="lg" />
          </UFormField>
          <UFormField label="Default category" help="Preselected when you pick this merchant">
            <USelectMenu v-model="form.defaultCategoryId" :items="catItems" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="formOpen = false">Cancel</UButton>
            <UButton :loading="saving" @click="submit">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
