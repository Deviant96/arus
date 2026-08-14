import { describe, expect, it } from 'vitest'
import { computeSchedule, effectiveItemStatus } from '../server/services/installments'

describe('computeSchedule', () => {
  it('splits principal + interest + fees evenly, remainder on last', () => {
    const s = computeSchedule({
      totalAmountMinor: 12_000_000,
      downPaymentMinor: 2_000_000,
      interestMinor: 500_000,
      feesMinor: 0,
      count: 12,
    })
    expect(s.principalMinor).toBe(10_000_000)
    expect(s.financedTotalMinor).toBe(10_500_000)
    expect(s.amounts.reduce((a, b) => a + b, 0)).toBe(10_500_000)
    expect(s.amounts).toHaveLength(12)
    expect(s.expectedInstallmentMinor).toBe(s.amounts[0])
  })

  it('uses an explicit monthly amount and puts remainder on the last item', () => {
    const s = computeSchedule({
      totalAmountMinor: 12_000_000,
      downPaymentMinor: 0,
      interestMinor: 0,
      feesMinor: 0,
      count: 12,
      expectedInstallmentMinor: 1_000_000,
    })
    expect(s.amounts.slice(0, 11).every(a => a === 1_000_000)).toBe(true)
    expect(s.amounts[11]).toBe(1_000_000)
  })

  it('rejects a down payment larger than the purchase', () => {
    expect(() => computeSchedule({
      totalAmountMinor: 100,
      downPaymentMinor: 200,
      interestMinor: 0,
      feesMinor: 0,
      count: 3,
    })).toThrow(/Down payment/)
  })

  it('rejects an explicit monthly amount that would make the last installment non-positive', () => {
    expect(() => computeSchedule({
      totalAmountMinor: 1_000_000,
      downPaymentMinor: 0,
      interestMinor: 0,
      feesMinor: 0,
      count: 3,
      expectedInstallmentMinor: 500_000,
    })).toThrow(/too high/)
  })
})

describe('effectiveItemStatus', () => {
  it('derives late from due date vs today without storing it', () => {
    expect(effectiveItemStatus({ status: 'upcoming', dueDate: '2026-08-10', paidMinor: 0 }, '2026-08-14')).toBe('late')
    expect(effectiveItemStatus({ status: 'partially_paid', dueDate: '2026-08-10', paidMinor: 400_000 }, '2026-08-14')).toBe('late')
    expect(effectiveItemStatus({ status: 'upcoming', dueDate: '2026-08-20', paidMinor: 0 }, '2026-08-14')).toBe('upcoming')
    expect(effectiveItemStatus({ status: 'paid', dueDate: '2026-08-01', paidMinor: 875_000 }, '2026-08-14')).toBe('paid')
    expect(effectiveItemStatus({ status: 'skipped', dueDate: '2026-08-01', paidMinor: 0 }, '2026-08-14')).toBe('skipped')
  })
})
