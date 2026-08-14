import { and, eq, gt, isNull } from 'drizzle-orm'
import { resetPasswordSchema } from '../../../shared/schemas/auth'
import { useDb } from '../../database/client'
import { passwordResetTokens, users } from '../../database/schema'

export default defineApiHandler(async (event) => {
  rateLimit(event, { key: 'reset', max: 5, windowMs: 300_000 })
  const input = await validatedBody(event, resetPasswordSchema)
  const db = await useDb()

  const [token] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, sha256Hex(input.token)),
    isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, new Date()),
  )).limit(1)

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired. Request a new one.' })
  }

  const passwordHash = await hashUserPassword(input.password)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, token.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, token.id))

  await setUserSession(event, { user: { id: token.userId } })
  return { ok: true }
})
