import { z } from 'zod'
import { zAmountMinor, zMonthString, zUuid } from './common'

export const budgetCreateSchema = z.object({
  categoryId: zUuid,
  amountMinor: zAmountMinor,
  /** null = applies to every month; 'YYYY-MM' = only that month (override). */
  month: zMonthString.optional().nullable(),
})
export const budgetUpdateSchema = z.object({
  amountMinor: zAmountMinor.optional(),
  month: zMonthString.optional().nullable(),
  active: z.boolean().optional(),
})
export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>
