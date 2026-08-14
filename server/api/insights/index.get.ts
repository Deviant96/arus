import { z } from 'zod'
import { zMonthString } from '../../../shared/schemas/common'
import { todayInTz } from '../../../shared/utils/dates'
import { useDb } from '../../database/client'
import { generateInsights } from '../../services/insights'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { month: monthParam } = validatedQuery(event, z.object({ month: zMonthString.optional() }))
  const month = monthParam ?? todayInTz(user.timezone).slice(0, 7)
  const db = await useDb()
  return { month, items: await generateInsights(db, user, month) }
})
