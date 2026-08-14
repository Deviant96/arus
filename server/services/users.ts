import { eq } from 'drizzle-orm'
import type { Db } from '../database/client'
import { categories, paymentMethods, users } from '../database/schema'
import type { UserRow } from '../database/schema'

export const DEFAULT_CATEGORIES: { name: string, icon: string, color: string }[] = [
  { name: 'Food & Drinks', icon: 'i-lucide-utensils', color: '#f97316' },
  { name: 'Transportation', icon: 'i-lucide-car', color: '#3b82f6' },
  { name: 'Shopping', icon: 'i-lucide-shopping-bag', color: '#ec4899' },
  { name: 'Bills', icon: 'i-lucide-receipt', color: '#eab308' },
  { name: 'Entertainment', icon: 'i-lucide-clapperboard', color: '#8b5cf6' },
  { name: 'Health', icon: 'i-lucide-heart-pulse', color: '#ef4444' },
  { name: 'Education', icon: 'i-lucide-graduation-cap', color: '#06b6d4' },
  { name: 'Family', icon: 'i-lucide-users', color: '#22c55e' },
  { name: 'Subscription', icon: 'i-lucide-repeat', color: '#a855f7' },
  { name: 'Salary', icon: 'i-lucide-banknote', color: '#10b981' },
  { name: 'Other', icon: 'i-lucide-circle-ellipsis', color: '#64748b' },
]

/**
 * Give a fresh account its default system categories and a Cash payment
 * method so the first transaction can be recorded immediately.
 */
export async function bootstrapUserDefaults(db: Db, userId: string): Promise<void> {
  await db.insert(categories).values(DEFAULT_CATEGORIES.map((c, i) => ({
    userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    isSystem: true,
    sortOrder: i,
  })))

  await db.insert(paymentMethods).values({
    userId,
    name: 'Cash',
    type: 'cash' as const,
    currency: 'IDR',
    sortOrder: 0,
  })
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return user ?? null
}
