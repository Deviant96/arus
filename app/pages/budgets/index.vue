<script setup lang="ts">
import type { BudgetDto } from '#shared/types/api'
import { formatMonthString, pad2, todayInTz } from '#shared/utils/dates'

const api = useApi()
const toast = useToast()
const { money, timezone } = useFormat()
const { activeCategories } = useLookups()
const { version } = useQuickAdd()

const month = ref(todayInTz(timezone.value).slice(0, 7))
const monthLabel = computed(() => formatMonthString(month.value))

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  month.value = `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

const { data, refresh, status } = await useAsyncData('budgets', async () => {
  const res = await api.cachedGet<{ month: string, items: BudgetDto[] }>(`budgets:${month.value}`, '/api/budgets', { month: month.value })
  return res.data.items
}, { server: false, lazy: true, default: () => [], watch: [month] })

watch(version, () => refresh())

const totalBudget = computed(() => (data.value ?? []).reduce((s, b) => s + b.amountMinor, 0))
const totalSpent = computed(() => (data.value ?? []).reduce((s, b) => s + b.spentMinor, 0))

// ---- Create / edit ----
const formOpen = ref(false)
const editing = ref<BudgetDto | null>(null)
const form = reactive({
  categoryId: null as string | null,
  amountMinor: null as number | null,
  thisMonthOnly: false,
})
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { categoryId: null, amountMinor: null, thisMonthOnly: false })
  formOpen.value = true
}

function openEdit(b: BudgetDto) {
  editing.value = b
  Object.assign(form, { categoryId: b.categoryId, amountMinor: b.amountMinor, thisMonthOnly: !!b.month })
  formOpen.value = true
}

async function submit() {
  if (!form.amountMinor || (!editing.value && !form.categoryId)) {
    toast.add({ title: 'Category and amount are required', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/budgets/${editing.value.id}`, {
        method: 'PATCH',
        body: { amountMinor: form.amountMinor, month: form.thisMonthOnly ? month.value : null },
      })
    }
    else {
      await $fetch('/api/budgets', {
        method: 'POST',
        body: { categoryId: form.categoryId, amountMinor: form.amountMinor, month: form.thisMonthOnly ? month.value : null },
      })
    }
    toast.add({ title: editing.value ? 'Budget updated' : 'Budget created', color: 'success', icon: 'i-lucide-check' })
    formOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save the budget", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function removeBudget(b: BudgetDto) {
  try {
    await $fetch(`/api/budgets/${b.id}`, { method: 'DELETE' })
    toast.add({ title: 'Budget removed', color: 'success' })
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't delete", description: err?.statusMessage, color: 'error' })
  }
}

const usedCategoryIds = computed(() => new Set((data.value ?? []).map(b => b.categoryId)))
const categoryItems = computed(() =>
  activeCategories.value
    .filter(c => editing.value || !usedCategoryIds.value.has(c.id))
    .map(c => ({ label: c.name, value: c.id })),
)
</script>

<template>
  <div>
    <UiPageHeader title="Budgets" subtitle="Optional monthly limits per category">
      <UButton icon="i-lucide-plus" @click="openCreate">New budget</UButton>
    </UiPageHeader>

    <div class="px-4 sm:px-6 lg:px-8 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="sm" aria-label="Previous month" @click="shiftMonth(-1)" />
          <span class="text-sm font-semibold w-36 text-center">{{ monthLabel }}</span>
          <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="sm" aria-label="Next month" @click="shiftMonth(1)" />
        </div>
        <p v-if="totalBudget > 0" class="text-xs text-muted tnum">
          {{ money(totalSpent) }} of {{ money(totalBudget) }} budgeted
        </p>
      </div>

      <div v-if="status === 'pending' && !data?.length" class="space-y-3">
        <USkeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
      </div>

      <UiEmptyState
        v-else-if="(data ?? []).length === 0"
        icon="i-lucide-target"
        title="No budgets for this month"
        description="Budgets are optional. Set a monthly limit for a category and Arus tracks actual spending against it — transfers never count."
      >
        <UButton icon="i-lucide-plus" @click="openCreate">New budget</UButton>
      </UiEmptyState>

      <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <div v-for="b in data" :key="b.id" class="panel px-5 py-4 group relative">
          <BudgetProgress :budget="b" />
          <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edit budget" @click="openEdit(b)" />
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" aria-label="Delete budget" @click="removeBudget(b)" />
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="formOpen" :title="editing ? `Edit budget — ${editing.category?.name}` : 'New budget'">
      <template #body>
        <div class="space-y-4">
          <UFormField v-if="!editing" label="Category">
            <USelectMenu
              v-model="form.categoryId"
              :items="categoryItems"
              value-key="value"
              placeholder="Pick a category"
              class="w-full"
              size="lg"
              :search-input="{ placeholder: 'Search…' }"
            />
          </UFormField>
          <UFormField label="Monthly amount">
            <TransactionAmountInput v-model="form.amountMinor" size="lg" autofocus />
          </UFormField>
          <USwitch v-model="form.thisMonthOnly" :label="`Apply to ${monthLabel} only`" size="sm" />
          <p class="text-xs text-muted">
            {{ form.thisMonthOnly ? 'A one-month override — other months keep the regular budget if any.' : 'Applies to every month until you change it.' }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="formOpen = false">Cancel</UButton>
            <UButton :loading="saving" icon="i-lucide-check" @click="submit">{{ editing ? 'Save' : 'Create' }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
