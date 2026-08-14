import { z } from 'zod'
import { zAmountMinor, zCurrency, zIsoDate, zNote, zTime, zUuid } from './common'

export const RECURRENCE_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const

export const recurringCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    type: z.enum(['income', 'expense']),
    amountMinor: zAmountMinor,
    currency: zCurrency.default('IDR'),
    categoryId: zUuid.optional().nullable(),
    paymentMethodId: zUuid,
    merchantId: zUuid.optional().nullable(),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    startDate: zIsoDate,
    note: zNote,
  })
  .superRefine((data, ctx) => {
    if (data.type === 'expense' && !data.categoryId)
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required for a recurring expense' })
  })
export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>

export const recurringUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amountMinor: zAmountMinor.optional(),
  categoryId: zUuid.optional().nullable(),
  paymentMethodId: zUuid.optional(),
  merchantId: zUuid.optional().nullable(),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  nextDueDate: zIsoDate.optional(),
  active: z.boolean().optional(),
  note: zNote,
})
export type RecurringUpdateInput = z.infer<typeof recurringUpdateSchema>

/** Confirm that an expected occurrence actually happened. */
export const recurringConfirmSchema = z.object({
  /** Client-generated transaction UUID for offline idempotency. */
  transactionId: zUuid.optional(),
  /** The expected occurrence being confirmed. */
  dueDate: zIsoDate,
  /** What actually happened (may differ from the expectation). */
  amountMinor: zAmountMinor,
  date: zIsoDate,
  time: zTime.optional(),
  paymentMethodId: zUuid.optional().nullable(),
  note: zNote,
})
export type RecurringConfirmInput = z.infer<typeof recurringConfirmSchema>

export const recurringSkipSchema = z.object({
  dueDate: zIsoDate,
})
