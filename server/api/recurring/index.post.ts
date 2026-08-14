import { recurringCreateSchema } from '../../../shared/schemas/recurring'
import { useDb } from '../../database/client'
import { createRecurring } from '../../services/recurring'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, recurringCreateSchema)
  const db = await useDb()
  const item = await createRecurring(db, user, input)
  setResponseStatus(event, 201)
  return { item }
})
