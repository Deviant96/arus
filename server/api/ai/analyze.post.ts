import { aiAnalyzeSchema } from '../../../shared/schemas/ai'
import { useDb } from '../../database/client'
import { analyzeMonth } from '../../services/ai/analyze'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  rateLimit(event, { key: 'ai-analyze', max: 6, windowMs: 60_000 })
  const { month } = await validatedBody(event, aiAnalyzeSchema)
  const db = await useDb()

  const encryptionKey = useRuntimeConfig(event).aiEncryptionKey
  if (!encryptionKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured on this server' })
  }

  return analyzeMonth(db, user, month, encryptionKey)
})
