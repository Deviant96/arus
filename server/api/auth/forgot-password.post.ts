import { forgotPasswordSchema } from '../../../shared/schemas/auth'
import { useDb } from '../../database/client'
import { passwordResetTokens } from '../../database/schema'
import { findUserByEmail } from '../../services/users'

export default defineApiHandler(async (event) => {
  rateLimit(event, { key: 'forgot', max: 5, windowMs: 300_000 })
  const input = await validatedBody(event, forgotPasswordSchema)
  const db = await useDb()

  const user = await findUserByEmail(db, input.email)
  // Always return the same response — never reveal whether the email exists.
  if (user && user.passwordHash) {
    const token = randomToken(32)
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const appUrl = process.env.NUXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`

    // Without an SMTP integration the reset link is printed to the server
    // log. Wire up a mail provider here for production use.
    // The raw token is emailed (or, without SMTP, printed once to stdout
    // in development). It is stored only as a SHA-256 hash.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[auth] Password reset for ${user.email}: ${resetUrl}`)
    }
    else {
      console.log(`[auth] Password reset requested for user ${user.id}`)
    }
  }

  return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' }
})
