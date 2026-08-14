import { registerSchema } from '../../../shared/schemas/auth'
import { useDb } from '../../database/client'
import { users } from '../../database/schema'
import { toUserDto } from '../../services/mappers'
import { bootstrapUserDefaults, findUserByEmail } from '../../services/users'

export default defineApiHandler(async (event) => {
  rateLimit(event, { key: 'register', max: 5, windowMs: 60_000 })
  const input = await validatedBody(event, registerSchema)
  const db = await useDb()

  const existing = await findUserByEmail(db, input.email)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const passwordHash = await hashUserPassword(input.password)
  const [user] = await db.insert(users).values({
    name: input.name,
    email: input.email,
    passwordHash,
  }).returning()

  await bootstrapUserDefaults(db, user!.id)
  await setUserSession(event, { user: { id: user!.id } })

  return { user: toUserDto(user!) }
})
