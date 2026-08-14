import { and, eq } from 'drizzle-orm'
import { favoriteUpdateSchema } from '../../../shared/schemas/transaction'
import { useDb } from '../../database/client'
import { favorites } from '../../database/schema'
import { toFavoriteDto } from '../../services/mappers'
import { assertCategoryOwned, assertMerchantOwned, assertPaymentMethodsOwned } from '../../services/ownership'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const input = await validatedBody(event, favoriteUpdateSchema)
  const db = await useDb()

  const [existing] = await db.select().from(favorites)
    .where(and(eq(favorites.id, id), eq(favorites.userId, user.id))).limit(1)
  if (!existing) notFound('Favorite not found')

  if (input.categoryId) await assertCategoryOwned(db, user.id, input.categoryId)
  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])
  if (input.merchantId) await assertMerchantOwned(db, user.id, input.merchantId)

  const [row] = await db.update(favorites).set({
    name: input.name ?? existing.name,
    type: input.type ?? existing.type,
    amountMinor: input.amountMinor ?? existing.amountMinor,
    currency: input.currency ?? existing.currency,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    paymentMethodId: input.paymentMethodId !== undefined ? input.paymentMethodId : existing.paymentMethodId,
    merchantId: input.merchantId !== undefined ? input.merchantId : existing.merchantId,
    note: input.note !== undefined ? input.note : existing.note,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: new Date(),
  }).where(and(eq(favorites.id, id), eq(favorites.userId, user.id))).returning()

  return { item: toFavoriteDto(row!) }
})
