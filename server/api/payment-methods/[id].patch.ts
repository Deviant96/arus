import { and, eq } from 'drizzle-orm'
import { paymentMethodUpdateSchema } from '../../../shared/schemas/entities'
import { useDb } from '../../database/client'
import { paymentMethods } from '../../database/schema'
import { toPaymentMethodDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const input = await validatedBody(event, paymentMethodUpdateSchema)
  const db = await useDb()

  const [existing] = await db.select().from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id))).limit(1)
  if (!existing) notFound('Payment method not found')

  const [row] = await db.update(paymentMethods).set({
    name: input.name ?? existing.name,
    type: input.type ?? existing.type,
    currency: input.currency ?? existing.currency,
    active: input.active ?? existing.active,
    metadata: input.metadata !== undefined ? input.metadata : existing.metadata,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: new Date(),
  }).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id))).returning()

  return { item: toPaymentMethodDto(row!) }
})
