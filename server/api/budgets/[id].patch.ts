import { budgetUpdateSchema } from '../../../shared/schemas/budget'
import { useDb } from '../../database/client'
import { updateBudget } from '../../services/budgets'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, budgetUpdateSchema)
  const db = await useDb()
  await updateBudget(db, user, getRouterParam(event, 'id')!, input)
  return { ok: true }
})
