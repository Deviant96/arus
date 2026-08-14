import { z } from 'zod'
import { zAmountMinor, zAmountMinorZero, zCurrency, zIsoDate, zNote, zTime, zUuid } from './common'

export const INSTALLMENT_STATUSES = ['active', 'completed'] as const
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number]

/**
 * Effective status of a single scheduled installment item.
 * `late` is derived (unpaid or partially paid past its due date) — it is never
 * stored, so that "what actually happened" stays the source of truth.
 */
export const INSTALLMENT_ITEM_STATUSES = ['upcoming', 'partially_paid', 'paid', 'late', 'skipped'] as const
export type InstallmentItemStatus = (typeof INSTALLMENT_ITEM_STATUSES)[number]

export const installmentCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    categoryId: zUuid,
    paymentMethodId: zUuid,
    merchantId: zUuid.optional().nullable(),
    currency: zCurrency.default('IDR'),
    totalAmountMinor: zAmountMinor,
    downPaymentMinor: zAmountMinorZero.default(0),
    interestMinor: zAmountMinorZero.default(0),
    feesMinor: zAmountMinorZero.default(0),
    count: z.number().int().min(1, 'At least 1 installment').max(240),
    /** Optional explicit monthly amount; when omitted it is computed. */
    expectedInstallmentMinor: zAmountMinor.optional(),
    firstDueDate: zIsoDate,
    /** Anchor day-of-month for due dates; defaults to firstDueDate's day. */
    dueDay: z.number().int().min(1).max(31).optional(),
    note: zNote,
    /** Record the down payment as an actual expense transaction now. */
    createDownPaymentTransaction: z.boolean().default(false),
    /** Link an existing expense transaction as the purchase/parent. */
    parentTransactionId: zUuid.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.downPaymentMinor > data.totalAmountMinor)
      ctx.addIssue({ code: 'custom', path: ['downPaymentMinor'], message: 'Down payment cannot exceed the purchase amount' })
    if (data.createDownPaymentTransaction && data.downPaymentMinor <= 0)
      ctx.addIssue({ code: 'custom', path: ['downPaymentMinor'], message: 'Down payment must be greater than zero to record it' })
  })
export type InstallmentCreateInput = z.infer<typeof installmentCreateSchema>

/**
 * Editing the schedule definition. Historical (paid) items are never touched;
 * only future expectations are recalculated.
 */
export const installmentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  categoryId: zUuid.optional(),
  paymentMethodId: zUuid.optional(),
  merchantId: zUuid.optional().nullable(),
  note: zNote,
  /** New expected amount applied to future (unpaid, unskipped) items. */
  expectedInstallmentMinor: zAmountMinor.optional(),
  /** New due day applied to future items. */
  dueDay: z.number().int().min(1).max(31).optional(),
})
export type InstallmentUpdateInput = z.infer<typeof installmentUpdateSchema>

/** Override one scheduled occurrence (future amount change, skip, etc.). */
export const installmentItemUpdateSchema = z.object({
  expectedAmountMinor: zAmountMinor.optional(),
  dueDate: zIsoDate.optional(),
  skipped: z.boolean().optional(),
  note: zNote,
})
export type InstallmentItemUpdateInput = z.infer<typeof installmentItemUpdateSchema>

export const installmentPaymentCreateSchema = z.object({
  /** Client-generated UUID for offline idempotency. */
  id: zUuid.optional(),
  amountMinor: zAmountMinor,
  paidDate: zIsoDate,
  paidTime: zTime.optional(),
  paymentMethodId: zUuid.optional().nullable(),
  note: zNote,
})
export type InstallmentPaymentCreateInput = z.infer<typeof installmentPaymentCreateSchema>

export const installmentDeleteSchema = z.object({
  /**
   * keep_history: delete the parent + future unpaid schedule, but keep paid
   *   payment transactions in the ledger (they really happened).
   * future_only: keep the parent, remove remaining unpaid scheduled items.
   */
  mode: z.enum(['keep_history', 'future_only']),
})
export type InstallmentDeleteInput = z.infer<typeof installmentDeleteSchema>
