import { budgetCreateSchema } from '../../../shared/schemas/budget'
import { useDb } from '../../database/client'
import { createBudget } from '../../services/budgets'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, budgetCreateSchema)
  const db = await useDb()
  await createBudget(db, user, input)
  setResponseStatus(event, 201)
  return { ok: true }
})
