import { useDb } from '../../database/client'
import { reportSummary } from '../../services/reports'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const range = periodFromQuery(event, user.timezone)
  const db = await useDb()
  return reportSummary(db, user, range)
})
