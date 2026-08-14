<script setup lang="ts">
import type { SmartRepeatSuggestion, TransactionDto } from '#shared/types/api'
import type { QuickAddPrefill } from '../../composables/useQuickAdd'
import { cacheGet, cacheSet } from '../../utils/idb'
import { useSyncStore } from '../../stores/sync'

const props = defineProps<{
  editingTx: TransactionDto | null
  prefill: QuickAddPrefill | null
}>()

const emit = defineEmits<{ close: [], saved: [] }>()

const { form, editing, errors, saving, reset, save, saveAndAddAnother, remove, applySuggestion, applyFavorite } = useTransactionForm()
const { favorites } = useLookups()
const { money } = useFormat()
const sync = useSyncStore()
const toast = useToast()

const amountInput = ref<InstanceType<any> | null>(null)
const moreOpen = ref(false)
const confirmDelete = ref(false)

const isEdit = computed(() => !!editing.value)
const installmentLocked = computed(() => !!props.editingTx?.installmentId && !!props.editingTx?.installmentTitle)

// Smart Repeat suggestions
const suggestions = ref<SmartRepeatSuggestion[]>([])
let suggestTimer: ReturnType<typeof setTimeout> | undefined

async function loadSuggestions(q?: string) {
  const key = q ? `suggest:q:${q.toLowerCase()}` : 'suggest:recent'
  try {
    const res = await $fetch<{ items: SmartRepeatSuggestion[] }>('/api/transactions/suggest', { params: q ? { q } : {} })
    suggestions.value = res.items
    cacheSet(key, res.items)
  }
  catch {
    const hit = await cacheGet<SmartRepeatSuggestion[]>(key) ?? await cacheGet<SmartRepeatSuggestion[]>('suggest:recent')
    if (hit) suggestions.value = hit.data
  }
}

watch(() => form.merchantName, (name) => {
  if (isEdit.value) return
  clearTimeout(suggestTimer)
  suggestTimer = setTimeout(() => loadSuggestions(name?.trim() || undefined), 300)
})

const typeItems = [
  { value: 'expense', label: 'Expense', icon: 'i-lucide-arrow-up-right' },
  { value: 'income', label: 'Income', icon: 'i-lucide-arrow-down-left' },
  { value: 'transfer', label: 'Transfer', icon: 'i-lucide-arrow-left-right' },
] as const

onMounted(() => {
  reset(props.prefill, props.editingTx)
  moreOpen.value = !!(props.editingTx?.note || props.editingTx?.merchantId || props.prefill?.note || props.prefill?.merchantName)
  if (!isEdit.value) loadSuggestions()
})

function pickSuggestion(s: SmartRepeatSuggestion) {
  applySuggestion(s)
}

async function onSave() {
  const ok = await save()
  if (ok) {
    emit('saved')
    emit('close')
  }
}

async function onSaveAndAddAnother() {
  const ok = await saveAndAddAnother()
  if (ok) {
    toast.add({ title: 'Saved — ready for the next one', icon: 'i-lucide-check', color: 'success', duration: 1500 })
    amountInput.value?.focus?.()
  }
}

async function onDelete() {
  const ok = await remove()
  if (ok) {
    confirmDelete.value = false
    emit('saved')
    emit('close')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UAlert
      v-if="installmentLocked"
      color="info"
      variant="subtle"
      icon="i-lucide-calendar-clock"
      :title="`Part of installment: ${props.editingTx?.installmentTitle}`"
      description="Amount, date and type are managed by the installment payment record."
    />

    <!-- Type -->
    <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-elevated/60" role="tablist" aria-label="Transaction type">
      <button
        v-for="t in typeItems"
        :key="t.value"
        type="button"
        role="tab"
        :aria-selected="form.type === t.value"
        class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-all"
        :class="form.type === t.value
          ? (t.value === 'income' ? 'bg-success/15 text-success' : t.value === 'transfer' ? 'bg-info/15 text-info' : 'bg-error/15 text-error')
          : 'text-muted hover:text-highlighted'"
        :disabled="installmentLocked"
        @click="form.type = t.value"
      >
        <UIcon :name="t.icon" class="size-3.5" />
        {{ t.label }}
      </button>
    </div>

    <!-- Favorites & Smart Repeat -->
    <div v-if="!isEdit && form.type !== 'transfer' && (favorites.length || suggestions.length)" class="space-y-2">
      <div v-if="favorites.length" class="flex gap-1.5 overflow-x-auto scroll-thin -mx-1 px-1">
        <button
          v-for="f in favorites.slice(0, 6)"
          :key="f.id"
          type="button"
          class="flex items-center gap-1.5 shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 pl-2 pr-2.5 py-1.5 text-[12px] font-medium text-amber-300/90 hover:bg-amber-400/15 transition-colors"
          @click="applyFavorite(f)"
        >
          <UIcon name="i-lucide-star" class="size-3" />
          {{ f.name }}
          <span class="opacity-70 tnum">{{ money(f.amountMinor, f.currency) }}</span>
        </button>
      </div>
      <div v-if="suggestions.length" class="flex gap-1.5 overflow-x-auto scroll-thin -mx-1 px-1">
        <button
          v-for="s in suggestions"
          :key="s.key"
          type="button"
          class="flex items-center gap-1.5 shrink-0 rounded-full border border-default bg-elevated/50 px-2.5 py-1.5 text-[12px] text-toned hover:border-accented hover:bg-elevated transition-colors"
          @click="pickSuggestion(s)"
        >
          <UIcon name="i-lucide-history" class="size-3 text-muted" />
          <span class="font-medium">{{ s.label }}</span>
          <span class="text-muted tnum">{{ money(s.amountMinor, s.currency) }}</span>
          <span v-if="s.paymentMethod" class="text-dimmed">· {{ s.paymentMethod.name }}</span>
        </button>
      </div>
    </div>

    <!-- Amount -->
    <div>
      <TransactionAmountInput
        ref="amountInput"
        v-model="form.amountMinor"
        :currency="form.currency"
        :autofocus="!isEdit"
        :class="installmentLocked ? 'pointer-events-none opacity-60' : ''"
      />
      <p v-if="errors.amount" class="text-xs text-error mt-1.5">{{ errors.amount }}</p>
    </div>

    <!-- Category (expense/income) -->
    <div v-if="form.type !== 'transfer'">
      <p class="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">Category</p>
      <TransactionCategoryPicker v-model="form.categoryId" />
      <p v-if="errors.categoryId" class="text-xs text-error mt-1.5">{{ errors.categoryId }}</p>
    </div>

    <!-- Payment method / transfer routes -->
    <div v-if="form.type !== 'transfer'">
      <p class="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">Payment method</p>
      <TransactionPaymentMethodPicker v-model="form.paymentMethodId" />
      <p v-if="errors.paymentMethodId" class="text-xs text-error mt-1.5">{{ errors.paymentMethodId }}</p>
    </div>
    <template v-else>
      <div>
        <p class="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">From</p>
        <TransactionPaymentMethodPicker v-model="form.fromPaymentMethodId" :exclude-id="form.toPaymentMethodId" label="Source" />
        <p v-if="errors.fromPaymentMethodId" class="text-xs text-error mt-1.5">{{ errors.fromPaymentMethodId }}</p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">To</p>
        <TransactionPaymentMethodPicker v-model="form.toPaymentMethodId" :exclude-id="form.fromPaymentMethodId" label="Destination" />
        <p v-if="errors.toPaymentMethodId" class="text-xs text-error mt-1.5">{{ errors.toPaymentMethodId }}</p>
      </div>
    </template>

    <!-- More (optional fields) -->
    <UCollapsible v-model:open="moreOpen">
      <button type="button" class="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-highlighted transition-colors">
        <UIcon name="i-lucide-chevron-right" class="size-4 transition-transform" :class="moreOpen ? 'rotate-90' : ''" />
        More — merchant, note, date{{ form.type !== 'transfer' ? ', favorite' : '' }}
      </button>
      <template #content>
        <div class="space-y-3 pt-3">
          <TransactionMerchantPicker
            v-if="form.type !== 'transfer'"
            v-model:merchant-id="form.merchantId"
            v-model:merchant-name="form.merchantName"
          />
          <UInput v-model="form.note" placeholder="Note" icon="i-lucide-pencil-line" class="w-full" />
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Date">
              <UInput v-model="form.date" type="date" class="w-full" :disabled="installmentLocked" />
            </UFormField>
            <UFormField label="Time">
              <UInput
                :model-value="form.time ?? ''"
                type="time"
                class="w-full"
                @update:model-value="form.time = ($event as string) || null"
              />
            </UFormField>
          </div>
          <div v-if="!isEdit && form.type !== 'transfer'" class="rounded-xl border border-default p-3 space-y-2">
            <USwitch v-model="form.saveAsFavorite" label="Save as favorite" size="sm" />
            <UInput
              v-if="form.saveAsFavorite"
              v-model="form.favoriteName"
              placeholder="Favorite name (e.g. Morning Coffee)"
              icon="i-lucide-star"
              class="w-full"
            />
          </div>
        </div>
      </template>
    </UCollapsible>

    <!-- Actions -->
    <div class="flex flex-col gap-2 pt-1">
      <template v-if="!isEdit">
        <UButton block size="lg" :loading="saving" icon="i-lucide-check" @click="onSave">
          Save
        </UButton>
        <UButton block size="lg" variant="soft" color="neutral" :loading="saving" icon="i-lucide-list-plus" @click="onSaveAndAddAnother">
          Save & Add Another
        </UButton>
      </template>
      <template v-else>
        <UButton block size="lg" :loading="saving" icon="i-lucide-check" @click="onSave">
          Save changes
        </UButton>
        <div class="flex gap-2">
          <UButton class="flex-1" size="lg" variant="soft" color="neutral" @click="emit('close')">
            Cancel
          </UButton>
          <UButton size="lg" variant="soft" color="error" icon="i-lucide-trash-2" @click="confirmDelete = true">
            Delete
          </UButton>
        </div>
      </template>
      <p v-if="!sync.isOnline" class="text-center text-xs text-warning flex items-center justify-center gap-1">
        <UIcon name="i-lucide-cloud-off" class="size-3" /> Offline — will be saved on this device
      </p>
    </div>

    <UModal v-model:open="confirmDelete" title="Delete this transaction?" description="This can't be undone.">
      <template #body>
        <div class="flex gap-2 justify-end">
          <UButton variant="soft" color="neutral" @click="confirmDelete = false">Cancel</UButton>
          <UButton color="error" :loading="saving" @click="onDelete">Delete</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
