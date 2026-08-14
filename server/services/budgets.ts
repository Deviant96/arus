import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import { budgets, categories, transactions } from '../database/schema'
import type { BudgetRow, UserRow } from '../database/schema'
import type { BudgetCreateInput, BudgetUpdateInput } from '../../shared/schemas/budget'
import type { BudgetDto } from '../../shared/types/api'
import { monthStringRange } from '../../shared/utils/dates'
import { percentOf } from '../../shared/utils/money'
import { DomainError } from './errors'
import { toCategoryRef } from './mappers'
import { assertCategoryOwned } from './ownership'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

/**
 * Effective budgets for a month: a month-specific budget (month = 'YYYY-MM')
 * overrides the recurring monthly budget (month = null) for the same category.
 */
export function resolveEffectiveBudgets(rows: BudgetRow[], month: string): BudgetRow[] {
  const monthly = rows.filter(b => b.month === null && b.active)
  const specific = rows.filter(b => b.month === month && b.active)
  const overridden = new Set(specific.map(b => b.categoryId))
  return [...specific, ...monthly.filter(b => !overridden.has(b.categoryId))]
}

export async function listBudgets(db: Db, user: ServiceUser, month: string): Promise<BudgetDto[]> {
  const rows = await db.select({ budget: budgets, category: categories })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, user.id))
    .orderBy(asc(budgets.createdAt))

  const effective = resolveEffectiveBudgets(rows.map(r => r.budget), month)
  const effectiveIds = new Set(effective.map(b => b.id))
  const catById = new Map(rows.map(r => [r.budget.id, r.category]))

  const range = monthStringRange(month)
  const catIds = [...new Set(effective.map(b => b.categoryId))]

  const spent = catIds.length
    ? await db.select({
        categoryId: transactions.categoryId,
        total: sql<number>`cast(coalesce(sum(${transactions.amountMinor}), 0) as bigint)`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, user.id),
          eq(transactions.type, 'expense'), // transfers never count as spending
          eq(transactions.currency, user.preferredCurrency),
          gte(transactions.localDate, range.startDate),
          lte(transactions.localDate, range.endDate),
          inArray(transactions.categoryId, catIds),
        ))
        .groupBy(transactions.categoryId)
    : []

  const spentByCat = new Map(spent.map(s => [s.categoryId, Number(s.total)]))

  return effective
    .filter(b => effectiveIds.has(b.id))
    .map((b) => {
      const spentMinor = spentByCat.get(b.categoryId) ?? 0
      return {
        id: b.id,
        categoryId: b.categoryId,
        category: toCategoryRef(catById.get(b.id)),
        amountMinor: b.amountMinor,
        currency: b.currency,
        month: b.month,
        active: b.active,
        spentMinor,
        remainingMinor: b.amountMinor - spentMinor,
        percent: percentOf(spentMinor, b.amountMinor),
      }
    })
    .sort((a, b) => b.percent - a.percent)
}

/** All budget rows (for the settings/manage view, including inactive). */
export async function listAllBudgets(db: Db, user: ServiceUser, month: string): Promise<BudgetDto[]> {
  const rows = await db.select({ budget: budgets, category: categories })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, user.id))
    .orderBy(asc(budgets.createdAt))

  const range = monthStringRange(month)
  const catIds = [...new Set(rows.map(r => r.budget.categoryId))]
  const spent = catIds.length
    ? await db.select({
        categoryId: transactions.categoryId,
        total: sql<number>`cast(coalesce(sum(${transactions.amountMinor}), 0) as bigint)`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, user.id),
          eq(transactions.type, 'expense'),
          eq(transactions.currency, user.preferredCurrency),
          gte(transactions.localDate, range.startDate),
          lte(transactions.localDate, range.endDate),
          inArray(transactions.categoryId, catIds),
        ))
        .groupBy(transactions.categoryId)
    : []
  const spentByCat = new Map(spent.map(s => [s.categoryId, Number(s.total)]))

  return rows.map(({ budget: b, category }) => {
    const spentMinor = spentByCat.get(b.categoryId) ?? 0
    return {
      id: b.id,
      categoryId: b.categoryId,
      category: toCategoryRef(category),
      amountMinor: b.amountMinor,
      currency: b.currency,
      month: b.month,
      active: b.active,
      spentMinor,
      remainingMinor: b.amountMinor - spentMinor,
      percent: percentOf(spentMinor, b.amountMinor),
    }
  })
}

export async function createBudget(db: Db, user: ServiceUser, input: BudgetCreateInput): Promise<void> {
  await assertCategoryOwned(db, user.id, input.categoryId)

  const dupConds = [
    eq(budgets.userId, user.id),
    eq(budgets.categoryId, input.categoryId),
    input.month ? eq(budgets.month, input.month) : isNull(budgets.month),
  ]
  const [dup] = await db.select({ id: budgets.id }).from(budgets).where(and(...dupConds)).limit(1)
  if (dup) throw new DomainError(input.month ? 'A budget for this category and month already exists' : 'A monthly budget for this category already exists', 409)

  await db.insert(budgets).values({
    userId: user.id,
    categoryId: input.categoryId,
    amountMinor: input.amountMinor,
    currency: user.preferredCurrency,
    month: input.month ?? null,
  })
}

export async function updateBudget(db: Db, user: ServiceUser, id: string, input: BudgetUpdateInput): Promise<void> {
  const [row] = await db.select().from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).limit(1)
  if (!row) throw new DomainError('Budget not found', 404)

  await db.update(budgets).set({
    amountMinor: input.amountMinor ?? row.amountMinor,
    month: input.month !== undefined ? input.month : row.month,
    active: input.active ?? row.active,
    updatedAt: new Date(),
  }).where(eq(budgets.id, id))
}

export async function deleteBudget(db: Db, user: ServiceUser, id: string): Promise<void> {
  const [row] = await db.select({ id: budgets.id }).from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).limit(1)
  if (!row) throw new DomainError('Budget not found', 404)
  await db.delete(budgets).where(eq(budgets.id, id))
}
