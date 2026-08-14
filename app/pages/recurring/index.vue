<script setup lang="ts">
import type { RecurringDto } from '#shared/types/api'

const api = useApi()
const toast = useToast()
const { money, dayLabel, today } = useFormat()
const { user } = useSessionUser()

const { data, refresh, status } = await useAsyncData('recurring', async () => {
  const res = await api.cachedGet<{ items: RecurringDto[] }>('recurring', '/api/recurring')
  return res.data.items
}, { server: false, lazy: true, default: () => [] })

const dueList = computed(() => (data.value ?? []).filter(r => r.active && (r.occurrenceStatus === 'overdue' || r.occurrenceStatus === 'due_today')))
const upcoming = computed(() => (data.value ?? []).filter(r => r.active && r.occurrenceStatus === 'upcoming'))
const inactive = computed(() => (data.value ?? []).filter(r => !r.active))

// ---- Create / edit ----
const formOpen = ref(false)
const editing = ref<RecurringDto | null>(null)
const form = reactive({
  name: '',
  type: 'expense' as 'expense' | 'income',
  amountMinor: null as number | null,
  categoryId: null as string | null,
  paymentMethodId: null as string | null,
  merchantId: null as string | null,
  merchantName: null as string | null,
  frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  startDate: today(),
  note: '',
})
const saving = ref(false)

const freqItems = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
]

function openCreate() {
  editing.value = null
  Object.assign(form, {
    name: '', type: 'expense', amountMinor: null,
    categoryId: user.value?.defaultCategoryId ?? null,
    paymentMethodId: user.value?.defaultPaymentMethodId ?? null,
    merchantId: null, merchantName: null,
    frequency: 'monthly', startDate: today(), note: '',
  })
  formOpen.value = true
}

function openEdit(rule: RecurringDto) {
  editing.value = rule
  Object.assign(form, {
    name: rule.name,
    type: rule.type,
    amountMinor: rule.amountMinor,
    categoryId: rule.categoryId,
    paymentMethodId: rule.paymentMethodId,
    merchantId: rule.merchantId,
    merchantName: rule.merchant?.name ?? null,
    frequency: rule.frequency,
    startDate: rule.nextDueDate,
    note: rule.note ?? '',
  })
  formOpen.value = true
}

async function submitForm() {
  if (!form.name.trim() || !form.amountMinor || !form.paymentMethodId) {
    toast.add({ title: 'Name, amount and payment method are required', color: 'error' })
    return
  }
  if (form.type === 'expense' && !form.categoryId) {
    toast.add({ title: 'Pick a category for a recurring expense', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/recurring/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          amountMinor: form.amountMinor,
          categoryId: form.categoryId,
          paymentMethodId: form.paymentMethodId,
          merchantId: form.merchantId,
          frequency: form.frequency,
          nextDueDate: form.startDate,
          note: form.note.trim() || null,
        },
      })
    }
    else {
      await $fetch('/api/recurring', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          type: form.type,
          amountMinor: form.amountMinor,
          currency: user.value?.preferredCurrency ?? 'IDR',
          categoryId: form.categoryId,
          paymentMethodId: form.paymentMethodId,
          merchantId: form.merchantId,
          frequency: form.frequency,
          startDate: form.startDate,
          note: form.note.trim() || null,
        },
      })
    }
    toast.add({ title: editing.value ? 'Recurring updated' : 'Recurring created', color: 'success', icon: 'i-lucide-check' })
    formOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// ---- Confirm occurrence ----
const confirmOpen = ref(false)
const confirming = ref<RecurringDto | null>(null)
const confirmForm = reactive({ amountMinor: null as number | null, date: today(), paymentMethodId: null as string | null, note: '' })

function openConfirm(rule: RecurringDto) {
  confirming.value = rule
  confirmForm.amountMinor = rule.amountMinor
  confirmForm.date = today()
  confirmForm.paymentMethodId = rule.paymentMethodId
  confirmForm.note = ''
  confirmOpen.value = true
}

async function submitConfirm() {
  if (!confirming.value || !confirmForm.amountMinor) return
  saving.value = true
  try {
    const { queued } = await api.mutate('POST', `/api/recurring/${confirming.value.id}/confirm`, {
      transactionId: crypto.randomUUID(),
      dueDate: confirming.value.nextDueDate,
      amountMinor: confirmForm.amountMinor,
      date: confirmForm.date,
      paymentMethodId: confirmForm.paymentMethodId,
      note: confirmForm.note.trim() || null,
    }, { kind: 'recurring.confirm', description: `Confirm ${confirming.value.name}` })
    toast.add({
      title: queued ? 'Saved on this device' : `${confirming.value.name} recorded`,
      color: queued ? 'warning' : 'success',
      icon: queued ? 'i-lucide-cloud-off' : 'i-lucide-check',
    })
    confirmOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't record it", description: err?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function skip(rule: RecurringDto) {
  try {
    await $fetch(`/api/recurring/${rule.id}/skip`, { method: 'POST', body: { dueDate: rule.nextDueDate } })
    toast.add({ title: `Skipped — next: ${rule.name}`, color: 'neutral' })
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't skip", description: err?.statusMessage, color: 'error' })
  }
}

async function toggleActive(rule: RecurringDto) {
  await $fetch(`/api/recurring/${rule.id}`, { method: 'PATCH', body: { active: !rule.active } })
  await refresh()
}

async function removeRule(rule: RecurringDto) {
  await $fetch(`/api/recurring/${rule.id}`, { method: 'DELETE' })
  toast.add({ title: 'Recurring deleted', description: 'Past confirmed transactions are kept.', color: 'success' })
  await refresh()
}

const freqLabel: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }

function ruleMenu(rule: RecurringDto) {
  return [[
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(rule) },
    { label: rule.active ? 'Pause' : 'Resume', icon: rule.active ? 'i-lucide-pause' : 'i-lucide-play', onSelect: () => toggleActive(rule) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => removeRule(rule) },
  ]]
}
</script>

<template>
  <div>
    <UiPageHeader title="Recurring" subtitle="Expected patterns — confirmed only when they really happen">
      <UButton icon="i-lucide-plus" @click="openCreate">New recurring</UButton>
    </UiPageHeader>

    <div class="px-4 sm:px-6 lg:px-8 space-y-6">
      <div v-if="status === 'pending' && !data?.length" class="space-y-3">
        <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-2xl" />
      </div>

      <UiEmptyState
        v-else-if="(data ?? []).length === 0"
        icon="i-lucide-repeat"
        title="No recurring transactions"
        description="Track things like Netflix, rent, internet or salary. Arus asks you to confirm each occurrence — nothing is assumed paid automatically."
      >
        <UButton icon="i-lucide-plus" @click="openCreate">New recurring</UButton>
      </UiEmptyState>

      <template v-else>
        <!-- Needs attention -->
        <section v-if="dueList.length">
          <h2 class="text-sm font-semibold mb-2 px-1 flex items-center gap-2">
            Waiting for confirmation
            <UBadge color="warning" variant="subtle" size="sm">{{ dueList.length }}</UBadge>
          </h2>
          <div class="space-y-2">
            <div v-for="rule in dueList" :key="rule.id" class="panel px-4 py-3 flex flex-wrap items-center gap-3">
              <UiCategoryBadge :category="rule.category" :fallback-icon="rule.type === 'income' ? 'i-lucide-banknote' : 'i-lucide-repeat'" />
              <div class="flex-1 min-w-40">
                <p class="text-sm font-medium">{{ rule.name }}</p>
                <p class="text-xs mt-0.5" :class="rule.occurrenceStatus === 'overdue' ? 'text-error' : 'text-warning'">
                  {{ rule.occurrenceStatus === 'overdue' ? `Was expected ${dayLabel(rule.nextDueDate)}` : 'Expected today' }}
                  · {{ freqLabel[rule.frequency] }}
                </p>
              </div>
              <span class="text-sm font-semibold tnum">{{ money(rule.amountMinor, rule.currency) }}</span>
              <div class="flex gap-1.5">
                <UButton size="sm" icon="i-lucide-check" @click="openConfirm(rule)">Confirm</UButton>
                <UButton size="sm" variant="soft" color="neutral" @click="skip(rule)">Skip</UButton>
                <UDropdownMenu :items="ruleMenu(rule)">
                  <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="Actions" />
                </UDropdownMenu>
              </div>
            </div>
          </div>
        </section>

        <!-- Upcoming -->
        <section v-if="upcoming.length">
          <h2 class="text-sm font-semibold mb-2 px-1">Upcoming</h2>
          <div class="panel divide-y divide-default/40">
            <div v-for="rule in upcoming" :key="rule.id" class="flex items-center gap-3 px-4 py-3">
              <UiCategoryBadge :category="rule.category" size="sm" :fallback-icon="rule.type === 'income' ? 'i-lucide-banknote' : 'i-lucide-repeat'" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ rule.name }}</p>
                <p class="text-xs text-muted mt-0.5">
                  {{ freqLabel[rule.frequency] }} · next {{ dayLabel(rule.nextDueDate) }} · {{ rule.paymentMethod?.name }}
                  <template v-if="rule.confirmedCount"> · {{ rule.confirmedCount }} recorded</template>
                </p>
              </div>
              <span class="text-sm font-semibold tnum" :class="rule.type === 'income' ? 'text-success' : ''">
                {{ rule.type === 'income' ? '+' : '' }}{{ money(rule.amountMinor, rule.currency) }}
              </span>
              <UDropdownMenu :items="ruleMenu(rule)">
                <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="Actions" />
              </UDropdownMenu>
            </div>
          </div>
        </section>

        <!-- Paused -->
        <section v-if="inactive.length">
          <h2 class="text-sm font-semibold mb-2 px-1 text-muted">Paused</h2>
          <div class="panel divide-y divide-default/40 opacity-60">
            <div v-for="rule in inactive" :key="rule.id" class="flex items-center gap-3 px-4 py-3">
              <UiCategoryBadge :category="rule.category" size="sm" fallback-icon="i-lucide-repeat" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ rule.name }}</p>
                <p class="text-xs text-muted">{{ freqLabel[rule.frequency] }}</p>
              </div>
              <span class="text-sm tnum text-muted">{{ money(rule.amountMinor, rule.currency) }}</span>
              <UDropdownMenu :items="ruleMenu(rule)">
                <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="Actions" />
              </UDropdownMenu>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- Create / edit modal -->
    <UModal v-model:open="formOpen" :title="editing ? 'Edit recurring' : 'New recurring'" :ui="{ content: 'max-w-lg' }">
      <template #body>
        <div class="space-y-4">
          <div v-if="!editing" class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-elevated/60">
            <button
              v-for="t in (['expense', 'income'] as const)"
              :key="t"
              type="button"
              class="rounded-lg py-2 text-[13px] font-medium capitalize transition-colors"
              :class="form.type === t ? (t === 'income' ? 'bg-success/15 text-success' : 'bg-error/15 text-error') : 'text-muted'"
              @click="form.type = t"
            >
              {{ t }}
            </button>
          </div>

          <UFormField label="Name">
            <UInput v-model="form.name" placeholder="e.g. Netflix, Rent, Salary" class="w-full" size="lg" />
          </UFormField>
          <UFormField label="Expected amount">
            <TransactionAmountInput v-model="form.amountMinor" size="lg" />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Frequency">
              <USelectMenu v-model="form.frequency" :items="freqItems" value-key="value" class="w-full" />
            </UFormField>
            <UFormField :label="editing ? 'Next expected date' : 'First expected date'">
              <UInput v-model="form.startDate" type="date" class="w-full" />
            </UFormField>
          </div>

          <UFormField v-if="form.type === 'expense'" label="Category">
            <TransactionCategoryPicker v-model="form.categoryId" />
          </UFormField>
          <UFormField label="Payment method">
            <TransactionPaymentMethodPicker v-model="form.paymentMethodId" />
          </UFormField>
          <UFormField label="Merchant (optional)">
            <TransactionMerchantPicker v-model:merchant-id="form.merchantId" v-model:merchant-name="form.merchantName" />
          </UFormField>
          <UFormField label="Note (optional)">
            <UInput v-model="form.note" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="formOpen = false">Cancel</UButton>
            <UButton :loading="saving" icon="i-lucide-check" @click="submitForm">{{ editing ? 'Save' : 'Create' }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Confirm occurrence modal -->
    <UModal v-model:open="confirmOpen" :title="confirming ? `Confirm ${confirming.name}` : ''" description="Record what actually happened — amount and date can differ from the expectation.">
      <template #body>
        <div v-if="confirming" class="space-y-4">
          <div class="rounded-xl bg-elevated/60 px-4 py-3 text-sm flex justify-between">
            <span class="text-muted">Expected</span>
            <span class="tnum">{{ money(confirming.amountMinor, confirming.currency) }} · {{ dayLabel(confirming.nextDueDate) }}</span>
          </div>
          <UFormField label="Actual amount">
            <TransactionAmountInput v-model="confirmForm.amountMinor" :currency="confirming.currency" autofocus />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Actual date">
              <UInput v-model="confirmForm.date" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Payment method">
              <TransactionPaymentMethodPicker v-model="confirmForm.paymentMethodId" label="Payment method" />
            </UFormField>
          </div>
          <UFormField label="Note (optional)">
            <UInput v-model="confirmForm.note" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="soft" color="neutral" @click="confirmOpen = false">Cancel</UButton>
            <UButton :loading="saving" icon="i-lucide-check" @click="submitConfirm">Record transaction</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
