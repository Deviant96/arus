import { and, eq, ne } from 'drizzle-orm'
import { merchantUpdateSchema, normalizeMerchantName } from '../../../shared/schemas/entities'
import { useDb } from '../../database/client'
import { merchants } from '../../database/schema'
import { toMerchantDto } from '../../services/mappers'
import { assertCategoryOwned } from '../../services/ownership'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const input = await validatedBody(event, merchantUpdateSchema)
  const db = await useDb()

  const [existing] = await db.select().from(merchants)
    .where(and(eq(merchants.id, id), eq(merchants.userId, user.id))).limit(1)
  if (!existing) notFound('Merchant not found')

  if (input.defaultCategoryId) await assertCategoryOwned(db, user.id, input.defaultCategoryId)

  const name = input.name ?? existing.name
  const normalized = normalizeMerchantName(name)
  const [dup] = await db.select({ id: merchants.id }).from(merchants)
    .where(and(eq(merchants.userId, user.id), eq(merchants.normalizedName, normalized), ne(merchants.id, id))).limit(1)
  if (dup) throw createError({ statusCode: 409, statusMessage: 'Another merchant with this name already exists' })

  const [row] = await db.update(merchants).set({
    name,
    normalizedName: normalized,
    defaultCategoryId: input.defaultCategoryId !== undefined ? input.defaultCategoryId : existing.defaultCategoryId,
    updatedAt: new Date(),
  }).where(and(eq(merchants.id, id), eq(merchants.userId, user.id))).returning()

  return { item: toMerchantDto(row!) }
})
