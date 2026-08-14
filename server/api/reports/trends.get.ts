import { z } from 'zod'
import { useDb } from '../../database/client'
import { trendReport } from '../../services/reports'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const range = periodFromQuery(event, user.timezone)
  const { granularity } = validatedQuery(event, z.object({ granularity: z.enum(['day', 'month']).optional() }).loose())

  // Auto: use daily buckets for short ranges, monthly for long ones
  const days = (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86_400_000
  const g = granularity ?? (days <= 62 ? 'day' : 'month')

  const db = await useDb()
  return { granularity: g, points: await trendReport(db, user, range, g) }
})
