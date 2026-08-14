import { z } from 'zod'
import { SUPPORTED_CURRENCIES } from '../utils/money'
import { isValidIsoDate } from '../utils/dates'

export const zUuid = z.uuid()

export const zCurrency = z
  .string()
  .trim()
  .toUpperCase()
  .refine(c => (SUPPORTED_CURRENCIES as readonly string[]).includes(c), 'Unsupported currency code')

/** Positive integer amount in minor units (> 0). */
export const zAmountMinor = z
  .number()
  .int('Amount must be an integer (minor units)')
  .positive('Amount must be greater than zero')
  .max(Number.MAX_SAFE_INTEGER)

/** Non-negative integer amount in minor units (>= 0). */
export const zAmountMinorZero = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const zIsoDate = z
  .string()
  .refine(isValidIsoDate, 'Invalid date (expected YYYY-MM-DD)')

export const zTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time (expected HH:mm)')

export const zMonthString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month (expected YYYY-MM)')

export const zNote = z.string().trim().max(500).optional().nullable()

export const zName = z.string().trim().min(1, 'Required').max(120)

export const zColor = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Invalid color').optional().nullable()

export const zPagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
})

export const zPeriodQuery = z.object({
  period: z.enum(['today', 'this_week', 'this_month', 'last_month', '3m', '6m', '1y', 'custom']).default('this_month'),
  startDate: zIsoDate.optional(),
  endDate: zIsoDate.optional(),
})
export type PeriodQuery = z.infer<typeof zPeriodQuery>
