import { and, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../database/client'
import { budgets, categories, favorites, installmentItems, installmentPayments, installments, merchants, paymentMethods, recurringRules, transactions } from '../database/schema'
import type { UserRow } from '../database/schema'
import { normalizeMerchantName } from '../../shared/schemas/entities'
import type { ImportCommitResponse, ImportRowPreview } from '../../shared/types/api'
import { isValidIsoDate, zonedToUtc } from '../../shared/utils/dates'
import { isSupportedCurrency, parseAmountToMinor } from '../../shared/utils/money'
import { DomainError } from './errors'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

// ---------------------------------------------------------------------------
// Row normalization + validation (CSV / XLSX)
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string> = {
  'type': 'type',
  'transaction type': 'type',
  'date': 'date',
  'tanggal': 'date',
  'time': 'time',
  'amount': 'amount',
  'jumlah': 'amount',
  'nominal': 'amount',
  'currency': 'currency',
  'category': 'category',
  'kategori': 'category',
  'payment method': 'payment_method',
  'payment_method': 'payment_method',
  'account': 'payment_method',
  'from': 'from_payment_method',
  'from_payment_method': 'from_payment_method',
  'to': 'to_payment_method',
  'to_payment_method': 'to_payment_method',
  'merchant': 'merchant',
  'note': 'note',
  'notes': 'note',
  'description': 'note',
  'tags': 'tags',
}

export function normalizeHeader(h: string): string | null {
  return HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, ' ')] ?? null
}

/** Accepts `YYYY-MM-DD`, `DD/MM/YYYY`, and `YYYY/MM/DD`. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (isValidIsoDate(s)) return s
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
    return isValidIsoDate(iso) ? iso : null
  }
  const ymd = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/)
  if (ymd) {
    const iso = `${ymd[1]}-${ymd[2]!.padStart(2, '0')}-${ymd[3]!.padStart(2, '0')}`
    return isValidIsoDate(iso) ? iso : null
  }
  return null
}

export function validateImportRow(raw: Record<string, string>, rowNumber: number, defaultCurrency: string): ImportRowPreview {
  const errors: string[] = []

  const typeRaw = (raw.type ?? 'expense').trim().toLowerCase()
  const type = ['income', 'expense', 'transfer'].includes(typeRaw) ? typeRaw as 'income' | 'expense' | 'transfer' : null
  if (!type) errors.push(`Unknown type "${raw.type}" (expected income, expense or transfer)`)

  const date = raw.date ? normalizeDate(raw.date) : null
  if (!date) errors.push(raw.date ? `Invalid date "${raw.date}"` : 'Date is required')

  let time: string | null = null
  if (raw.time?.trim()) {
    const m = raw.time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)/)
    if (m) time = `${m[1]!.padStart(2, '0')}:${m[2]}`
    else errors.push(`Invalid time "${raw.time}"`)
  }

  const currency = (raw.currency?.trim().toUpperCase() || defaultCurrency)
  if (!isSupportedCurrency(currency)) errors.push(`Unsupported currency "${currency}"`)

  const amountMinor = raw.amount ? parseAmountToMinor(raw.amount, currency) : null
  if (amountMinor == null || amountMinor <= 0) errors.push(raw.amount ? `Invalid amount "${raw.amount}"` : 'Amount is required')

  const categoryName = raw.category?.trim() || null
  const paymentMethodName = raw.payment_method?.trim() || raw.from_payment_method?.trim() || null
  const toPaymentMethodName = raw.to_payment_method?.trim() || null

  if (type === 'expense' && !categoryName) errors.push('Category is required for an expense')
  if ((type === 'expense' || type === 'income') && !paymentMethodName) errors.push('Payment method is required')
  if (type === 'transfer') {
    if (!paymentMethodName) errors.push('Source payment method is required for a transfer')
    if (!toPaymentMethodName) errors.push('Destination payment method is required for a transfer')
    if (paymentMethodName && toPaymentMethodName && paymentMethodName.toLowerCase() === toPaymentMethodName.toLowerCase())
      errors.push('Source and destination must differ')
  }

  const valid = errors.length === 0
  return {
    row: rowNumber,
    valid,
    errors,
    data: valid
      ? {
          type: type!,
          amountMinor: amountMinor!,
          currency,
          date: date!,
          time,
          categoryName: type === 'transfer' ? null : categoryName,
          paymentMethodName,
          toPaymentMethodName: type === 'transfer' ? toPaymentMethodName : null,
          merchantName: type === 'transfer' ? null : (raw.merchant?.trim() || null),
          note: raw.note?.trim() || null,
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

export async function commitImportRows(db: Db, user: ServiceUser, rows: NonNullable<ImportRowPreview['data']>[]): Promise<ImportCommitResponse> {
  if (rows.length === 0) throw new DomainError('There are no valid rows to import', 422)
  if (rows.length > 5000) throw new DomainError('Imports are limited to 5000 rows at a time', 422)

  // Resolve existing reference data by name (case-insensitive)
  const [cats, pms, merchs] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, user.id)),
    db.select().from(paymentMethods).where(eq(paymentMethods.userId, user.id)),
    db.select().from(merchants).where(eq(merchants.userId, user.id)),
  ])
  const catByName = new Map(cats.map(c => [c.name.toLowerCase(), c.id]))
  const pmByName = new Map(pms.map(p => [p.name.toLowerCase(), p.id]))
  const merchByNorm = new Map(merchs.map(m => [m.normalizedName, m.id]))

  let createdCategories = 0
  let createdPaymentMethods = 0
  let createdMerchants = 0

  async function ensureCategory(name: string): Promise<string> {
    const key = name.toLowerCase()
    const hit = catByName.get(key)
    if (hit) return hit
    const [row] = await db.insert(categories).values({
      userId: user.id,
      name,
      icon: 'i-lucide-tag',
      color: '#64748b',
      sortOrder: 200,
    }).returning()
    catByName.set(key, row!.id)
    createdCategories++
    return row!.id
  }

  async function ensurePaymentMethod(name: string): Promise<string> {
    const key = name.toLowerCase()
    const hit = pmByName.get(key)
    if (hit) return hit
    const [row] = await db.insert(paymentMethods).values({
      userId: user.id,
      name,
      type: 'other' as const,
      currency: user.preferredCurrency,
      sortOrder: 200,
    }).returning()
    pmByName.set(key, row!.id)
    createdPaymentMethods++
    return row!.id
  }

  async function ensureMerchant(name: string, categoryId: string | null): Promise<string> {
    const norm = normalizeMerchantName(name)
    const hit = merchByNorm.get(norm)
    if (hit) return hit
    const [row] = await db.insert(merchants).values({
      userId: user.id,
      name,
      normalizedName: norm,
      defaultCategoryId: categoryId,
    }).returning()
    merchByNorm.set(norm, row!.id)
    createdMerchants++
    return row!.id
  }

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    try {
      const isTransfer = row.type === 'transfer'
      const categoryId = !isTransfer && row.categoryName ? await ensureCategory(row.categoryName) : null
      const pmId = row.paymentMethodName ? await ensurePaymentMethod(row.paymentMethodName) : null
      const toPmId = isTransfer && row.toPaymentMethodName ? await ensurePaymentMethod(row.toPaymentMethodName) : null
      const merchantId = !isTransfer && row.merchantName ? await ensureMerchant(row.merchantName, categoryId) : null

      const time = row.time ?? '12:00'
      await db.insert(transactions).values({
        userId: user.id,
        type: row.type,
        amountMinor: row.amountMinor,
        currency: row.currency,
        occurredAt: zonedToUtc(row.date, time, user.timezone),
        localDate: row.date,
        localTime: time,
        categoryId,
        paymentMethodId: isTransfer ? null : pmId,
        fromPaymentMethodId: isTransfer ? pmId : null,
        toPaymentMethodId: toPmId,
        merchantId,
        note: row.note,
      })
      imported++
    }
    catch {
      skipped++
    }
  }

  return { imported, skipped, createdCategories, createdPaymentMethods, createdMerchants }
}

// ---------------------------------------------------------------------------
// JSON backup restore (idempotent by id)
// ---------------------------------------------------------------------------

export async function restoreJsonBackup(db: Db, user: ServiceUser, backup: any): Promise<Record<string, number>> {
  if (!backup || backup.format !== 'arus-backup' || !Array.isArray(backup.transactions)) {
    throw new DomainError('This file is not a valid Arus backup', 422)
  }

  const counts: Record<string, number> = {}
  const asDate = (v: unknown) => (v ? new Date(v as string) : new Date())

  async function insertAll<T extends { id?: string }>(
    label: string,
    rows: any[] | undefined,
    table: any,
    map: (r: any) => T | null,
  ) {
    counts[label] = 0
    if (!Array.isArray(rows)) return
    for (const raw of rows) {
      const mapped = map(raw)
      if (!mapped) continue
      try {
        await db.insert(table).values(mapped as never).onConflictDoNothing()
        counts[label]!++
      }
      catch {
        // Row-level failures (bad references etc.) are skipped, not fatal.
      }
    }
  }

  await insertAll('categories', backup.categories, categories, r => ({
    id: r.id, userId: user.id, name: String(r.name ?? 'Unnamed'), icon: r.icon ?? null, color: r.color ?? null,
    parentId: r.parentId ?? null, active: r.active ?? true, isSystem: r.isSystem ?? false, sortOrder: r.sortOrder ?? 0,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('paymentMethods', backup.paymentMethods, paymentMethods, r => ({
    id: r.id, userId: user.id, name: String(r.name ?? 'Unnamed'), type: r.type ?? 'other', currency: r.currency ?? 'IDR',
    active: r.active ?? true, metadata: r.metadata ?? null, sortOrder: r.sortOrder ?? 0,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('merchants', backup.merchants, merchants, r => ({
    id: r.id, userId: user.id, name: String(r.name ?? 'Unnamed'),
    normalizedName: r.normalizedName ?? normalizeMerchantName(String(r.name ?? '')),
    defaultCategoryId: r.defaultCategoryId ?? null,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('transactions', backup.transactions, transactions, (r) => {
    if (!r.id || !r.type || typeof r.amountMinor !== 'number') return null
    return {
      id: r.id, userId: user.id, type: r.type, amountMinor: r.amountMinor, currency: r.currency ?? 'IDR',
      occurredAt: asDate(r.occurredAt), localDate: r.localDate, localTime: r.localTime ?? '00:00',
      categoryId: r.categoryId ?? null, paymentMethodId: r.paymentMethodId ?? null,
      fromPaymentMethodId: r.fromPaymentMethodId ?? null, toPaymentMethodId: r.toPaymentMethodId ?? null,
      merchantId: r.merchantId ?? null, note: r.note ?? null, tags: r.tags ?? null,
      installmentId: null, installmentPaymentId: null, recurringId: null,
      createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
    }
  })

  await insertAll('installments', backup.installments, installments, r => ({
    id: r.id, userId: user.id, title: String(r.title ?? 'Installment'), status: r.status ?? 'active',
    currency: r.currency ?? 'IDR', totalAmountMinor: r.totalAmountMinor ?? 0, downPaymentMinor: r.downPaymentMinor ?? 0,
    principalMinor: r.principalMinor ?? 0, interestMinor: r.interestMinor ?? 0, feesMinor: r.feesMinor ?? 0,
    count: r.count ?? 1, expectedInstallmentMinor: r.expectedInstallmentMinor ?? 0,
    firstDueDate: r.firstDueDate, dueDay: r.dueDay ?? 1, categoryId: r.categoryId, paymentMethodId: r.paymentMethodId,
    merchantId: r.merchantId ?? null, note: r.note ?? null, parentTransactionId: r.parentTransactionId ?? null,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('installmentItems', backup.installmentItems, installmentItems, r => ({
    id: r.id, installmentId: r.installmentId, userId: user.id, sequence: r.sequence ?? 1,
    dueDate: r.dueDate, expectedAmountMinor: r.expectedAmountMinor ?? 0, paidMinor: r.paidMinor ?? 0,
    status: r.status ?? 'upcoming', note: r.note ?? null,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('installmentPayments', backup.installmentPayments, installmentPayments, r => ({
    id: r.id, userId: user.id, installmentId: r.installmentId, itemId: r.itemId,
    amountMinor: r.amountMinor ?? 0, paidDate: r.paidDate, paidTime: r.paidTime ?? '00:00',
    paymentMethodId: r.paymentMethodId ?? null, note: r.note ?? null, transactionId: r.transactionId ?? null,
    createdAt: asDate(r.createdAt),
  }))

  await insertAll('recurringRules', backup.recurringRules, recurringRules, r => ({
    id: r.id, userId: user.id, name: String(r.name ?? 'Recurring'), type: r.type ?? 'expense',
    amountMinor: r.amountMinor ?? 0, currency: r.currency ?? 'IDR', categoryId: r.categoryId ?? null,
    paymentMethodId: r.paymentMethodId, merchantId: r.merchantId ?? null, frequency: r.frequency ?? 'monthly',
    startDate: r.startDate, nextDueDate: r.nextDueDate, anchorDay: r.anchorDay ?? 1,
    active: r.active ?? true, note: r.note ?? null, lastConfirmedDate: r.lastConfirmedDate ?? null,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('budgets', backup.budgets, budgets, r => ({
    id: r.id, userId: user.id, categoryId: r.categoryId, amountMinor: r.amountMinor ?? 0,
    currency: r.currency ?? 'IDR', month: r.month ?? null, active: r.active ?? true,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  await insertAll('favorites', backup.favorites, favorites, r => ({
    id: r.id, userId: user.id, name: String(r.name ?? 'Favorite'), type: r.type ?? 'expense',
    amountMinor: r.amountMinor ?? 0, currency: r.currency ?? 'IDR', categoryId: r.categoryId ?? null,
    paymentMethodId: r.paymentMethodId ?? null, merchantId: r.merchantId ?? null, note: r.note ?? null,
    sortOrder: r.sortOrder ?? 0,
    createdAt: asDate(r.createdAt), updatedAt: asDate(r.updatedAt),
  }))

  // Restore links from payments to transactions where both sides exist
  const paymentRows = await db.select({ id: installmentPayments.id, txId: installmentPayments.transactionId })
    .from(installmentPayments).where(eq(installmentPayments.userId, user.id))
  const txIds = paymentRows.map(p => p.txId).filter((x): x is string => !!x)
  if (txIds.length) {
    const existing = await db.select({ id: transactions.id }).from(transactions)
      .where(and(eq(transactions.userId, user.id), inArray(transactions.id, txIds)))
    const existingSet = new Set(existing.map(e => e.id))
    for (const p of paymentRows) {
      if (p.txId && existingSet.has(p.txId)) {
        const [payment] = await db.select().from(installmentPayments).where(eq(installmentPayments.id, p.id)).limit(1)
        if (payment) {
          await db.update(transactions).set({
            installmentId: payment.installmentId,
            installmentPaymentId: payment.id,
          }).where(eq(transactions.id, p.txId))
        }
      }
    }
  }

  return counts
}
