import { z } from 'zod'
import { useDb } from '../../database/client'
import { smartRepeatSuggestions } from '../../services/transactions'

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(12).default(6),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { q, limit } = validatedQuery(event, querySchema)
  const db = await useDb()
  return { items: await smartRepeatSuggestions(db, user, q, limit) }
})
