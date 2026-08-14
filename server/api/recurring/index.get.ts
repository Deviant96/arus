import { useDb } from '../../database/client'
import { listRecurring } from '../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  return { items: await listRecurring(db, user) }
})
