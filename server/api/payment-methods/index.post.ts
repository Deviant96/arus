import { and, eq, sql } from 'drizzle-orm'
import { paymentMethodCreateSchema } from '../../../shared/schemas/entities'
import { isSupportedCurrency } from '../../../shared/utils/money'
import { useDb } from '../../database/client'
import { paymentMethods } from '../../database/schema'
import { toPaymentMethodDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, paymentMethodCreateSchema)
  const db = await useDb()

  if (!isSupportedCurrency(input.currency)) {
    throw createError({ statusCode: 422, statusMessage: 'Unsupported currency code' })
  }

  const [dup] = await db.select({ id: paymentMethods.id }).from(paymentMethods)
    .where(and(eq(paymentMethods.userId, user.id), sql`lower(${paymentMethods.name}) = ${input.name.toLowerCase()}`))
    .limit(1)
  if (dup) throw createError({ statusCode: 409, statusMessage: 'A payment method with this name already exists' })

  const [row] = await db.insert(paymentMethods).values({
    userId: user.id,
    name: input.name,
    type: input.type,
    currency: input.currency,
    metadata: input.metadata ?? null,
    sortOrder: 100,
  }).returning()

  return { item: toPaymentMethodDto(row!) }
})
