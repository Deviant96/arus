<script setup lang="ts">
import type { PaymentMethodDto } from '#shared/types/api'
import { PAYMENT_METHOD_TYPE_META } from '../../composables/useLookups'

const { paymentMethods, reload } = useLookups()
const toast = useToast()

await useAsyncData('settings-pms', async () => { await reload().catch(() => {}); return true }, { server: false, lazy: true })

const activeList = computed(() => paymentMethods.value.filter(p => p.active))
const archivedList = computed(() => paymentMethods.value.filter(p => !p.active))

const formOpen = ref(false)
const editing = ref<PaymentMethodDto | null>(null)
const form = reactive({ name: '', type: 'bank' as string, currency: 'IDR' })
const saving = ref(false)

const typeItems = Object.entries(PAYMENT_METHOD_TYPE_META).map(([value, meta]) => ({ label: meta.label, value, icon: meta.icon }))

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', type: 'bank', currency: 'IDR' })
  formOpen.value = true
}

function openEdit(p: PaymentMethodDto) {
  editing.value = p
  Object.assign(form, { name: p.name, type: p.type, currency: p.currency })
  formOpen.value = true
}

async function submit() {
  if (!form.name.trim()) return toast.add({ title: 'Name is required', color: 'error' })
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/payment-methods/${editing.value.id}`, { method: 'PATCH', body: form })
    }
    else {
      await $fetch('/api/payment-methods', { method: 'POST', body: form })
    }
    toast.add({ title: editing.value ? 'Payment method updated' : 'Payment method created', color: 'success', icon: 'i-lucide-check' })
    formOpen.value = false
    await reload()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function setActive(p: PaymentMethodDto, active: boolean) {
  await $fetch(`/api/payment-methods/${p.id}`, { method: 'PATCH', body: { active } })
  await reload()
  toast.add({ title: active ? `${p.name} restored` : `${p.name} archived`, color: 'success' })
}

async function remove(p: PaymentMethodDto) {
  try {
    const res = await $fetch<{ archived: boolean, deleted: boolean, message?: string }>(`/api/payment-methods/${p.id}`, { method: 'DELETE' })
    toast.add({ title: res.deleted ? 'Deleted' : 'Archived instead', description: res.message, color: res.deleted ? 'success' : 'warning' })
    await reload()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't delete", description: err?.statusMessage, color: 'error' })
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Payment Methods">
      <UButton icon="i-lucide-plus" @click="openCreate">New payment method</UButton>
    </UiPageHeader>
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6 max-w-2xl">
      <div class="panel divide-y divide-default/40">
        <div v-for="p in activeList" :key="p.id" class="flex items-center gap-3 px-4 py-3">
          <span class="flex items-center justify-center size-8 rounded-lg bg-elevated text-muted">
            <UIcon :name="PAYMENT_METHOD_TYPE_META[p.type]?.icon ?? 'i-lucide-wallet'" class="size-4" />
          </span>
          <span class="flex-1">
            <span class="block text-sm font-medium">{{ p.name }}</span>
            <span class="block text-xs text-muted">{{ PAYMENT_METHOD_TYPE_META[p.type]?.label }} · {{ p.currency }}</span>
          </span>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edit" @click="openEdit(p)" />
          <UDropdownMenu :items="[[
            { label: 'Archive', icon: 'i-lucide-archive', onSelect: () => setActive(p, false) },
            { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(p) },
          ]]">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="More" />
          </UDropdownMenu>
        </div>
      </div>

      <section v-if="archivedList.length">
        <h2 class="text-sm font-semibold mb-2 px-1 text-muted">Archived</h2>
        <div class="panel divide-y divide-default/40 opacity-70">
          <div v-for="p in archivedList" :key="p.id" class="flex items-center gap-3 px-4 py-3">
            <span class="flex items-center justify-center size-8 rounded-lg bg-elevated text-muted">
              <UIcon :name="PAYMENT_METHOD_TYPE_META[p.type]?.icon ?? 'i-lucide-wallet'" class="size-4" />
            </span>
            <span class="flex-1 text-sm">{{ p.name }}</span>
            <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-rotate-ccw" @click="setActive(p, true)">Restore</UButton>
          </div>
        </div>
      </section>
    </div>

    <UModal v-model:open="formOpen" :title="editing ? 'Edit payment method' : 'New payment method'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" placeholder="e.g. BCA, GoPay, ShopeePay" class="w-full" size="lg" />
          </UFormField>
          <UFormField label="Type">
            <USelectMenu v-model="form.type" :items="typeItems" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="formOpen = false">Cancel</UButton>
            <UButton :loading="saving" @click="submit">{{ editing ? 'Save' : 'Create' }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
