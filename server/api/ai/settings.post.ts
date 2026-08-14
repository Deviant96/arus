import { eq } from 'drizzle-orm'
import { aiSettingsSchema } from '../../../shared/schemas/ai'
import { useDb } from '../../database/client'
import { aiSettings } from '../../database/schema'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, aiSettingsSchema)
  const db = await useDb()

  const encryptionKey = useRuntimeConfig(event).aiEncryptionKey
  if (!encryptionKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI key storage is not configured on this server (NUXT_AI_ENCRYPTION_KEY missing)' })
  }

  const encryptedKey = encryptSecret(input.apiKey, encryptionKey)
  const keyLast4 = input.apiKey.slice(-4)

  const [existing] = await db.select({ id: aiSettings.id }).from(aiSettings).where(eq(aiSettings.userId, user.id)).limit(1)
  if (existing) {
    await db.update(aiSettings).set({
      provider: input.provider,
      model: input.model,
      encryptedKey,
      keyLast4,
      updatedAt: new Date(),
    }).where(eq(aiSettings.id, existing.id))
  }
  else {
    await db.insert(aiSettings).values({
      userId: user.id,
      provider: input.provider,
      model: input.model,
      encryptedKey,
      keyLast4,
    })
  }

  return { ok: true }
})
