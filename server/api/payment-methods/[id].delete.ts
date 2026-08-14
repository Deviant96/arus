import { and, eq, or, sql } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { installments, paymentMethods, recurringRules, transactions } from '../../database/schema'

/** Same policy as categories: archive when referenced, delete when unused. */
export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const [existing] = await db.select().from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id))).limit(1)
  if (!existing) notFound('Payment method not found')

  const [{ used } = { used: 0 }] = await db.select({
    used: sql<number>`cast(
      (select count(*) from ${transactions} where ${transactions.paymentMethodId} = ${id} or ${transactions.fromPaymentMethodId} = ${id} or ${transactions.toPaymentMethodId} = ${id})
      + (select count(*) from ${installments} where ${installments.paymentMethodId} = ${id})
      + (select count(*) from ${recurringRules} where ${recurringRules.paymentMethodId} = ${id})
    as int)`,
  }).from(sql`(select 1) as one`)

  if (used > 0) {
    await db.update(paymentMethods).set({ active: false, updatedAt: new Date() })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)))
    return { archived: true, deleted: false, message: 'This payment method is used by existing records, so it was archived instead of deleted.' }
  }

  await db.delete(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)))
  return { archived: false, deleted: true }
})
