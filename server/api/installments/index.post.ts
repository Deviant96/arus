import { installmentCreateSchema } from '../../../shared/schemas/installment'
import { useDb } from '../../database/client'
import { createInstallment } from '../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, installmentCreateSchema)
  const db = await useDb()
  const item = await createInstallment(db, user, input)
  setResponseStatus(event, 201)
  return { item }
})
