import { and, eq, sql } from 'drizzle-orm'
import { categoryCreateSchema } from '../../../shared/schemas/entities'
import { useDb } from '../../database/client'
import { categories } from '../../database/schema'
import { toCategoryDto } from '../../services/mappers'
import { assertCategoryOwned } from '../../services/ownership'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, categoryCreateSchema)
  const db = await useDb()

  const [dup] = await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.userId, user.id), sql`lower(${categories.name}) = ${input.name.toLowerCase()}`))
    .limit(1)
  if (dup) throw createError({ statusCode: 409, statusMessage: 'A category with this name already exists' })

  if (input.parentId) await assertCategoryOwned(db, user.id, input.parentId)

  const [row] = await db.insert(categories).values({
    userId: user.id,
    name: input.name,
    icon: input.icon || 'i-lucide-tag',
    color: input.color || '#64748b',
    parentId: input.parentId ?? null,
    sortOrder: 100,
  }).returning()

  return { item: toCategoryDto(row!) }
})
