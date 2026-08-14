import { favoriteCreateSchema } from '../../../shared/schemas/transaction'
import { useDb } from '../../database/client'
import { favorites } from '../../database/schema'
import { toFavoriteDto } from '../../services/mappers'
import { assertCategoryOwned, assertMerchantOwned, assertPaymentMethodsOwned } from '../../services/ownership'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, favoriteCreateSchema)
  const db = await useDb()

  if (input.categoryId) await assertCategoryOwned(db, user.id, input.categoryId)
  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])
  if (input.merchantId) await assertMerchantOwned(db, user.id, input.merchantId)

  const [row] = await db.insert(favorites).values({
    userId: user.id,
    name: input.name,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    categoryId: input.categoryId ?? null,
    paymentMethodId: input.paymentMethodId ?? null,
    merchantId: input.merchantId ?? null,
    note: input.note || null,
  }).returning()

  setResponseStatus(event, 201)
  return { item: toFavoriteDto(row!) }
})
