import { z } from 'zod'
import { useDb } from '../../database/client'
import { categoryBreakdown } from '../../services/reports'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const range = periodFromQuery(event, user.timezone)
  const { type } = validatedQuery(event, z.object({ type: z.enum(['expense', 'income']).default('expense') }).loose())
  const db = await useDb()
  return { items: await categoryBreakdown(db, user, range, type) }
})
