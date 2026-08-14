import { eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { aiSettings } from '../../database/schema'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  await db.delete(aiSettings).where(eq(aiSettings.userId, user.id))
  return { deleted: true }
})
