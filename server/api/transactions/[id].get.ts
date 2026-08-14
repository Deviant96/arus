import { useDb } from '../../database/client'
import { getTransaction } from '../../services/transactions'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  return { item: await getTransaction(db, user, getRouterParam(event, 'id')!) }
})
