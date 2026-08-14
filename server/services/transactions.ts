import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { Db } from '../database/client'
import { categories, installments, merchants, paymentMethods, transactions } from '../database/schema'
import type { TransactionRow, UserRow } from '../database/schema'
import type { TransactionCreateInput, TransactionListQuery, TransactionUpdateInput } from '../../shared/schemas/transaction'
import { transactionCreateSchema } from '../../shared/schemas/transaction'
import { normalizeMerchantName } from '../../shared/schemas/entities'
import type { SmartRepeatSuggestion, TransactionDto, TransactionListResponse } from '../../shared/types/api'
import { nowTimeInTz, zonedToUtc } from '../../shared/utils/dates'
import { parseAmountToMinor } from '../../shared/utils/money'
import { DomainError } from './errors'
import { toCategoryRef, toMerchantRef, toPaymentMethodRef, toTransactionDto } from './mappers'
import { assertCategoryOwned, assertMerchantOwned, assertPaymentMethodsOwned } from './ownership'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

const fromPm = alias(paymentMethods, 'from_pm')
const toPm = alias(paymentMethods, 'to_pm')

// ---------------------------------------------------------------------------
// Merchant resolution
// ---------------------------------------------------------------------------

export async function resolveMerchant(
  db: Db,
  userId: string,
  input: { merchantId?: string | null, merchantName?: string | null, categoryId?: string | null },
): Promise<string | null> {
  if (input.merchantId) {
    await assertMerchantOwned(db, userId, input.merchantId)
    return input.merchantId
  }
  const name = input.merchantName?.trim()
  if (!name) return null

  const normalized = normalizeMerchantName(name)
  const [existing] = await db.select().from(merchants)
    .where(and(eq(merchants.userId, userId), eq(merchants.normalizedName, normalized))).limit(1)
  if (existing) return existing.id

  const [created] = await db.insert(merchants).values({
    userId,
    name,
    normalizedName: normalized,
    defaultCategoryId: input.categoryId ?? null,
  }).returning()
  return created!.id
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function assertRefsOwned(db: Db, userId: string, data: {
  categoryId?: string | null
  paymentMethodId?: string | null
  fromPaymentMethodId?: string | null
  toPaymentMethodId?: string | null
}) {
  if (data.categoryId) await assertCategoryOwned(db, userId, data.categoryId)
  const pmIds = [data.paymentMethodId, data.fromPaymentMethodId, data.toPaymentMethodId].filter((x): x is string => !!x)
  await assertPaymentMethodsOwned(db, userId, pmIds)
}

export async function createTransaction(
  db: Db,
  user: ServiceUser,
  input: TransactionCreateInput,
  links?: { installmentId?: string, installmentPaymentId?: string, recurringId?: string },
): Promise<TransactionDto> {
  if (input.type === 'transfer' && input.fromPaymentMethodId && input.fromPaymentMethodId === input.toPaymentMethodId) {
    throw new DomainError('Source and destination must differ', 422)
  }

  // Idempotent replay: if the client-generated id already exists for this
  // user, return the existing record instead of duplicating it.
  if (input.id) {
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, input.id)).limit(1)
    if (existing) {
      if (existing.userId !== user.id) throw new DomainError('Conflicting identifier', 409)
      return getTransaction(db, user, existing.id)
    }
  }

  await assertRefsOwned(db, user.id, input)
  const merchantId = input.type === 'transfer'
    ? null
    : await resolveMerchant(db, user.id, input)

  const time = input.time ?? nowTimeInTz(user.timezone)
  const occurredAt = zonedToUtc(input.date, time, user.timezone)

  const [row] = await db.insert(transactions).values({
    ...(input.id ? { id: input.id } : {}),
    userId: user.id,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    occurredAt,
    localDate: input.date,
    localTime: time.slice(0, 5),
    categoryId: input.type === 'transfer' ? null : input.categoryId ?? null,
    paymentMethodId: input.type === 'transfer' ? null : input.paymentMethodId ?? null,
    fromPaymentMethodId: input.type === 'transfer' ? input.fromPaymentMethodId ?? null : null,
    toPaymentMethodId: input.type === 'transfer' ? input.toPaymentMethodId ?? null : null,
    merchantId,
    note: input.note || null,
    tags: input.tags?.length ? input.tags : null,
    installmentId: links?.installmentId ?? null,
    installmentPaymentId: links?.installmentPaymentId ?? null,
    recurringId: links?.recurringId ?? null,
  }).returning()

  return getTransaction(db, user, row!.id)
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function baseSelect(db: Db) {
  return db.select({
    tx: transactions,
    category: categories,
    paymentMethod: paymentMethods,
    fromPaymentMethod: fromPm,
    toPaymentMethod: toPm,
    merchant: merchants,
    installmentTitle: installments.title,
  })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .leftJoin(fromPm, eq(transactions.fromPaymentMethodId, fromPm.id))
    .leftJoin(toPm, eq(transactions.toPaymentMethodId, toPm.id))
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .leftJoin(installments, eq(transactions.installmentId, installments.id))
}

function rowToDto(r: Awaited<ReturnType<ReturnType<typeof baseSelect>['execute']>>[number]): TransactionDto {
  return toTransactionDto(r.tx, {
    category: r.category,
    paymentMethod: r.paymentMethod,
    fromPaymentMethod: r.fromPaymentMethod,
    toPaymentMethod: r.toPaymentMethod,
    merchant: r.merchant,
    installmentTitle: r.installmentTitle,
  })
}

export async function getTransaction(db: Db, user: ServiceUser, id: string): Promise<TransactionDto> {
  const rows = await baseSelect(db).where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1)
  if (!rows[0]) throw new DomainError('Transaction not found', 404)
  return rowToDto(rows[0])
}

// ---------------------------------------------------------------------------
// List with filters + keyset pagination
// ---------------------------------------------------------------------------

interface Cursor {
  s: TransactionListQuery['sort']
  /** occurredAt epoch ms or amountMinor depending on sort */
  v: number
  id: string
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

function decodeCursor(raw: string | undefined, sort: TransactionListQuery['sort']): Cursor | null {
  if (!raw) return null
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Cursor
    if (c.s !== sort || typeof c.v !== 'number' || typeof c.id !== 'string') return null
    return c
  }
  catch {
    return null
  }
}

export async function listTransactions(db: Db, user: ServiceUser, query: TransactionListQuery): Promise<TransactionListResponse> {
  const conds: (SQL | undefined)[] = [eq(transactions.userId, user.id)]

  if (query.type) conds.push(eq(transactions.type, query.type))
  if (query.categoryId) conds.push(eq(transactions.categoryId, query.categoryId))
  if (query.merchantId) conds.push(eq(transactions.merchantId, query.merchantId))
  if (query.paymentMethodId) {
    conds.push(or(
      eq(transactions.paymentMethodId, query.paymentMethodId),
      eq(transactions.fromPaymentMethodId, query.paymentMethodId),
      eq(transactions.toPaymentMethodId, query.paymentMethodId),
    ))
  }
  if (query.startDate) conds.push(gte(transactions.localDate, query.startDate))
  if (query.endDate) conds.push(lte(transactions.localDate, query.endDate))
  if (query.minAmountMinor != null) conds.push(gte(transactions.amountMinor, query.minAmountMinor))
  if (query.maxAmountMinor != null) conds.push(lte(transactions.amountMinor, query.maxAmountMinor))
  if (query.source === 'installment') conds.push(isNotNull(transactions.installmentId))
  if (query.source === 'recurring') conds.push(isNotNull(transactions.recurringId))
  if (query.source === 'manual') conds.push(and(isNull(transactions.installmentId), isNull(transactions.recurringId)))

  if (query.q) {
    const term = `%${query.q}%`
    const ors: (SQL | undefined)[] = [
      ilike(transactions.note, term),
      ilike(merchants.name, term),
      ilike(categories.name, term),
      ilike(paymentMethods.name, term),
      ilike(fromPm.name, term),
      ilike(toPm.name, term),
      ilike(installments.title, term),
    ]
    const asAmount = parseAmountToMinor(query.q, user.preferredCurrency)
    if (asAmount != null && asAmount > 0) ors.push(eq(transactions.amountMinor, asAmount))
    conds.push(or(...ors.filter(Boolean) as SQL[]))
  }

  // Keyset cursor
  const cursor = decodeCursor(query.cursor, query.sort)
  if (cursor) {
    const cid = cursor.id
    switch (query.sort) {
      case 'newest': {
        const at = new Date(cursor.v)
        conds.push(or(sql`${transactions.occurredAt} < ${at}`, and(eq(transactions.occurredAt, at), sql`${transactions.id} < ${cid}`)))
        break
      }
      case 'oldest': {
        const at = new Date(cursor.v)
        conds.push(or(sql`${transactions.occurredAt} > ${at}`, and(eq(transactions.occurredAt, at), sql`${transactions.id} > ${cid}`)))
        break
      }
      case 'amount_desc':
        conds.push(or(sql`${transactions.amountMinor} < ${cursor.v}`, and(eq(transactions.amountMinor, cursor.v), sql`${transactions.id} < ${cid}`)))
        break
      case 'amount_asc':
        conds.push(or(sql`${transactions.amountMinor} > ${cursor.v}`, and(eq(transactions.amountMinor, cursor.v), sql`${transactions.id} > ${cid}`)))
        break
    }
  }

  const where = and(...conds.filter(Boolean) as SQL[])

  const orderBy = {
    newest: [desc(transactions.occurredAt), desc(transactions.id)],
    oldest: [asc(transactions.occurredAt), asc(transactions.id)],
    amount_desc: [desc(transactions.amountMinor), desc(transactions.id)],
    amount_asc: [asc(transactions.amountMinor), asc(transactions.id)],
  }[query.sort]

  const rows = await baseSelect(db).where(where).orderBy(...orderBy).limit(query.limit + 1)

  // Total (without cursor conditions) — rebuild base filters minus cursor
  const totalConds = conds.filter(Boolean) as SQL[]
  // Cheap approach: run count with the same filters except the cursor keyset.
  // We rebuild instead of reusing `where` because the cursor cond was pushed last.
  const countWhere = cursor ? and(...totalConds.slice(0, totalConds.length - 1)) : where
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`cast(count(*) as int)` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .leftJoin(fromPm, eq(transactions.fromPaymentMethodId, fromPm.id))
    .leftJoin(toPm, eq(transactions.toPaymentMethodId, toPm.id))
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .leftJoin(installments, eq(transactions.installmentId, installments.id))
    .where(countWhere)

  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows
  const last = page[page.length - 1]

  let nextCursor: string | null = null
  if (hasMore && last) {
    const v = query.sort === 'newest' || query.sort === 'oldest'
      ? last.tx.occurredAt.getTime()
      : last.tx.amountMinor
    nextCursor = encodeCursor({ s: query.sort, v, id: last.tx.id })
  }

  return { items: page.map(rowToDto), nextCursor, total: n }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTransaction(db: Db, user: ServiceUser, id: string, patch: TransactionUpdateInput): Promise<TransactionDto> {
  const [existing] = await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1)
  if (!existing) throw new DomainError('Transaction not found', 404)

  // Installment payment transactions stay consistent with the payment record:
  // only cosmetic fields are editable here.
  if (existing.installmentPaymentId) {
    const allowed = ['note', 'merchantId', 'merchantName', 'tags'] as const
    const attempted = Object.keys(patch).filter(k => patch[k as keyof TransactionUpdateInput] !== undefined)
    const disallowed = attempted.filter(k => !allowed.includes(k as typeof allowed[number]))
    if (disallowed.length > 0) {
      throw new DomainError('This transaction is linked to an installment payment. Edit the payment record on the installment page instead.', 409)
    }
  }

  // Build the merged candidate and re-validate the full shape
  const candidate = {
    type: patch.type ?? existing.type,
    amountMinor: patch.amountMinor ?? existing.amountMinor,
    currency: patch.currency ?? existing.currency,
    date: patch.date ?? existing.localDate,
    time: patch.time ?? existing.localTime,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    paymentMethodId: patch.paymentMethodId !== undefined ? patch.paymentMethodId : existing.paymentMethodId,
    fromPaymentMethodId: patch.fromPaymentMethodId !== undefined ? patch.fromPaymentMethodId : existing.fromPaymentMethodId,
    toPaymentMethodId: patch.toPaymentMethodId !== undefined ? patch.toPaymentMethodId : existing.toPaymentMethodId,
    merchantId: patch.merchantId !== undefined ? patch.merchantId : existing.merchantId,
    merchantName: patch.merchantName ?? null,
    note: patch.note !== undefined ? patch.note : existing.note,
    tags: patch.tags !== undefined ? patch.tags : (existing.tags ?? undefined),
  }

  // Type switches clear now-invalid references
  if (candidate.type === 'transfer') {
    candidate.categoryId = null
    candidate.paymentMethodId = null
    candidate.merchantId = null
  }
  else {
    candidate.fromPaymentMethodId = null
    candidate.toPaymentMethodId = null
  }

  const parsed = transactionCreateSchema.safeParse(candidate)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) fields[issue.path.join('.')] = issue.message
    throw new DomainError('Validation failed', 422, fields)
  }
  const data = parsed.data

  await assertRefsOwned(db, user.id, data)
  const merchantId = data.type === 'transfer' ? null : await resolveMerchant(db, user.id, data)

  const occurredAt = zonedToUtc(data.date, data.time ?? existing.localTime, user.timezone)

  await db.update(transactions).set({
    type: data.type,
    amountMinor: data.amountMinor,
    currency: data.currency,
    occurredAt,
    localDate: data.date,
    localTime: (data.time ?? existing.localTime).slice(0, 5),
    categoryId: data.categoryId ?? null,
    paymentMethodId: data.paymentMethodId ?? null,
    fromPaymentMethodId: data.fromPaymentMethodId ?? null,
    toPaymentMethodId: data.toPaymentMethodId ?? null,
    merchantId,
    note: data.note || null,
    tags: data.tags?.length ? data.tags : null,
    updatedAt: new Date(),
  }).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))

  return getTransaction(db, user, id)
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTransaction(db: Db, user: ServiceUser, id: string): Promise<void> {
  const [existing] = await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1)
  if (!existing) throw new DomainError('Transaction not found', 404)

  if (existing.installmentPaymentId) {
    throw new DomainError('This transaction records an installment payment. Delete the payment from the installment page so the schedule stays accurate.', 409)
  }

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
}

// ---------------------------------------------------------------------------
// Smart Repeat — deterministic suggestions from the user's own history
// ---------------------------------------------------------------------------

export async function smartRepeatSuggestions(db: Db, user: ServiceUser, q: string | undefined, limit = 6): Promise<SmartRepeatSuggestion[]> {
  const conds: (SQL | undefined)[] = [
    eq(transactions.userId, user.id),
    inArray(transactions.type, ['expense', 'income']),
  ]
  if (q?.trim()) {
    const term = `%${q.trim()}%`
    conds.push(or(ilike(merchants.name, term), ilike(transactions.note, term), ilike(categories.name, term)))
  }

  const rows = await db.select({
    tx: transactions,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .where(and(...conds.filter(Boolean) as SQL[]))
    .orderBy(desc(transactions.occurredAt))
    .limit(400)

  const groups = new Map<string, { count: number, last: typeof rows[number] }>()
  for (const r of rows) {
    const key = [r.tx.type, r.tx.merchantId ?? '-', r.tx.categoryId ?? '-', r.tx.paymentMethodId ?? '-', r.tx.amountMinor, r.tx.currency].join('|')
    const g = groups.get(key)
    if (g) {
      g.count++
    }
    else {
      groups.set(key, { count: 1, last: r })
    }
  }

  const scored = [...groups.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.count - a.count || b.last.tx.occurredAt.getTime() - a.last.tx.occurredAt.getTime())
    .slice(0, limit)

  return scored.map(({ key, count, last }) => ({
    key,
    label: last.merchant?.name || last.tx.note || last.category?.name || (last.tx.type === 'income' ? 'Income' : 'Expense'),
    type: last.tx.type,
    amountMinor: last.tx.amountMinor,
    currency: last.tx.currency,
    categoryId: last.tx.categoryId,
    category: toCategoryRef(last.category),
    paymentMethodId: last.tx.paymentMethodId,
    paymentMethod: toPaymentMethodRef(last.paymentMethod),
    merchantId: last.tx.merchantId,
    merchant: toMerchantRef(last.merchant),
    note: last.tx.note,
    useCount: count,
    lastUsedAt: last.tx.occurredAt.toISOString(),
  }))
}
