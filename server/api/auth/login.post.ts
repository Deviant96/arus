import { loginSchema } from '../../../shared/schemas/auth'
import { useDb } from '../../database/client'
import { toUserDto } from '../../services/mappers'
import { findUserByEmail } from '../../services/users'

export default defineApiHandler(async (event) => {
  rateLimit(event, { key: 'login', max: 10, windowMs: 60_000 })
  const input = await validatedBody(event, loginSchema)
  const db = await useDb()

  const user = await findUserByEmail(db, input.email)
  const invalid = () => createError({ statusCode: 401, statusMessage: 'Incorrect email or password' })

  if (!user) throw invalid()
  if (!user.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'This account uses Google sign-in. Use "Continue with Google" instead.' })
  }

  const ok = await verifyUserPassword(user.passwordHash, input.password)
  if (!ok) throw invalid()

  await setUserSession(event, { user: { id: user.id } })
  return { user: toUserDto(user) }
})
