import { installmentItemUpdateSchema } from '../../../../../shared/schemas/installment'
import { useDb } from '../../../../database/client'
import { updateInstallmentItem } from '../../../../services/installments'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, installmentItemUpdateSchema)
  const db = await useDb()
  const item = await updateInstallmentItem(db, user, getRouterParam(event, 'id')!, getRouterParam(event, 'itemId')!, input)
  return { item }
})
