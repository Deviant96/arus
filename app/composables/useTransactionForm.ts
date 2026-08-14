import type { SmartRepeatSuggestion, TransactionDto, FavoriteDto } from '#shared/types/api'
import type { QuickAddPrefill } from './useQuickAdd'
import { cacheGet, cacheSet } from '../utils/idb'

export interface TransactionFormState {
  type: 'income' | 'expense' | 'transfer'
  amountMinor: number | null
  currency: string
  categoryId: string | null
  paymentMethodId: string | null
  fromPaymentMethodId: string | null
  toPaymentMethodId: string | null
  merchantId: string | null
  merchantName: string | null
  note: string
  date: string
  time: string | null
  saveAsFavorite: boolean
  favoriteName: string
}

/**
 * Orchestrates the Add/Edit Transaction form:
 *  - sensible defaults (user's default category/payment method, today)
 *  - Save vs "Save & Add Another" (preserves context, clears specifics)
 *  - offline queueing with optimistic cache update
 */
export function useTransactionForm() {
  const { user } = useSessionUser()
  const { today } = useFormat()
  const api = useApi()
  const toast = useToast()
  const { bumpVersion } = useQuickAdd()
  const lookups = useLookups()

  const editing = ref<TransactionDto | null>(null)
  const saving = ref(false)
  const errors = ref<Record<string, string>>({})

  const form = reactive<TransactionFormState>(blank())

  function blank(): TransactionFormState {
    return {
      type: 'expense',
      amountMinor: null,
      currency: user.value?.preferredCurrency ?? 'IDR',
      categoryId: user.value?.defaultCategoryId ?? null,
      paymentMethodId: user.value?.defaultPaymentMethodId ?? null,
      fromPaymentMethodId: null,
      toPaymentMethodId: null,
      merchantId: null,
      merchantName: null,
      note: '',
      date: today(),
      time: null,
      saveAsFavorite: false,
      favoriteName: '',
    }
  }

  function reset(prefill?: QuickAddPrefill | null, tx?: TransactionDto | null) {
    errors.value = {}
    editing.value = tx ?? null
    Object.assign(form, blank())

    if (tx) {
      Object.assign(form, {
        type: tx.type,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        categoryId: tx.categoryId,
        paymentMethodId: tx.paymentMethodId,
        fromPaymentMethodId: tx.fromPaymentMethodId,
        toPaymentMethodId: tx.toPaymentMethodId,
        merchantId: tx.merchantId,
        merchantName: tx.merchant?.name ?? null,
        note: tx.note ?? '',
        date: tx.date,
        time: tx.time,
      })
    }
    else if (prefill) {
      Object.assign(form, {
        ...prefill,
        note: prefill.note ?? '',
        date: prefill.date ?? today(),
      })
    }
  }

  function applySuggestion(s: SmartRepeatSuggestion) {
    form.type = s.type === 'transfer' ? 'expense' : s.type
    form.amountMinor = s.amountMinor
    form.currency = s.currency
    form.categoryId = s.categoryId
    form.paymentMethodId = s.paymentMethodId
    form.merchantId = s.merchantId
    form.merchantName = s.merchant?.name ?? null
    if (s.note) form.note = s.note
  }

  function applyFavorite(f: FavoriteDto) {
    form.type = f.type
    form.amountMinor = f.amountMinor
    form.currency = f.currency
    form.categoryId = f.categoryId
    form.paymentMethodId = f.paymentMethodId
    form.merchantId = f.merchantId
    form.merchantName = f.merchant?.name ?? null
    form.note = f.note ?? ''
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.amountMinor || form.amountMinor <= 0) e.amount = 'Enter an amount greater than zero'
    if (form.type === 'expense' && !form.categoryId) e.categoryId = 'Pick a category'
    if ((form.type === 'expense' || form.type === 'income') && !form.paymentMethodId) e.paymentMethodId = 'Pick a payment method'
    if (form.type === 'transfer') {
      if (!form.fromPaymentMethodId) e.fromPaymentMethodId = 'Pick the source'
      if (!form.toPaymentMethodId) e.toPaymentMethodId = 'Pick the destination'
      if (form.fromPaymentMethodId && form.fromPaymentMethodId === form.toPaymentMethodId) e.toPaymentMethodId = 'Must differ from source'
    }
    errors.value = e
    return Object.keys(e).length === 0
  }

  function buildPayload(id?: string) {
    const isTransfer = form.type === 'transfer'
    return {
      ...(id ? { id } : {}),
      type: form.type,
      amountMinor: form.amountMinor!,
      currency: form.currency,
      date: form.date,
      ...(form.time ? { time: form.time } : {}),
      categoryId: isTransfer ? null : form.categoryId,
      paymentMethodId: isTransfer ? null : form.paymentMethodId,
      fromPaymentMethodId: isTransfer ? form.fromPaymentMethodId : null,
      toPaymentMethodId: isTransfer ? form.toPaymentMethodId : null,
      merchantId: isTransfer ? null : form.merchantId,
      merchantName: isTransfer ? null : (form.merchantId ? null : form.merchantName),
      note: form.note.trim() || null,
    }
  }

  /** Optimistic DTO for offline display (joined names resolved locally). */
  function optimisticDto(id: string): TransactionDto {
    const cat = lookups.categoryById(form.categoryId)
    const pm = lookups.paymentMethodById(form.paymentMethodId)
    const fromPm = lookups.paymentMethodById(form.fromPaymentMethodId)
    const toPm = lookups.paymentMethodById(form.toPaymentMethodId)
    const now = new Date().toISOString()
    return {
      id,
      type: form.type,
      amountMinor: form.amountMinor!,
      currency: form.currency,
      occurredAt: now,
      date: form.date,
      time: form.time ?? '12:00',
      categoryId: form.categoryId,
      category: cat ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color } : null,
      paymentMethodId: form.paymentMethodId,
      paymentMethod: pm ? { id: pm.id, name: pm.name, type: pm.type } : null,
      fromPaymentMethodId: form.fromPaymentMethodId,
      fromPaymentMethod: fromPm ? { id: fromPm.id, name: fromPm.name, type: fromPm.type } : null,
      toPaymentMethodId: form.toPaymentMethodId,
      toPaymentMethod: toPm ? { id: toPm.id, name: toPm.name, type: toPm.type } : null,
      merchantId: form.merchantId,
      merchant: form.merchantId && form.merchantName ? { id: form.merchantId, name: form.merchantName } : (form.merchantName ? { id: 'pending', name: form.merchantName } : null),
      note: form.note.trim() || null,
      tags: [],
      installmentId: null,
      recurringId: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  async function persistFavorite() {
    if (!form.saveAsFavorite || editing.value) return
    const name = form.favoriteName.trim() || form.merchantName || 'Favorite'
    try {
      await api.mutate('POST', '/api/favorites', {
        name,
        type: form.type === 'transfer' ? 'expense' : form.type,
        amountMinor: form.amountMinor,
        currency: form.currency,
        categoryId: form.categoryId,
        paymentMethodId: form.paymentMethodId,
        merchantId: form.merchantId,
        note: form.note.trim() || null,
      }, { kind: 'favorite.create', description: `Save favorite "${name}"` })
      await lookups.reload().catch(() => {})
    }
    catch { /* favorite failure never blocks the transaction */ }
  }

  /**
   * @returns true when persisted (or queued offline) successfully
   */
  async function save(): Promise<boolean> {
    if (!validate()) return false
    saving.value = true
    try {
      if (editing.value) {
        await api.mutate('PATCH', `/api/transactions/${editing.value.id}`, buildPayload(), {
          kind: 'transaction.update',
          description: `Update transaction`,
        })
      }
      else {
        const id = crypto.randomUUID()
        const { queued } = await api.mutate('POST', '/api/transactions', buildPayload(id), {
          kind: 'transaction.create',
          description: `Add ${form.type}`,
          onQueued: async () => {
            // Optimistically prepend to the cached recent list
            const hit = await cacheGet<{ items: TransactionDto[] }>('tx:recent')
            const items = hit?.data.items ?? []
            await cacheSet('tx:recent', { items: [optimisticDto(id), ...items].slice(0, 50) })
          },
        })
        await persistFavorite()
        if (queued) {
          toast.add({ title: 'Saved on this device', description: 'It will sync when you are back online.', icon: 'i-lucide-cloud-off', color: 'warning' })
        }
      }
      bumpVersion()
      return true
    }
    catch (err: any) {
      const fields = err?.data?.data?.fields ?? err?.data?.fields
      if (fields) errors.value = fields
      toast.add({
        title: editing.value ? "Couldn't update this transaction" : "Couldn't save this transaction",
        description: err?.statusMessage ?? err?.data?.statusMessage ?? 'Please check the form and try again.',
        color: 'error',
      })
      return false
    }
    finally {
      saving.value = false
    }
  }

  /** Save, then prepare the form for the next entry (context preserved). */
  async function saveAndAddAnother(): Promise<boolean> {
    const ok = await save()
    if (!ok) return false
    // Keep: type, category, payment method, date, currency.
    // Clear: amount, merchant, note, favorite flag.
    form.amountMinor = null
    form.merchantId = null
    form.merchantName = null
    form.note = ''
    form.time = null
    form.saveAsFavorite = false
    form.favoriteName = ''
    errors.value = {}
    return true
  }

  async function remove(): Promise<boolean> {
    if (!editing.value) return false
    saving.value = true
    try {
      await api.mutate('DELETE', `/api/transactions/${editing.value.id}`, null, {
        kind: 'transaction.delete',
        description: 'Delete transaction',
      })
      bumpVersion()
      return true
    }
    catch (err: any) {
      toast.add({ title: "Couldn't delete", description: err?.statusMessage ?? 'Please try again.', color: 'error' })
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { form, editing, errors, saving, reset, validate, save, saveAndAddAnother, remove, applySuggestion, applyFavorite }
}
