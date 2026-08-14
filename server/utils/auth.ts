import type { H3Event } from 'h3'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDb } from '../database/client'
import { users } from '../database/schema'
import type { UserRow } from '../database/schema'

/**
 * Resolve the authenticated user (fresh from DB) or throw 401.
 * Cached per-request on event.context.
 */
export async function requireAuthUser(event: H3Event): Promise<UserRow> {
  if (event.context._authUser) return event.context._authUser as UserRow

  const session = await getUserSession(event)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in to continue' })
  }

  const db = await useDb()
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Please sign in to continue' })
  }

  event.context._authUser = user
  return user
}
