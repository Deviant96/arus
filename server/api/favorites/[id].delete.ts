import { and, eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { favorites } from '../../database/schema'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const [existing] = await db.select({ id: favorites.id }).from(favorites)
    .where(and(eq(favorites.id, id), eq(favorites.userId, user.id))).limit(1)
  if (!existing) notFound('Favorite not found')

  await db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, user.id)))
  return { deleted: true }
})
