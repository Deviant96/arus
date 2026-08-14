import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../database/client'
import { categories, merchants, paymentMethods } from '../database/schema'
import { DomainError } from './errors'

/**
 * Multi-tenant safety helpers: every reference a user submits is verified to
 * belong to that user before it is written.
 */

export async function assertCategoryOwned(db: Db, userId: string, categoryId: string) {
  const [row] = await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId))).limit(1)
  if (!row) throw new DomainError('Category not found', 404)
}

export async function assertPaymentMethodsOwned(db: Db, userId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const rows = await db.select({ id: paymentMethods.id }).from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), inArray(paymentMethods.id, unique)))
  if (rows.length !== unique.length) throw new DomainError('Payment method not found', 404)
}

export async function assertMerchantOwned(db: Db, userId: string, merchantId: string) {
  const [row] = await db.select({ id: merchants.id }).from(merchants)
    .where(and(eq(merchants.id, merchantId), eq(merchants.userId, userId))).limit(1)
  if (!row) throw new DomainError('Merchant not found', 404)
}
