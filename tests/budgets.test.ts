import { describe, expect, it } from 'vitest'
import { resolveEffectiveBudgets } from '../server/services/budgets'
import type { BudgetRow } from '../server/database/schema'

function budget(partial: Partial<BudgetRow> & { id: string, categoryId: string, month: string | null }): BudgetRow {
  return {
    userId: 'u',
    amountMinor: 1_000_000,
    currency: 'IDR',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

describe('resolveEffectiveBudgets', () => {
  it('lets a month-specific budget override the recurring one for the same category', () => {
    const monthly = budget({ id: 'm', categoryId: 'food', month: null, amountMinor: 2_000_000 })
    const override = budget({ id: 'o', categoryId: 'food', month: '2026-08', amountMinor: 3_000_000 })
    const other = budget({ id: 't', categoryId: 'transport', month: null, amountMinor: 1_000_000 })

    const result = resolveEffectiveBudgets([monthly, override, other], '2026-08')
    expect(result.map(b => b.id).sort()).toEqual(['o', 't'])
    expect(result.find(b => b.categoryId === 'food')?.amountMinor).toBe(3_000_000)
  })

  it('falls back to the recurring budget when no override exists for that month', () => {
    const monthly = budget({ id: 'm', categoryId: 'food', month: null })
    const result = resolveEffectiveBudgets([monthly], '2026-09')
    expect(result.map(b => b.id)).toEqual(['m'])
  })

  it('ignores inactive budgets', () => {
    const inactive = budget({ id: 'x', categoryId: 'food', month: null, active: false })
    expect(resolveEffectiveBudgets([inactive], '2026-08')).toEqual([])
  })
})
