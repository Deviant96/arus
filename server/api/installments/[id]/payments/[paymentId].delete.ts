import { useDb } from '../../../../database/client'
import { deleteInstallmentPayment } from '../../../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const item = await deleteInstallmentPayment(db, user, getRouterParam(event, 'id')!, getRouterParam(event, 'paymentId')!)
  return { item }
})
