import { describe, expect, it } from 'vitest'
import { expectedOccurrencesInRange } from '../server/services/recurring'

describe('expectedOccurrencesInRange', () => {
  const rule = {
    frequency: 'monthly' as const,
    nextDueDate: '2026-08-10',
    anchorDay: 10,
    active: true,
  }

  it('includes nextDueDate when it falls in the range', () => {
    expect(expectedOccurrencesInRange(rule, { startDate: '2026-08-01', endDate: '2026-08-31' }))
      .toEqual(['2026-08-10'])
  })

  it('does not invent occurrences before nextDueDate (already confirmed/skipped)', () => {
    expect(expectedOccurrencesInRange(rule, { startDate: '2026-07-01', endDate: '2026-07-31' }))
      .toEqual([])
  })

  it('lists remaining monthly dates across a quarter', () => {
    expect(expectedOccurrencesInRange(rule, { startDate: '2026-08-01', endDate: '2026-10-31' }))
      .toEqual(['2026-08-10', '2026-09-10', '2026-10-10'])
  })

  it('returns nothing for inactive rules', () => {
    expect(expectedOccurrencesInRange({ ...rule, active: false }, { startDate: '2026-08-01', endDate: '2026-08-31' }))
      .toEqual([])
  })
})
