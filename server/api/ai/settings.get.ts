import { eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { aiSettings } from '../../database/schema'
import type { AISettingsDto } from '../../../shared/types/api'

/** Returns provider + model + masked key only. The key itself never leaves the server. */
export default defineApiHandler(async (event): Promise<AISettingsDto> => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id)).limit(1)

  if (!row) return { configured: false, provider: null, model: null, keyMasked: null, updatedAt: null }

  return {
    configured: true,
    provider: row.provider,
    model: row.model,
    keyMasked: `••••••••${row.keyLast4}`,
    updatedAt: row.updatedAt.toISOString(),
  }
})
