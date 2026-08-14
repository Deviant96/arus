import { formatIsoDate, todayInTz, DEFAULT_TIMEZONE, addDays } from '#shared/utils/dates'
import { formatMoney } from '#shared/utils/money'

export function useFormat() {
  const { user } = useSessionUser()

  const currency = computed(() => user.value?.preferredCurrency ?? 'IDR')
  const timezone = computed(() => user.value?.timezone ?? DEFAULT_TIMEZONE)

  function money(minor: number, cur?: string, opts: { compact?: boolean } = {}): string {
    return formatMoney(minor, cur ?? currency.value, { compact: opts.compact })
  }

  /** Signed display for transaction rows: −Rp50.000 / +Rp50.000 */
  function signedMoney(minor: number, type: 'income' | 'expense' | 'transfer', cur?: string): string {
    const base = formatMoney(minor, cur ?? currency.value)
    if (type === 'income') return `+${base}`
    if (type === 'expense') return `−${base}`
    return base
  }

  function today(): string {
    return todayInTz(timezone.value)
  }

  /** "Today", "Yesterday", or "14 Aug 2026". */
  function dayLabel(isoDate: string, withYear = true): string {
    const t = today()
    if (isoDate === t) return 'Today'
    if (isoDate === addDays(t, -1)) return 'Yesterday'
    if (isoDate === addDays(t, 1)) return 'Tomorrow'
    return formatIsoDate(isoDate, { withYear })
  }

  return { currency, timezone, money, signedMoney, dayLabel, today }
}
