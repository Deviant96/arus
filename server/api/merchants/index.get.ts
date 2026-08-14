import { desc, eq, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../database/client'
import { merchants, transactions } from '../../database/schema'
import { toMerchantDto } from '../../services/mappers'

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { q, limit } = validatedQuery(event, querySchema)
  const db = await useDb()

  const conds = [eq(merchants.userId, user.id)]
  if (q) conds.push(ilike(merchants.name, `%${q}%`))

  // Sort by recency of use so autocomplete surfaces relevant merchants first.
  const rows = await db.select({
    merchant: merchants,
    lastUsedAt: sql<string | null>`max(${transactions.occurredAt})`,
    txCount: sql<number>`cast(count(${transactions.id}) as int)`,
  })
    .from(merchants)
    .leftJoin(transactions, eq(transactions.merchantId, merchants.id))
    .where(and(...conds))
    .groupBy(merchants.id)
    .orderBy(desc(sql`max(${transactions.occurredAt})`), desc(merchants.createdAt))
    .limit(limit)

  return {
    items: rows.map(r => toMerchantDto(r.merchant, {
      transactionCount: r.txCount,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt) : null,
    })),
  }
})
