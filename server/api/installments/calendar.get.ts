import { z } from 'zod'
import { zIsoDate } from '../../../shared/schemas/common'
import { useDb } from '../../database/client'
import { installmentCalendar } from '../../services/installments'

const querySchema = z.object({
  startDate: zIsoDate,
  endDate: zIsoDate,
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const range = validatedQuery(event, querySchema)
  const db = await useDb()
  return { items: await installmentCalendar(db, user, range) }
})
