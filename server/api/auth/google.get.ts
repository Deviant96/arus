import { eq } from 'drizzle-orm'
import { useDb } from '../../database/client'
import { users } from '../../database/schema'
import { bootstrapUserDefaults } from '../../services/users'

/**
 * Google OAuth (nuxt-auth-utils). Linking policy:
 *  - Existing user with this googleId → sign in.
 *  - Existing user with the same (Google-verified) email → link googleId.
 *  - Otherwise → create a fresh account with defaults.
 */
export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['email', 'profile'],
  },
  async onSuccess(event, { user: googleUser }) {
    const db = await useDb()
    const googleId = String(googleUser.sub)
    const email = String(googleUser.email ?? '').toLowerCase()

    let [existing] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1)

    if (!existing && email && googleUser.email_verified) {
      const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (byEmail) {
        await db.update(users).set({
          googleId,
          avatarUrl: byEmail.avatarUrl || googleUser.picture || null,
          updatedAt: new Date(),
        }).where(eq(users.id, byEmail.id))
        existing = { ...byEmail, googleId }
      }
    }

    if (!existing) {
      if (!email) return sendRedirect(event, '/auth/login?error=google_no_email')
      const [created] = await db.insert(users).values({
        name: String(googleUser.name ?? email.split('@')[0]),
        email,
        googleId,
        avatarUrl: googleUser.picture ? String(googleUser.picture) : null,
      }).returning()
      await bootstrapUserDefaults(db, created!.id)
      existing = created!
    }

    await setUserSession(event, { user: { id: existing.id } })
    return sendRedirect(event, '/')
  },
  onError(event) {
    return sendRedirect(event, '/auth/login?error=google_failed')
  },
})
