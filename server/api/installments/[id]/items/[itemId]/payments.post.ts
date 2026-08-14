import { installmentPaymentCreateSchema } from '../../../../../../shared/schemas/installment'
import { useDb } from '../../../../../database/client'
import { recordInstallmentPayment } from '../../../../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, installmentPaymentCreateSchema)
  const db = await useDb()
  const item = await recordInstallmentPayment(db, user, getRouterParam(event, 'id')!, getRouterParam(event, 'itemId')!, input)
  setResponseStatus(event, 201)
  return { item }
})
