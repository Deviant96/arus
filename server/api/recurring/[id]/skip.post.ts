import { recurringSkipSchema } from '../../../../shared/schemas/recurring'
import { useDb } from '../../../database/client'
import { skipRecurring } from '../../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, recurringSkipSchema)
  const db = await useDb()
  return { item: await skipRecurring(db, user, getRouterParam(event, 'id')!, input.dueDate) }
})
