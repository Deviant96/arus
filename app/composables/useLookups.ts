import type { CategoryDto, FavoriteDto, MerchantDto, PaymentMethodDto } from '#shared/types/api'

/**
 * Reference data used by pickers everywhere (categories, payment methods,
 * favorites, recent merchants). Cached in IndexedDB so pickers work offline.
 */
export function useLookups() {
  const api = useApi()

  const categories = useState<CategoryDto[]>('lu-categories', () => [])
  const paymentMethods = useState<PaymentMethodDto[]>('lu-payment-methods', () => [])
  const favorites = useState<FavoriteDto[]>('lu-favorites', () => [])
  const merchants = useState<MerchantDto[]>('lu-merchants', () => [])
  const loaded = useState('lu-loaded', () => false)

  async function load(force = false) {
    if (loaded.value && !force) return
    const [cats, pms, favs, merchs] = await Promise.all([
      api.cachedGet<{ items: CategoryDto[] }>('lookups:categories', '/api/categories'),
      api.cachedGet<{ items: PaymentMethodDto[] }>('lookups:payment-methods', '/api/payment-methods'),
      api.cachedGet<{ items: FavoriteDto[] }>('lookups:favorites', '/api/favorites'),
      api.cachedGet<{ items: MerchantDto[] }>('lookups:merchants', '/api/merchants', { limit: 50 }),
    ])
    categories.value = cats.data.items
    paymentMethods.value = pms.data.items
    favorites.value = favs.data.items
    merchants.value = merchs.data.items
    loaded.value = true
  }

  const activeCategories = computed(() => categories.value.filter(c => c.active))
  const activePaymentMethods = computed(() => paymentMethods.value.filter(p => p.active))

  const categoryById = (id: string | null | undefined) => (id ? categories.value.find(c => c.id === id) ?? null : null)
  const paymentMethodById = (id: string | null | undefined) => (id ? paymentMethods.value.find(p => p.id === id) ?? null : null)

  return {
    categories,
    paymentMethods,
    favorites,
    merchants,
    activeCategories,
    activePaymentMethods,
    categoryById,
    paymentMethodById,
    load,
    reload: () => load(true),
  }
}

export const PAYMENT_METHOD_TYPE_META: Record<string, { label: string, icon: string }> = {
  cash: { label: 'Cash', icon: 'i-lucide-banknote' },
  bank: { label: 'Bank', icon: 'i-lucide-landmark' },
  e_wallet: { label: 'E-Wallet', icon: 'i-lucide-wallet' },
  credit_card: { label: 'Credit Card', icon: 'i-lucide-credit-card' },
  paylater: { label: 'PayLater', icon: 'i-lucide-clock' },
  other: { label: 'Other', icon: 'i-lucide-circle-dollar-sign' },
}
