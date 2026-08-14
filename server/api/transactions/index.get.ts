import { transactionListQuerySchema } from '../../../shared/schemas/transaction'
import { useDb } from '../../database/client'
import { listTransactions } from '../../services/transactions'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = validatedQuery(event, transactionListQuerySchema)
  const db = await useDb()
  return listTransactions(db, user, query)
})
