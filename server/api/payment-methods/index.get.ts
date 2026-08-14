import { asc, eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { paymentMethods } from '../../database/schema'
import { toPaymentMethodDto } from '../../services/mappers'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const rows = await db.select().from(paymentMethods)
    .where(eq(paymentMethods.userId, user.id))
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name))
  return { items: rows.map(toPaymentMethodDto) }
})
