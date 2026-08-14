import { recurringConfirmSchema } from '../../../../shared/schemas/recurring'
import { useDb } from '../../../database/client'
import { confirmRecurring } from '../../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, recurringConfirmSchema)
  const db = await useDb()
  return { item: await confirmRecurring(db, user, getRouterParam(event, 'id')!, input) }
})
