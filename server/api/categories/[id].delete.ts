import { and, eq, sql } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { budgets, categories, installments, recurringRules, transactions } from '../../database/schema'

/**
 * Hard delete is only allowed for unused categories. Categories that are
 * referenced anywhere must be archived instead — history is never destroyed.
 */
export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const [existing] = await db.select().from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).limit(1)
  if (!existing) notFound('Category not found')

  const [{ used } = { used: 0 }] = await db.select({
    used: sql<number>`cast(
      (select count(*) from ${transactions} where ${transactions.categoryId} = ${id})
      + (select count(*) from ${installments} where ${installments.categoryId} = ${id})
      + (select count(*) from ${recurringRules} where ${recurringRules.categoryId} = ${id})
      + (select count(*) from ${budgets} where ${budgets.categoryId} = ${id})
    as int)`,
  }).from(sql`(select 1) as one`)

  if (used > 0) {
    await db.update(categories).set({ active: false, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    return { archived: true, deleted: false, message: 'This category is used by existing records, so it was archived instead of deleted. Historical data is preserved.' }
  }

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)))
  return { archived: false, deleted: true }
})
