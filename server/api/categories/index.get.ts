import { asc, eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { categories } from '../../database/schema'
import { toCategoryDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const rows = await db.select().from(categories)
    .where(eq(categories.userId, user.id))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
  return { items: rows.map(toCategoryDto) }
})
