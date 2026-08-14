import { z } from 'zod'
import { installmentUpdateSchema } from '../../../shared/schemas/installment'
import { useDb } from '../../database/client'
import { updateInstallment } from '../../services/installments'

const schema = installmentUpdateSchema.extend({
  /** When true, returns the change preview without saving anything. */
  dryRun: z.boolean().optional(),
})

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { dryRun, ...input } = await validatedBody(event, schema)
  const db = await useDb()
  return updateInstallment(db, user, getRouterParam(event, 'id')!, input, { dryRun })
})
