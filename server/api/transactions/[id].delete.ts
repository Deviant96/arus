import { useDb } from '../../database/client'
import { deleteTransaction } from '../../services/transactions'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  await deleteTransaction(db, user, getRouterParam(event, 'id')!)
  return { deleted: true }
})
