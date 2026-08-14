import { eq } from 'drizzle-orm'
import { changePasswordSchema } from '../../../shared/schemas/auth'
import { useDb } from '../../database/client'
import { users } from '../../database/schema'

export default defineApiHandler(async (event) => {
  rateLimit(event, { key: 'change-password', max: 5, windowMs: 60_000 })
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, changePasswordSchema)
  const db = await useDb()

  if (user.passwordHash) {
    const ok = input.currentPassword && await verifyUserPassword(user.passwordHash, input.currentPassword)
    if (!ok) throw createError({ statusCode: 400, statusMessage: 'Your current password is incorrect' })
  }

  const passwordHash = await hashUserPassword(input.newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))
  return { ok: true }
})
