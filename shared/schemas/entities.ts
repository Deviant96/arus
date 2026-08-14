import { z } from 'zod'
import { zColor, zName, zUuid } from './common'

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categoryCreateSchema = z.object({
  name: zName,
  icon: z.string().trim().max(64).optional().nullable(),
  color: zColor,
  parentId: zUuid.optional().nullable(),
})
export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD_TYPES = ['cash', 'bank', 'e_wallet', 'credit_card', 'paylater', 'other'] as const
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]

export const paymentMethodCreateSchema = z.object({
  name: zName,
  type: z.enum(PAYMENT_METHOD_TYPES),
  currency: z.string().trim().toUpperCase().length(3).default('IDR'),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export const paymentMethodUpdateSchema = paymentMethodCreateSchema.partial().extend({
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
})
export type PaymentMethodCreateInput = z.infer<typeof paymentMethodCreateSchema>
export type PaymentMethodUpdateInput = z.infer<typeof paymentMethodUpdateSchema>

// ---------------------------------------------------------------------------
// Merchants
// ---------------------------------------------------------------------------

export const merchantCreateSchema = z.object({
  name: zName,
  defaultCategoryId: zUuid.optional().nullable(),
})
export const merchantUpdateSchema = merchantCreateSchema.partial()
export type MerchantCreateInput = z.infer<typeof merchantCreateSchema>
export type MerchantUpdateInput = z.infer<typeof merchantUpdateSchema>

/** Normalization used for merchant dedupe + autocomplete. */
export function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}
