import { installmentDeleteSchema } from '../../../shared/schemas/installment'
import { useDb } from '../../database/client'
import { deleteInstallment } from '../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, installmentDeleteSchema)
  const db = await useDb()
  await deleteInstallment(db, user, getRouterParam(event, 'id')!, input)
  return { deleted: true }
})
