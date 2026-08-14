<script setup lang="ts">
import type { CategoryDto } from '#shared/types/api'

const { categories, reload } = useLookups()
const toast = useToast()

await useAsyncData('settings-cats', async () => { await reload().catch(() => {}); return true }, { server: false, lazy: true })

const activeList = computed(() => categories.value.filter(c => c.active))
const archivedList = computed(() => categories.value.filter(c => !c.active))

const formOpen = ref(false)
const editing = ref<CategoryDto | null>(null)
const form = reactive({ name: '', icon: 'i-lucide-tag', color: '#64748b' })
const saving = ref(false)

const ICONS = [
  'i-lucide-utensils', 'i-lucide-coffee', 'i-lucide-car', 'i-lucide-bus', 'i-lucide-fuel', 'i-lucide-shopping-bag',
  'i-lucide-shopping-cart', 'i-lucide-receipt', 'i-lucide-zap', 'i-lucide-wifi', 'i-lucide-clapperboard', 'i-lucide-gamepad-2',
  'i-lucide-heart-pulse', 'i-lucide-pill', 'i-lucide-graduation-cap', 'i-lucide-book-open', 'i-lucide-users', 'i-lucide-baby',
  'i-lucide-repeat', 'i-lucide-banknote', 'i-lucide-gift', 'i-lucide-plane', 'i-lucide-home', 'i-lucide-shirt',
  'i-lucide-smartphone', 'i-lucide-dumbbell', 'i-lucide-paw-print', 'i-lucide-circle-ellipsis', 'i-lucide-tag',
]
const COLORS = ['#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#64748b', '#84cc16']

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', icon: 'i-lucide-tag', color: '#64748b' })
  formOpen.value = true
}

function openEdit(c: CategoryDto) {
  editing.value = c
  Object.assign(form, { name: c.name, icon: c.icon ?? 'i-lucide-tag', color: c.color ?? '#64748b' })
  formOpen.value = true
}

async function submit() {
  if (!form.name.trim()) return toast.add({ title: 'Name is required', color: 'error' })
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/categories/${editing.value.id}`, { method: 'PATCH', body: form })
    }
    else {
      await $fetch('/api/categories', { method: 'POST', body: form })
    }
    toast.add({ title: editing.value ? 'Category updated' : 'Category created', color: 'success', icon: 'i-lucide-check' })
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

async function setActive(c: CategoryDto, active: boolean) {
  await $fetch(`/api/categories/${c.id}`, { method: 'PATCH', body: { active } })
  await reload()
  toast.add({ title: active ? `${c.name} restored` : `${c.name} archived`, description: active ? undefined : 'Historical transactions keep this category.', color: 'success' })
}

async function remove(c: CategoryDto) {
  try {
    const res = await $fetch<{ archived: boolean, deleted: boolean, message?: string }>(`/api/categories/${c.id}`, { method: 'DELETE' })
    toast.add({ title: res.deleted ? 'Category deleted' : 'Category archived instead', description: res.message, color: res.deleted ? 'success' : 'warning' })
    await reload()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't delete", description: err?.statusMessage, color: 'error' })
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Categories">
      <UButton icon="i-lucide-plus" @click="openCreate">New category</UButton>
    </UiPageHeader>
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6 max-w-2xl">
      <div class="panel divide-y divide-default/40">
        <div v-for="c in activeList" :key="c.id" class="flex items-center gap-3 px-4 py-3">
          <UiCategoryBadge :category="{ id: c.id, name: c.name, icon: c.icon, color: c.color }" size="sm" />
          <span class="flex-1 text-sm font-medium">{{ c.name }}</span>
          <UBadge v-if="c.isSystem" color="neutral" variant="subtle" size="sm">default</UBadge>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edit" @click="openEdit(c)" />
          <UDropdownMenu :items="[[
            { label: 'Archive', icon: 'i-lucide-archive', onSelect: () => setActive(c, false) },
            { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(c) },
          ]]">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="More" />
          </UDropdownMenu>
        </div>
      </div>

      <section v-if="archivedList.length">
        <h2 class="text-sm font-semibold mb-2 px-1 text-muted">Archived</h2>
        <div class="panel divide-y divide-default/40 opacity-70">
          <div v-for="c in archivedList" :key="c.id" class="flex items-center gap-3 px-4 py-3">
            <UiCategoryBadge :category="{ id: c.id, name: c.name, icon: c.icon, color: c.color }" size="sm" />
            <span class="flex-1 text-sm">{{ c.name }}</span>
            <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-rotate-ccw" @click="setActive(c, true)">Restore</UButton>
          </div>
        </div>
        <p class="text-xs text-dimmed mt-2 px-1">Archived categories stay attached to historical transactions — nothing is lost.</p>
      </section>
    </div>

    <UModal v-model:open="formOpen" :title="editing ? 'Edit category' : 'New category'">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" class="w-full" size="lg" />
          </UFormField>
          <UFormField label="Icon">
            <div class="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1">
              <button
                v-for="icon in ICONS"
                :key="icon"
                type="button"
                class="flex items-center justify-center size-9 rounded-lg border transition-colors"
                :class="form.icon === icon ? 'border-primary bg-primary/15 text-primary' : 'border-default text-muted hover:bg-elevated'"
                @click="form.icon = icon"
              >
                <UIcon :name="icon" class="size-4" />
              </button>
            </div>
          </UFormField>
          <UFormField label="Color">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in COLORS"
                :key="color"
                type="button"
                class="size-7 rounded-full border-2 transition-transform hover:scale-110"
                :style="{ backgroundColor: color, borderColor: form.color === color ? 'white' : 'transparent' }"
                :aria-label="color"
                @click="form.color = color"
              />
            </div>
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
