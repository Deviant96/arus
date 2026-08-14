import { z } from 'zod'
import { zAmountMinor, zCurrency, zIsoDate, zNote, zTime, zUuid } from './common'

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

const transactionBase = z.object({
  /** Client-generated UUID so offline-created records keep a stable identity. */
  id: zUuid.optional(),
  type: z.enum(TRANSACTION_TYPES),
  amountMinor: zAmountMinor,
  currency: zCurrency.default('IDR'),
  /** Calendar date + time in the user's timezone. */
  date: zIsoDate,
  time: zTime.optional(),
  categoryId: zUuid.optional().nullable(),
  paymentMethodId: zUuid.optional().nullable(),
  fromPaymentMethodId: zUuid.optional().nullable(),
  toPaymentMethodId: zUuid.optional().nullable(),
  merchantId: zUuid.optional().nullable(),
  /** If set (and merchantId is not), the merchant is created/found by name. */
  merchantName: z.string().trim().max(120).optional().nullable(),
  note: zNote,
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
})

function validateTransactionShape(data: z.infer<typeof transactionBase>, ctx: z.core.$RefinementCtx) {
  if (data.type === 'expense') {
    if (!data.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required for an expense' })
    if (!data.paymentMethodId) ctx.addIssue({ code: 'custom', path: ['paymentMethodId'], message: 'Payment method is required' })
  }
  if (data.type === 'income') {
    if (!data.paymentMethodId) ctx.addIssue({ code: 'custom', path: ['paymentMethodId'], message: 'Payment method is required' })
  }
  if (data.type === 'transfer') {
    if (!data.fromPaymentMethodId) ctx.addIssue({ code: 'custom', path: ['fromPaymentMethodId'], message: 'Source is required' })
    if (!data.toPaymentMethodId) ctx.addIssue({ code: 'custom', path: ['toPaymentMethodId'], message: 'Destination is required' })
    if (data.fromPaymentMethodId && data.toPaymentMethodId && data.fromPaymentMethodId === data.toPaymentMethodId)
      ctx.addIssue({ code: 'custom', path: ['toPaymentMethodId'], message: 'Source and destination must differ' })
    if (data.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Transfers do not take a category' })
  }
}

export const transactionCreateSchema = transactionBase.superRefine(validateTransactionShape)
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>

export const transactionUpdateSchema = transactionBase.omit({ id: true }).partial()
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

export const transactionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(200).optional(),
  q: z.string().trim().max(120).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  categoryId: zUuid.optional(),
  paymentMethodId: zUuid.optional(),
  merchantId: zUuid.optional(),
  startDate: zIsoDate.optional(),
  endDate: zIsoDate.optional(),
  minAmountMinor: z.coerce.number().int().nonnegative().optional(),
  maxAmountMinor: z.coerce.number().int().nonnegative().optional(),
  source: z.enum(['all', 'manual', 'installment', 'recurring']).default('all'),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).default('newest'),
})
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>

// ---------------------------------------------------------------------------
// Favorites (transaction templates)
// ---------------------------------------------------------------------------

export const favoriteCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  type: z.enum(['income', 'expense']),
  amountMinor: zAmountMinor,
  currency: zCurrency.default('IDR'),
  categoryId: zUuid.optional().nullable(),
  paymentMethodId: zUuid.optional().nullable(),
  merchantId: zUuid.optional().nullable(),
  note: zNote,
})
export const favoriteUpdateSchema = favoriteCreateSchema.partial().extend({
  sortOrder: z.number().int().min(0).max(10000).optional(),
})
export type FavoriteCreateInput = z.infer<typeof favoriteCreateSchema>
export type FavoriteUpdateInput = z.infer<typeof favoriteUpdateSchema>
