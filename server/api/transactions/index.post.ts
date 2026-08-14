import { transactionCreateSchema } from '../../../shared/schemas/transaction'
import { useDb } from '../../database/client'
import { createTransaction } from '../../services/transactions'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, transactionCreateSchema)
  const db = await useDb()
  const item = await createTransaction(db, user, input)
  setResponseStatus(event, 201)
  return { item }
})
