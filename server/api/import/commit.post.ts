import { z } from 'zod'
import { zAmountMinor, zCurrency, zIsoDate, zTime } from '../../../shared/schemas/common'
import { useDb } from '../../database/client'
import { commitImportRows } from '../../services/import'

const rowSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amountMinor: zAmountMinor,
  currency: zCurrency,
  date: zIsoDate,
  time: zTime.nullable(),
  categoryName: z.string().trim().max(120).nullable(),
  paymentMethodName: z.string().trim().max(120).nullable(),
  toPaymentMethodName: z.string().trim().max(120).nullable(),
  merchantName: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(500).nullable(),
})

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(5000),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  // Server-side re-validation: the client can't sneak invalid rows through.
  const { rows } = await validatedBody(event, schema)
  const db = await useDb()
  return commitImportRows(db, user, rows)
})
