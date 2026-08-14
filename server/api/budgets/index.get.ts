import { z } from 'zod'
import { zMonthString } from '../../../shared/schemas/common'
import { todayInTz } from '../../../shared/utils/dates'
import { useDb } from '../../database/client'
import { listAllBudgets, listBudgets } from '../../services/budgets'

const querySchema = z.object({
  month: zMonthString.optional(),
  all: z.coerce.boolean().default(false),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { month: monthParam, all } = validatedQuery(event, querySchema)
  const month = monthParam ?? todayInTz(user.timezone).slice(0, 7)
  const db = await useDb()
  const items = all ? await listAllBudgets(db, user, month) : await listBudgets(db, user, month)
  return { month, items }
})
