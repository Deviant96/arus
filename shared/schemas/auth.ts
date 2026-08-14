import { z } from 'zod'

export const zEmail = z.email('Enter a valid email').trim().toLowerCase().max(254)

export const zPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: zEmail,
  password: zPassword,
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, 'Password is required').max(128),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: zEmail,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: zPassword,
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.union([z.url().max(500), z.literal('')]).optional(),
})

export const updatePreferencesSchema = z.object({
  preferredCurrency: z.string().trim().toUpperCase().length(3).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  defaultPaymentMethodId: z.uuid().nullable().optional(),
  defaultCategoryId: z.uuid().nullable().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: zPassword,
})
