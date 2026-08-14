import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsClamped,
  generateInstallmentDueDates,
  isValidIsoDate,
  nextOccurrence,
  occurrencesFrom,
  resolvePeriod,
  todayInTz,
  utcToZoned,
  zonedToUtc,
} from '../shared/utils/dates'

describe('addMonthsClamped', () => {
  it('clamps 31 Jan to last day of February, then restores 31 Mar via the original anchor', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-01-31', 2, 31)).toBe('2026-03-31')
    expect(addMonthsClamped('2026-01-31', 3, 31)).toBe('2026-04-30')
  })

  it('handles leap years', () => {
    expect(addMonthsClamped('2024-01-31', 1, 31)).toBe('2024-02-29')
    expect(addMonthsClamped('2024-01-31', 2, 31)).toBe('2024-03-31')
  })
})

describe('generateInstallmentDueDates', () => {
  it('generates monthly dates from first due date without producing invalid dates', () => {
    const dates = generateInstallmentDueDates('2026-01-31', 4, 31)
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
})

describe('recurring nextOccurrence', () => {
  it('advances monthly with the same 31st-clamping rule', () => {
    expect(nextOccurrence('monthly', '2026-01-31', 31)).toBe('2026-02-28')
    expect(nextOccurrence('monthly', '2026-02-28', 31)).toBe('2026-03-31')
    expect(nextOccurrence('quarterly', '2026-01-31', 31)).toBe('2026-04-30')
    expect(nextOccurrence('yearly', '2024-02-29', 29)).toBe('2025-02-28')
    expect(nextOccurrence('weekly', '2026-08-14', 14)).toBe('2026-08-21')
  })

  it('generates a bounded sequence', () => {
    expect(occurrencesFrom('monthly', '2026-01-15', 15, 3)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })
})

describe('iso date validation', () => {
  it('rejects invalid calendar dates', () => {
    expect(isValidIsoDate('2026-02-31')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-08-14')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2025-02-29')).toBe(false)
  })
})

describe('timezone conversion (Asia/Jakarta, UTC+7, no DST)', () => {
  it('round-trips a wall-clock time to UTC and back', () => {
    const utc = zonedToUtc('2026-08-14', '10:30:00', 'Asia/Jakarta')
    expect(utc.toISOString()).toBe('2026-08-14T03:30:00.000Z')
    const parts = utcToZoned(utc, 'Asia/Jakarta')
    expect(parts).toMatchObject({ year: 2026, month: 8, day: 14, hour: 10, minute: 30 })
  })

  it('computes today in Jakarta from a known UTC instant', () => {
    // 2026-08-14 16:00 UTC is already 23:00 in Jakarta
    expect(todayInTz('Asia/Jakarta', new Date('2026-08-14T16:00:00Z'))).toBe('2026-08-14')
    // 2026-08-14 17:30 UTC is 00:30 on the 15th in Jakarta
    expect(todayInTz('Asia/Jakarta', new Date('2026-08-14T17:30:00Z'))).toBe('2026-08-15')
  })
})

describe('resolvePeriod', () => {
  const now = new Date('2026-08-14T03:00:00Z') // 10:00 in Jakarta
  it('resolves this_month and last_month', () => {
    expect(resolvePeriod('this_month', 'Asia/Jakarta', undefined, now)).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31' })
    expect(resolvePeriod('last_month', 'Asia/Jakarta', undefined, now)).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' })
    expect(resolvePeriod('today', 'Asia/Jakarta', undefined, now)).toEqual({ startDate: '2026-08-14', endDate: '2026-08-14' })
  })
  it('swaps inverted custom ranges', () => {
    expect(resolvePeriod('custom', 'Asia/Jakarta', { startDate: '2026-08-20', endDate: '2026-08-01' }, now))
      .toEqual({ startDate: '2026-08-01', endDate: '2026-08-20' })
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
