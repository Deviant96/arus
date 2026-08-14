import { recurringUpdateSchema } from '../../../shared/schemas/recurring'
import { useDb } from '../../database/client'
import { updateRecurring } from '../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, recurringUpdateSchema)
  const db = await useDb()
  return { item: await updateRecurring(db, user, getRouterParam(event, 'id')!, input) }
})
