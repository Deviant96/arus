import { z } from 'zod'
import { useDb } from '../../database/client'
import { listInstallments } from '../../services/installments'

const querySchema = z.object({
  status: z.enum(['active', 'completed']).optional(),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { status } = validatedQuery(event, querySchema)
  const db = await useDb()
  return { items: await listInstallments(db, user, { status }) }
})
