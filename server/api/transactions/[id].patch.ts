import { transactionUpdateSchema } from '../../../shared/schemas/transaction'
import { useDb } from '../../database/client'
import { updateTransaction } from '../../services/transactions'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, transactionUpdateSchema)
  const db = await useDb()
  return { item: await updateTransaction(db, user, getRouterParam(event, 'id')!, input) }
})
