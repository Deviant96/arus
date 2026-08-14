/**
 * Date & timezone utilities. No external dependencies — uses Intl (full ICU
 * is available in Node and modern browsers).
 *
 * Conventions:
 * - "ISO date" means a plain calendar date string `YYYY-MM-DD` (no time, no zone).
 *   These sort lexicographically, so string comparison is date comparison.
 * - Instants are JS `Date` objects (UTC internally).
 * - The user's timezone (default Asia/Jakarta) decides day boundaries.
 */

export const DEFAULT_TIMEZONE = 'Asia/Jakarta'

export interface ZonedParts {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()

function getDtf(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    dtfCache.set(timeZone, dtf)
  }
  return dtf
}

/** Break a UTC instant into wall-clock parts in the given timezone. */
export function utcToZoned(date: Date, timeZone: string): ZonedParts {
  const parts = getDtf(timeZone).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset of `timeZone` from UTC in minutes at the given instant (e.g. Jakarta = +420). */
export function timeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const p = utcToZoned(at, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - at.getTime()) / 60000)
}

/**
 * Convert a wall-clock date+time in a timezone to a UTC instant.
 * Two-pass to handle DST transitions correctly.
 */
export function zonedToUtc(isoDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const [hh = 0, mm = 0, ss = 0] = time.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, hh, mm, ss)
  let offset = timeZoneOffsetMinutes(timeZone, new Date(naive))
  let instant = naive - offset * 60000
  const offset2 = timeZoneOffsetMinutes(timeZone, new Date(instant))
  if (offset2 !== offset) {
    offset = offset2
    instant = naive - offset * 60000
  }
  return new Date(instant)
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function partsToIsoDate(p: { year: number, month: number, day: number }): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** Today's calendar date in the given timezone. */
export function todayInTz(timeZone: string, now: Date = new Date()): string {
  return partsToIsoDate(utcToZoned(now, timeZone))
}

/** Current wall clock time HH:mm in the given timezone. */
export function nowTimeInTz(timeZone: string, now: Date = new Date()): string {
  const p = utcToZoned(now, timeZone)
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  if (m < 1 || m > 12) return false
  return d >= 1 && d <= daysInMonth(y, m)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isoDateParts(isoDate: string): { year: number, month: number, day: number } {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number]
  return { year, month, day }
}

/** Add whole days to an ISO date (calendar arithmetic, timezone-free). */
export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = isoDateParts(isoDate)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return partsToIsoDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
}

/**
 * Add months while preserving an anchor day-of-month, clamping to the last
 * valid day when the target month is shorter.
 *
 *   addMonthsClamped('2026-01-31', 1) -> '2026-02-28'
 *   addMonthsClamped('2026-01-31', 2) -> '2026-03-31'  (anchor preserved)
 *
 * `anchorDay` defaults to the day of the input date. Pass it explicitly when
 * iterating so a clamped February doesn't permanently lower the day.
 */
export function addMonthsClamped(isoDate: string, months: number, anchorDay?: number): string {
  const { year, month, day } = isoDateParts(isoDate)
  const anchor = anchorDay ?? day
  const totalMonths = (year * 12 + (month - 1)) + months
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1
  const clampedDay = Math.min(anchor, daysInMonth(targetYear, targetMonth))
  return partsToIsoDate({ year: targetYear, month: targetMonth, day: clampedDay })
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

/**
 * Next occurrence strictly after `fromDate`, anchored to the rule's start
 * date (weekday for weekly rules, day-of-month for monthly/quarterly/yearly).
 */
export function nextOccurrence(frequency: RecurrenceFrequency, current: string, anchorDay: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(current, 7)
    case 'monthly':
      return addMonthsClamped(current, 1, anchorDay)
    case 'quarterly':
      return addMonthsClamped(current, 3, anchorDay)
    case 'yearly':
      return addMonthsClamped(current, 12, anchorDay)
  }
}

/** Generate the next `count` occurrences starting from (and including) `startDate`. */
export function occurrencesFrom(frequency: RecurrenceFrequency, startDate: string, anchorDay: number, count: number): string[] {
  const out: string[] = []
  let cur = startDate
  for (let i = 0; i < count; i++) {
    out.push(cur)
    cur = nextOccurrence(frequency, cur, anchorDay)
  }
  return out
}

/**
 * Generate installment due dates: `count` monthly dates starting at
 * `firstDueDate`, anchored on `dueDay` (defaults to first due date's day).
 */
export function generateInstallmentDueDates(firstDueDate: string, count: number, dueDay?: number): string[] {
  const anchor = dueDay ?? isoDateParts(firstDueDate).day
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(i === 0 ? firstDueDate : addMonthsClamped(firstDueDate, i, anchor))
  }
  return out
}

// ---------------------------------------------------------------------------
// Reporting periods
// ---------------------------------------------------------------------------

export type PeriodPreset
  = | 'today'
    | 'this_week'
    | 'this_month'
    | 'last_month'
    | '3m'
    | '6m'
    | '1y'
    | 'custom'

export interface DateRange {
  /** inclusive */
  startDate: string
  /** inclusive */
  endDate: string
}

export function monthRange(year: number, month: number): DateRange {
  return {
    startDate: partsToIsoDate({ year, month, day: 1 }),
    endDate: partsToIsoDate({ year, month, day: daysInMonth(year, month) }),
  }
}

/** `2026-08` -> range for that month */
export function monthStringRange(monthStr: string): DateRange {
  const [y, m] = monthStr.split('-').map(Number) as [number, number]
  return monthRange(y, m)
}

export function isoDateToMonthString(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function resolvePeriod(preset: PeriodPreset, timeZone: string, custom?: Partial<DateRange>, now: Date = new Date()): DateRange {
  const today = todayInTz(timeZone, now)
  const { year, month } = isoDateParts(today)

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'this_week': {
      // ISO week: Monday start
      const { year: y, month: m, day: d } = isoDateParts(today)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 Sun..6 Sat
      const sinceMonday = (dow + 6) % 7
      return { startDate: addDays(today, -sinceMonday), endDate: today }
    }
    case 'this_month':
      return monthRange(year, month)
    case 'last_month': {
      const prev = addMonthsClamped(partsToIsoDate({ year, month, day: 1 }), -1)
      const p = isoDateParts(prev)
      return monthRange(p.year, p.month)
    }
    case '3m':
      return { startDate: addMonthsClamped(today, -3, isoDateParts(today).day), endDate: today }
    case '6m':
      return { startDate: addMonthsClamped(today, -6, isoDateParts(today).day), endDate: today }
    case '1y':
      return { startDate: addMonthsClamped(today, -12, isoDateParts(today).day), endDate: today }
    case 'custom': {
      const start = custom?.startDate && isValidIsoDate(custom.startDate) ? custom.startDate : monthRange(year, month).startDate
      const end = custom?.endDate && isValidIsoDate(custom.endDate) ? custom.endDate : today
      return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
    }
  }
}

/**
 * Convert an inclusive calendar-date range in a timezone into UTC instant
 * bounds: [startUtc, endUtcExclusive).
 */
export function rangeToUtcInstants(range: DateRange, timeZone: string): { startUtc: Date, endUtcExclusive: Date } {
  return {
    startUtc: zonedToUtc(range.startDate, '00:00:00', timeZone),
    endUtcExclusive: zonedToUtc(addDays(range.endDate, 1), '00:00:00', timeZone),
  }
}

/** Human labels like "15 Aug 2026" (id-friendly, but English month names). */
export function formatIsoDate(isoDate: string, opts: { withYear?: boolean } = {}): string {
  const { year, month, day } = isoDateParts(isoDate)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[month - 1]}${opts.withYear === false ? '' : ` ${year}`}`
}

export function formatMonthString(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number) as [number, number]
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[m - 1]} ${y}`
}
