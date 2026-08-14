import { useDb } from '../../database/client'
import { getInstallmentDetail } from '../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  return { item: await getInstallmentDetail(db, user, getRouterParam(event, 'id')!) }
})
