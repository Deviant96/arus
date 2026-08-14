/**
 * Money is always handled as integer minor units (e.g. cents, or whole rupiah
 * for IDR which is treated as a 0-decimal currency in practice).
 * Never use floating point for stored amounts or arithmetic.
 */

export const SUPPORTED_CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'JPY', 'AUD', 'GBP'] as const
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

const CURRENCY_DECIMALS: Record<string, number> = {
  IDR: 0,
  JPY: 0,
  USD: 2,
  SGD: 2,
  MYR: 2,
  EUR: 2,
  AUD: 2,
  GBP: 2,
}

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code.toUpperCase())
}

/**
 * Parse a user-entered amount string into integer minor units without
 * floating point drift. Accepts "1250000", "1.250.000", "1,250,000",
 * "12.50" (for 2-decimal currencies), etc.
 *
 * Heuristic for separators: the *last* separator group is treated as a
 * decimal part only if the currency has decimals and the group length is
 * <= the currency's decimal count and there is exactly one such separator
 * of its kind. For 0-decimal currencies all separators are grouping.
 */
export function parseAmountToMinor(input: string | number, currency: string): number | null {
  const decimals = currencyDecimals(currency)

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null
    // Convert via string to avoid float drift for values with decimals
    return parseAmountToMinor(input.toFixed(decimals), currency)
  }

  let s = input.trim().replace(/\s/g, '')
  if (!s) return null
  s = s.replace(/[^\d.,-]/g, '')
  if (s.startsWith('-')) return null
  if (!/\d/.test(s)) return null

  let integerPart = s
  let decimalPart = ''

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const lastSep = Math.max(lastDot, lastComma)

  if (lastSep !== -1) {
    const tail = s.slice(lastSep + 1)
    const sepChar = s[lastSep]!
    const sepCount = s.split(sepChar).length - 1
    const looksDecimal
      = decimals > 0
        && tail.length > 0
        && tail.length <= decimals
        && sepCount === 1
        // "1.250" with a 2-decimal currency is ambiguous; treat 3-digit tail as grouping
        && tail.length !== 3
    if (looksDecimal) {
      integerPart = s.slice(0, lastSep)
      decimalPart = tail
    }
  }

  integerPart = integerPart.replace(/[.,]/g, '')
  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(decimalPart)) return null
  if (integerPart === '' && decimalPart === '') return null

  const padded = decimalPart.padEnd(decimals, '0').slice(0, decimals)
  const minorStr = (integerPart || '0') + padded
  const minor = Number(minorStr)
  if (!Number.isSafeInteger(minor)) return null
  return minor
}

/** Convert minor units to a major-unit number purely for display math (charts). */
export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency)
}

export function formatMoney(minor: number, currency: string, options: { locale?: string, compact?: boolean, signDisplay?: 'auto' | 'never' | 'always' } = {}): string {
  const decimals = currencyDecimals(currency)
  const major = minor / 10 ** decimals
  const locale = options.locale ?? (currency.toUpperCase() === 'IDR' ? 'id-ID' : 'en-US')
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: options.compact ? 0 : decimals,
      maximumFractionDigits: options.compact ? 1 : decimals,
      notation: options.compact ? 'compact' : 'standard',
      signDisplay: options.signDisplay ?? 'auto',
    }).format(major)
  }
  catch {
    return `${currency} ${major.toLocaleString(locale)}`
  }
}

/** Format just the number part (no currency symbol), e.g. for amount inputs. */
export function formatAmountPlain(minor: number, currency: string, locale?: string): string {
  const decimals = currencyDecimals(currency)
  const major = minor / 10 ** decimals
  return new Intl.NumberFormat(locale ?? (currency.toUpperCase() === 'IDR' ? 'id-ID' : 'en-US'), {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(major)
}

/**
 * Split a total into `count` parts that sum exactly to the total.
 * All parts share the same base amount; the LAST part absorbs the rounding
 * remainder (standard loan-style schedule).
 */
export function splitEvenly(totalMinor: number, count: number): number[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('totalMinor must be a non-negative integer')
  if (!Number.isInteger(count) || count <= 0) throw new Error('count must be a positive integer')
  const base = Math.floor(totalMinor / count)
  const parts = Array.from({ length: count }, () => base)
  parts[count - 1] = totalMinor - base * (count - 1)
  return parts
}

/** Integer percentage (0-100+, one decimal) safe against divide-by-zero. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}
