import type { TransactionDto } from '#shared/types/api'

export interface QuickAddPrefill {
  type?: 'income' | 'expense' | 'transfer'
  amountMinor?: number
  currency?: string
  categoryId?: string | null
  paymentMethodId?: string | null
  fromPaymentMethodId?: string | null
  toPaymentMethodId?: string | null
  merchantId?: string | null
  merchantName?: string | null
  note?: string | null
  date?: string
}

interface QuickAddState {
  open: boolean
  editing: TransactionDto | null
  prefill: QuickAddPrefill | null
}

/** Global Quick Add state — openable from anywhere (FAB, Ctrl+N, favorites). */
export function useQuickAdd() {
  const state = useState<QuickAddState>('quick-add', () => ({ open: false, editing: null, prefill: null }))

  function openQuickAdd(prefill?: QuickAddPrefill) {
    state.value = { open: true, editing: null, prefill: prefill ?? null }
  }

  function openEdit(tx: TransactionDto) {
    state.value = { open: true, editing: tx, prefill: null }
  }

  function close() {
    state.value = { ...state.value, open: false }
  }

  /** Bump this to tell lists a transaction changed. */
  const version = useState('tx-version', () => 0)
  function bumpVersion() {
    version.value++
  }

  return { state, openQuickAdd, openEdit, close, version, bumpVersion }
}
