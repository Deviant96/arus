import { useDb } from '../../database/client'
import { deleteBudget } from '../../services/budgets'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  await deleteBudget(db, user, getRouterParam(event, 'id')!)
  return { deleted: true }
})
