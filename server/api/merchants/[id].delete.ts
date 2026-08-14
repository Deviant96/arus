import { and, eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { merchants } from '../../database/schema'

/**
 * Merchants can always be deleted — transactions keep their history via
 * ON DELETE SET NULL (the merchant reference is descriptive, not financial).
 */
export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const [existing] = await db.select({ id: merchants.id }).from(merchants)
    .where(and(eq(merchants.id, id), eq(merchants.userId, user.id))).limit(1)
  if (!existing) notFound('Merchant not found')

  await db.delete(merchants).where(and(eq(merchants.id, id), eq(merchants.userId, user.id)))
  return { deleted: true }
})
