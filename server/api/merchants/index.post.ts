import { and, eq } from 'drizzle-orm'
import { merchantCreateSchema, normalizeMerchantName } from '../../../shared/schemas/entities'
import { useDb } from '../../database/client'
import { merchants } from '../../database/schema'
import { toMerchantDto } from '../../services/mappers'
import { assertCategoryOwned } from '../../services/ownership'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, merchantCreateSchema)
  const db = await useDb()

  if (input.defaultCategoryId) await assertCategoryOwned(db, user.id, input.defaultCategoryId)

  const normalized = normalizeMerchantName(input.name)
  const [existing] = await db.select().from(merchants)
    .where(and(eq(merchants.userId, user.id), eq(merchants.normalizedName, normalized))).limit(1)
  if (existing) return { item: toMerchantDto(existing), existed: true }

  const [row] = await db.insert(merchants).values({
    userId: user.id,
    name: input.name,
    normalizedName: normalized,
    defaultCategoryId: input.defaultCategoryId ?? null,
  }).returning()

  return { item: toMerchantDto(row!), existed: false }
})
