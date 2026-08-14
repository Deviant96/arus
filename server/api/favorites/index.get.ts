import { asc, eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { categories, favorites, merchants, paymentMethods } from '../../database/schema'
import { toFavoriteDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const rows = await db.select({
    favorite: favorites,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(favorites)
    .leftJoin(categories, eq(favorites.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(favorites.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(favorites.merchantId, merchants.id))
    .where(eq(favorites.userId, user.id))
    .orderBy(asc(favorites.sortOrder), asc(favorites.createdAt))

  return { items: rows.map(r => toFavoriteDto(r.favorite, r)) }
})
