import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import { categories, merchants, paymentMethods, recurringRules, transactions } from '../database/schema'
import type { RecurringRuleRow, UserRow } from '../database/schema'
import type { RecurringConfirmInput, RecurringCreateInput, RecurringUpdateInput } from '../../shared/schemas/recurring'
import type { RecurringDto, RecurringOccurrenceStatus, RecurringReport } from '../../shared/types/api'
import { isoDateParts, nextOccurrence, todayInTz } from '../../shared/utils/dates'
import type { RecurrenceFrequency } from '../../shared/utils/dates'
import { DomainError } from './errors'
import { toCategoryRef, toMerchantRef, toPaymentMethodRef } from './mappers'
import { assertCategoryOwned, assertMerchantOwned, assertPaymentMethodsOwned } from './ownership'
import { createTransaction } from './transactions'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

function occurrenceStatus(nextDueDate: string, today: string): RecurringOccurrenceStatus {
  if (nextDueDate < today) return 'overdue'
  if (nextDueDate === today) return 'due_today'
  return 'upcoming'
}

/**
 * Expected occurrences of a rule inside a date range, starting from the
 * rule's nextDueDate (everything before it was already confirmed/skipped).
 */
export function expectedOccurrencesInRange(
  rule: Pick<RecurringRuleRow, 'frequency' | 'nextDueDate' | 'anchorDay' | 'active'>,
  range: { startDate: string, endDate: string },
  cap = 60,
): string[] {
  if (!rule.active) return []
  const out: string[] = []
  let cur = rule.nextDueDate
  let guard = 0
  while (cur <= range.endDate && guard < cap) {
    if (cur >= range.startDate) out.push(cur)
    cur = nextOccurrence(rule.frequency as RecurrenceFrequency, cur, rule.anchorDay)
    guard++
  }
  return out
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function assertRefs(db: Db, userId: string, input: { categoryId?: string | null, paymentMethodId?: string, merchantId?: string | null }) {
  if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId)
  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, userId, [input.paymentMethodId])
  if (input.merchantId) await assertMerchantOwned(db, userId, input.merchantId)
}

export async function createRecurring(db: Db, user: ServiceUser, input: RecurringCreateInput): Promise<RecurringDto> {
  await assertRefs(db, user.id, input)
  const anchorDay = isoDateParts(input.startDate).day

  const [row] = await db.insert(recurringRules).values({
    userId: user.id,
    name: input.name,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    categoryId: input.categoryId ?? null,
    paymentMethodId: input.paymentMethodId,
    merchantId: input.merchantId ?? null,
    frequency: input.frequency,
    startDate: input.startDate,
    nextDueDate: input.startDate,
    anchorDay,
    note: input.note || null,
  }).returning()

  return getRecurring(db, user, row!.id)
}

export async function updateRecurring(db: Db, user: ServiceUser, id: string, input: RecurringUpdateInput): Promise<RecurringDto> {
  const [rule] = await db.select().from(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id))).limit(1)
  if (!rule) throw new DomainError('Recurring transaction not found', 404)

  await assertRefs(db, user.id, { categoryId: input.categoryId ?? undefined, paymentMethodId: input.paymentMethodId, merchantId: input.merchantId ?? undefined })

  const nextDueDate = input.nextDueDate ?? rule.nextDueDate
  const anchorDay = input.nextDueDate ? isoDateParts(input.nextDueDate).day : rule.anchorDay

  await db.update(recurringRules).set({
    name: input.name ?? rule.name,
    amountMinor: input.amountMinor ?? rule.amountMinor,
    categoryId: input.categoryId !== undefined ? input.categoryId : rule.categoryId,
    paymentMethodId: input.paymentMethodId ?? rule.paymentMethodId,
    merchantId: input.merchantId !== undefined ? input.merchantId : rule.merchantId,
    frequency: input.frequency ?? rule.frequency,
    nextDueDate,
    anchorDay,
    active: input.active ?? rule.active,
    note: input.note !== undefined ? input.note : rule.note,
    updatedAt: new Date(),
  }).where(eq(recurringRules.id, id))

  return getRecurring(db, user, id)
}

export async function deleteRecurring(db: Db, user: ServiceUser, id: string): Promise<void> {
  const [rule] = await db.select({ id: recurringRules.id }).from(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id))).limit(1)
  if (!rule) throw new DomainError('Recurring transaction not found', 404)
  // Past confirmed transactions keep existing (recurring_id becomes NULL via FK).
  await db.delete(recurringRules).where(eq(recurringRules.id, id))
}

async function loadRule(db: Db, user: ServiceUser, id: string) {
  const rows = await db.select({
    rule: recurringRules,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(recurringRules)
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(recurringRules.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(recurringRules.merchantId, merchants.id))
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)))
    .limit(1)
  if (!rows[0]) throw new DomainError('Recurring transaction not found', 404)
  return rows[0]
}

function toDto(row: Awaited<ReturnType<typeof loadRule>>, today: string, confirmedCount: number): RecurringDto {
  const r = row.rule
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    amountMinor: r.amountMinor,
    currency: r.currency,
    categoryId: r.categoryId,
    category: toCategoryRef(row.category),
    paymentMethodId: r.paymentMethodId,
    paymentMethod: toPaymentMethodRef(row.paymentMethod),
    merchantId: r.merchantId,
    merchant: toMerchantRef(row.merchant),
    frequency: r.frequency,
    startDate: r.startDate,
    nextDueDate: r.nextDueDate,
    anchorDay: r.anchorDay,
    active: r.active,
    note: r.note,
    occurrenceStatus: occurrenceStatus(r.nextDueDate, today),
    lastConfirmedDate: r.lastConfirmedDate,
    confirmedCount,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function getRecurring(db: Db, user: ServiceUser, id: string): Promise<RecurringDto> {
  const row = await loadRule(db, user, id)
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`cast(count(*) as int)` }).from(transactions)
    .where(and(eq(transactions.recurringId, id), eq(transactions.userId, user.id)))
  return toDto(row, todayInTz(user.timezone), n)
}

export async function listRecurring(db: Db, user: ServiceUser): Promise<RecurringDto[]> {
  const rows = await db.select({
    rule: recurringRules,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(recurringRules)
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(recurringRules.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(recurringRules.merchantId, merchants.id))
    .where(eq(recurringRules.userId, user.id))
    .orderBy(desc(recurringRules.active), asc(recurringRules.nextDueDate))

  const ids = rows.map(r => r.rule.id)
  const counts = ids.length
    ? await db.select({ id: transactions.recurringId, n: sql<number>`cast(count(*) as int)` })
        .from(transactions)
        .where(and(eq(transactions.userId, user.id), inArray(transactions.recurringId, ids)))
        .groupBy(transactions.recurringId)
    : []
  const countMap = new Map(counts.map(c => [c.id, c.n]))

  const today = todayInTz(user.timezone)
  return rows.map(r => toDto(r, today, countMap.get(r.rule.id) ?? 0))
}

// ---------------------------------------------------------------------------
// Confirm / skip an expected occurrence
// ---------------------------------------------------------------------------

export async function confirmRecurring(db: Db, user: ServiceUser, id: string, input: RecurringConfirmInput): Promise<RecurringDto> {
  const [rule] = await db.select().from(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id))).limit(1)
  if (!rule) throw new DomainError('Recurring transaction not found', 404)

  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])

  // The actual transaction reflects what really happened (amount/date may
  // differ from the expectation).
  await createTransaction(db, user, {
    ...(input.transactionId ? { id: input.transactionId } : {}),
    type: rule.type,
    amountMinor: input.amountMinor,
    currency: rule.currency,
    date: input.date,
    time: input.time,
    categoryId: rule.categoryId,
    paymentMethodId: input.paymentMethodId ?? rule.paymentMethodId,
    merchantId: rule.merchantId,
    note: input.note?.trim() || rule.name,
  } as never, { recurringId: rule.id })

  // Advance the expectation pointer past the confirmed occurrence.
  if (input.dueDate >= rule.nextDueDate) {
    const next = nextOccurrence(rule.frequency as RecurrenceFrequency, input.dueDate, rule.anchorDay)
    await db.update(recurringRules).set({
      nextDueDate: next,
      lastConfirmedDate: input.date,
      updatedAt: new Date(),
    }).where(eq(recurringRules.id, id))
  }
  else {
    await db.update(recurringRules).set({ lastConfirmedDate: input.date, updatedAt: new Date() }).where(eq(recurringRules.id, id))
  }

  return getRecurring(db, user, id)
}

export async function skipRecurring(db: Db, user: ServiceUser, id: string, dueDate: string): Promise<RecurringDto> {
  const [rule] = await db.select().from(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id))).limit(1)
  if (!rule) throw new DomainError('Recurring transaction not found', 404)

  if (dueDate >= rule.nextDueDate) {
    const next = nextOccurrence(rule.frequency as RecurrenceFrequency, dueDate, rule.anchorDay)
    await db.update(recurringRules).set({ nextDueDate: next, updatedAt: new Date() }).where(eq(recurringRules.id, id))
  }
  return getRecurring(db, user, id)
}

// ---------------------------------------------------------------------------
// Expected vs actual for a period (used by reports + dashboard)
// ---------------------------------------------------------------------------

export async function recurringReport(db: Db, user: ServiceUser, range: { startDate: string, endDate: string }): Promise<RecurringReport> {
  const rules = await db.select().from(recurringRules)
    .where(and(eq(recurringRules.userId, user.id), eq(recurringRules.currency, user.preferredCurrency)))

  const rows: RecurringReport['rows'] = []

  // Actual confirmed transactions in the range
  const confirmed = await db.select().from(transactions).where(and(
    eq(transactions.userId, user.id),
    gte(transactions.localDate, range.startDate),
    lte(transactions.localDate, range.endDate),
  ))
  const confirmedByRule = new Map<string, typeof confirmed>()
  for (const tx of confirmed) {
    if (!tx.recurringId) continue
    const arr = confirmedByRule.get(tx.recurringId) ?? []
    arr.push(tx)
    confirmedByRule.set(tx.recurringId, arr)
  }

  let expectedMinor = 0
  let expectedCount = 0
  let confirmedMinor = 0
  let confirmedCount = 0

  for (const rule of rules) {
    const actuals = confirmedByRule.get(rule.id) ?? []
    for (const tx of actuals) {
      confirmedMinor += rule.type === 'expense' ? tx.amountMinor : 0
      confirmedCount++
      rows.push({
        recurringId: rule.id,
        name: rule.name,
        dueDate: tx.localDate,
        expectedAmountMinor: rule.amountMinor,
        confirmed: true,
        actualAmountMinor: tx.amountMinor,
        type: rule.type,
      })
    }

    // Remaining expected occurrences in the range (not yet confirmed/skipped)
    for (const due of expectedOccurrencesInRange(rule, range)) {
      expectedMinor += rule.type === 'expense' ? rule.amountMinor : 0
      expectedCount++
      rows.push({
        recurringId: rule.id,
        name: rule.name,
        dueDate: due,
        expectedAmountMinor: rule.amountMinor,
        confirmed: false,
        actualAmountMinor: null,
        type: rule.type,
      })
    }
  }

  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return {
    currency: user.preferredCurrency,
    expectedMinor,
    expectedCount,
    confirmedMinor,
    confirmedCount,
    rows,
  }
}
