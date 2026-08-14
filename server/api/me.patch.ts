import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { updatePreferencesSchema, updateProfileSchema } from '../../shared/schemas/auth'
import { isSupportedCurrency } from '../../shared/utils/money'
import { useDb } from '../database/client'
import { users } from '../database/schema'
import { toUserDto } from '../services/mappers'
import { assertCategoryOwned, assertPaymentMethodsOwned } from '../services/ownership'

const schema = updateProfileSchema.extend(updatePreferencesSchema.shape)

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const input = await validatedBody(event, schema)
  const db = await useDb()

  if (input.preferredCurrency && !isSupportedCurrency(input.preferredCurrency)) {
    throw createError({ statusCode: 422, statusMessage: 'Unsupported currency code' })
  }
  if (input.timezone) {
    try {
      // Throws for invalid IANA names
      new Intl.DateTimeFormat('en-US', { timeZone: input.timezone })
    }
    catch {
      throw createError({ statusCode: 422, statusMessage: 'Invalid timezone' })
    }
  }
  if (input.defaultPaymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.defaultPaymentMethodId])
  if (input.defaultCategoryId) await assertCategoryOwned(db, user.id, input.defaultCategoryId)

  const [updated] = await db.update(users).set({
    name: input.name ?? user.name,
    avatarUrl: input.avatarUrl !== undefined ? (input.avatarUrl || null) : user.avatarUrl,
    preferredCurrency: input.preferredCurrency ?? user.preferredCurrency,
    timezone: input.timezone ?? user.timezone,
    defaultPaymentMethodId: input.defaultPaymentMethodId !== undefined ? input.defaultPaymentMethodId : user.defaultPaymentMethodId,
    defaultCategoryId: input.defaultCategoryId !== undefined ? input.defaultCategoryId : user.defaultCategoryId,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id)).returning()

  return { user: toUserDto(updated!) }
})
