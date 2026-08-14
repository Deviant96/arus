import { and, eq } from 'drizzle-orm'
import { categoryUpdateSchema } from '../../../shared/schemas/entities'
import { useDb } from '../../database/client'
import { categories } from '../../database/schema'
import { toCategoryDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const input = await validatedBody(event, categoryUpdateSchema)
  const db = await useDb()

  const [existing] = await db.select().from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).limit(1)
  if (!existing) notFound('Category not found')

  const [row] = await db.update(categories).set({
    name: input.name ?? existing.name,
    icon: input.icon !== undefined ? input.icon : existing.icon,
    color: input.color !== undefined ? input.color : existing.color,
    parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
    // Archiving keeps historical transactions intact — it only hides the
    // category from pickers.
    active: input.active ?? existing.active,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    updatedAt: new Date(),
  }).where(and(eq(categories.id, id), eq(categories.userId, user.id))).returning()

  return { item: toCategoryDto(row!) }
})
