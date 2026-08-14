import { useDb } from '../../database/client'
import { deleteRecurring } from '../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  await deleteRecurring(db, user, getRouterParam(event, 'id')!)
  return { deleted: true }
})
