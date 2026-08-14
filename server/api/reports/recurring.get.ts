import { useDb } from '../../database/client'
import { recurringReport } from '../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const range = periodFromQuery(event, user.timezone)
  const db = await useDb()
  return recurringReport(db, user, range)
})
