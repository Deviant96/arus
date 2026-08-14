import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Db } from '../database/client'
import { installmentItems, installmentPayments, installments, merchants, paymentMethods, categories, transactions } from '../database/schema'
import type { InstallmentItemRow, InstallmentPaymentRow, InstallmentRow, UserRow } from '../database/schema'
import type { InstallmentCreateInput, InstallmentDeleteInput, InstallmentItemUpdateInput, InstallmentPaymentCreateInput, InstallmentUpdateInput } from '../../shared/schemas/installment'
import type { InstallmentCalendarItem, InstallmentDetailDto, InstallmentDto, InstallmentItemDto, InstallmentItemStatus, InstallmentPaymentDto } from '../../shared/types/api'
import { generateInstallmentDueDates, isoDateParts, todayInTz } from '../../shared/utils/dates'
import { splitEvenly } from '../../shared/utils/money'
import { DomainError } from './errors'
import { toCategoryRef, toMerchantRef, toPaymentMethodRef } from './mappers'
import { assertCategoryOwned, assertMerchantOwned, assertPaymentMethodsOwned } from './ownership'
import { createTransaction } from './transactions'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

// ---------------------------------------------------------------------------
// Pure calculations (unit-tested)
// ---------------------------------------------------------------------------

export interface ScheduleSpec {
  totalAmountMinor: number
  downPaymentMinor: number
  interestMinor: number
  feesMinor: number
  count: number
  expectedInstallmentMinor?: number
}

export interface ComputedSchedule {
  principalMinor: number
  financedTotalMinor: number
  /** The typical (base) monthly amount. */
  expectedInstallmentMinor: number
  /** Per-item expected amounts; the last item absorbs rounding remainder. */
  amounts: number[]
}

export function computeSchedule(spec: ScheduleSpec): ComputedSchedule {
  const principal = spec.totalAmountMinor - spec.downPaymentMinor
  if (principal < 0) throw new DomainError('Down payment cannot exceed the purchase amount', 422)
  const financed = principal + spec.interestMinor + spec.feesMinor
  if (financed <= 0) throw new DomainError('Nothing left to finance — the down payment already covers the purchase', 422)

  let amounts: number[]
  if (spec.expectedInstallmentMinor) {
    const base = spec.expectedInstallmentMinor
    const rest = financed - base * (spec.count - 1)
    if (rest <= 0) {
      throw new DomainError('The installment amount is too high for this schedule — the final installment would be zero or negative', 422)
    }
    amounts = Array.from({ length: spec.count }, (_, i) => (i === spec.count - 1 ? rest : base))
  }
  else {
    amounts = splitEvenly(financed, spec.count)
  }

  return {
    principalMinor: principal,
    financedTotalMinor: financed,
    expectedInstallmentMinor: amounts[0]!,
    amounts,
  }
}

/**
 * Effective status: `late` is derived, never stored. An item that is not
 * fully paid/skipped and whose due date has passed is late.
 */
export function effectiveItemStatus(item: Pick<InstallmentItemRow, 'status' | 'dueDate' | 'paidMinor'>, today: string): InstallmentItemStatus {
  if (item.status === 'paid' || item.status === 'skipped') return item.status
  if (item.dueDate < today) return 'late'
  return item.status
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createInstallment(db: Db, user: ServiceUser, input: InstallmentCreateInput): Promise<InstallmentDetailDto> {
  await assertCategoryOwned(db, user.id, input.categoryId)
  await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])
  if (input.merchantId) await assertMerchantOwned(db, user.id, input.merchantId)

  if (input.parentTransactionId) {
    const [parent] = await db.select({ id: transactions.id }).from(transactions)
      .where(and(eq(transactions.id, input.parentTransactionId), eq(transactions.userId, user.id))).limit(1)
    if (!parent) throw new DomainError('Parent transaction not found', 404)
  }

  const schedule = computeSchedule(input)
  const dueDay = input.dueDay ?? isoDateParts(input.firstDueDate).day
  const dueDates = generateInstallmentDueDates(input.firstDueDate, input.count, dueDay)

  const [inst] = await db.insert(installments).values({
    userId: user.id,
    title: input.title,
    currency: input.currency,
    totalAmountMinor: input.totalAmountMinor,
    downPaymentMinor: input.downPaymentMinor,
    principalMinor: schedule.principalMinor,
    interestMinor: input.interestMinor,
    feesMinor: input.feesMinor,
    count: input.count,
    expectedInstallmentMinor: schedule.expectedInstallmentMinor,
    firstDueDate: input.firstDueDate,
    dueDay,
    categoryId: input.categoryId,
    paymentMethodId: input.paymentMethodId,
    merchantId: input.merchantId ?? null,
    note: input.note || null,
    parentTransactionId: input.parentTransactionId ?? null,
  }).returning()

  await db.insert(installmentItems).values(dueDates.map((dueDate, i) => ({
    installmentId: inst!.id,
    userId: user.id,
    sequence: i + 1,
    dueDate,
    expectedAmountMinor: schedule.amounts[i]!,
  })))

  // Optionally record the down payment as an actual expense now.
  if (input.createDownPaymentTransaction && input.downPaymentMinor > 0 && !input.parentTransactionId) {
    const today = todayInTz(user.timezone)
    const dto = await createTransaction(db, user, {
      type: 'expense',
      amountMinor: input.downPaymentMinor,
      currency: input.currency,
      date: today,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      merchantId: input.merchantId ?? null,
      note: `Down payment — ${input.title}`,
    } as never, { installmentId: inst!.id })
    await db.update(installments).set({ parentTransactionId: dto.id }).where(eq(installments.id, inst!.id))
  }
  else if (input.parentTransactionId) {
    await db.update(transactions).set({ installmentId: inst!.id })
      .where(and(eq(transactions.id, input.parentTransactionId), eq(transactions.userId, user.id)))
  }

  return getInstallmentDetail(db, user, inst!.id)
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

async function loadInstallmentRow(db: Db, user: ServiceUser, id: string) {
  const rows = await db.select({
    inst: installments,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(installments)
    .leftJoin(categories, eq(installments.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(installments.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(installments.merchantId, merchants.id))
    .where(and(eq(installments.id, id), eq(installments.userId, user.id)))
    .limit(1)
  if (!rows[0]) throw new DomainError('Installment not found', 404)
  return rows[0]
}

function paymentToDto(p: InstallmentPaymentRow, sequence: number, pm?: { id: string, name: string, type: string } | null): InstallmentPaymentDto {
  return {
    id: p.id,
    installmentId: p.installmentId,
    itemId: p.itemId,
    sequence,
    amountMinor: p.amountMinor,
    paidDate: p.paidDate,
    paidTime: p.paidTime,
    paymentMethodId: p.paymentMethodId,
    paymentMethod: (pm as never) ?? null,
    note: p.note,
    transactionId: p.transactionId,
    createdAt: p.createdAt.toISOString(),
  }
}

function buildInstallmentDto(
  row: Awaited<ReturnType<typeof loadInstallmentRow>>,
  items: InstallmentItemRow[],
  today: string,
): InstallmentDto {
  const inst = row.inst
  const totalExpected = items.filter(i => i.status !== 'skipped').reduce((s, i) => s + i.expectedAmountMinor, 0)
  const totalPaid = items.reduce((s, i) => s + i.paidMinor, 0)
  const paidCount = items.filter(i => i.status === 'paid').length
  const lateCount = items.filter(i => effectiveItemStatus(i, today) === 'late').length
  const open = items
    .filter(i => i.status !== 'paid' && i.status !== 'skipped')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence)
  const next = open[0] ?? null

  return {
    id: inst.id,
    title: inst.title,
    status: inst.status,
    currency: inst.currency,
    totalAmountMinor: inst.totalAmountMinor,
    downPaymentMinor: inst.downPaymentMinor,
    principalMinor: inst.principalMinor,
    interestMinor: inst.interestMinor,
    feesMinor: inst.feesMinor,
    count: inst.count,
    expectedInstallmentMinor: inst.expectedInstallmentMinor,
    firstDueDate: inst.firstDueDate,
    dueDay: inst.dueDay,
    categoryId: inst.categoryId,
    category: toCategoryRef(row.category),
    paymentMethodId: inst.paymentMethodId,
    paymentMethod: toPaymentMethodRef(row.paymentMethod),
    merchantId: inst.merchantId,
    merchant: toMerchantRef(row.merchant),
    note: inst.note,
    parentTransactionId: inst.parentTransactionId,
    createdAt: inst.createdAt.toISOString(),
    paidCount,
    totalPaidMinor: totalPaid,
    totalExpectedMinor: totalExpected,
    remainingExpectedMinor: Math.max(0, totalExpected - totalPaid),
    nextItem: next
      ? {
          sequence: next.sequence,
          dueDate: next.dueDate,
          expectedAmountMinor: next.expectedAmountMinor,
          remainingMinor: Math.max(0, next.expectedAmountMinor - next.paidMinor),
          status: effectiveItemStatus(next, today),
        }
      : null,
    lateCount,
  }
}

export async function listInstallments(db: Db, user: ServiceUser, filter?: { status?: 'active' | 'completed' }): Promise<InstallmentDto[]> {
  const conds: SQL[] = [eq(installments.userId, user.id)]
  if (filter?.status) conds.push(eq(installments.status, filter.status))

  const rows = await db.select({
    inst: installments,
    category: categories,
    paymentMethod: paymentMethods,
    merchant: merchants,
  })
    .from(installments)
    .leftJoin(categories, eq(installments.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(installments.paymentMethodId, paymentMethods.id))
    .leftJoin(merchants, eq(installments.merchantId, merchants.id))
    .where(and(...conds))
    .orderBy(desc(installments.createdAt))

  if (rows.length === 0) return []
  const ids = rows.map(r => r.inst.id)
  const items = await db.select().from(installmentItems)
    .where(inArray(installmentItems.installmentId, ids))
    .orderBy(asc(installmentItems.sequence))

  const today = todayInTz(user.timezone)
  const byInst = new Map<string, InstallmentItemRow[]>()
  for (const it of items) {
    const arr = byInst.get(it.installmentId) ?? []
    arr.push(it)
    byInst.set(it.installmentId, arr)
  }

  return rows.map(r => buildInstallmentDto(r, byInst.get(r.inst.id) ?? [], today))
}

export async function getInstallmentDetail(db: Db, user: ServiceUser, id: string): Promise<InstallmentDetailDto> {
  const row = await loadInstallmentRow(db, user, id)
  const items = await db.select().from(installmentItems)
    .where(eq(installmentItems.installmentId, id))
    .orderBy(asc(installmentItems.sequence))

  const payments = await db.select({ p: installmentPayments, pm: paymentMethods })
    .from(installmentPayments)
    .leftJoin(paymentMethods, eq(installmentPayments.paymentMethodId, paymentMethods.id))
    .where(eq(installmentPayments.installmentId, id))
    .orderBy(asc(installmentPayments.paidDate), asc(installmentPayments.createdAt))

  const today = todayInTz(user.timezone)
  const seqByItem = new Map(items.map(i => [i.id, i.sequence]))
  const paymentsByItem = new Map<string, InstallmentPaymentDto[]>()
  for (const { p, pm } of payments) {
    const arr = paymentsByItem.get(p.itemId) ?? []
    arr.push(paymentToDto(p, seqByItem.get(p.itemId) ?? 0, pm ? { id: pm.id, name: pm.name, type: pm.type } : null))
    paymentsByItem.set(p.itemId, arr)
  }

  const itemDtos: InstallmentItemDto[] = items.map(i => ({
    id: i.id,
    installmentId: i.installmentId,
    sequence: i.sequence,
    dueDate: i.dueDate,
    expectedAmountMinor: i.expectedAmountMinor,
    paidMinor: i.paidMinor,
    remainingMinor: Math.max(0, i.expectedAmountMinor - i.paidMinor),
    status: effectiveItemStatus(i, today),
    note: i.note,
    payments: paymentsByItem.get(i.id) ?? [],
  }))

  return { ...buildInstallmentDto(row, items, today), items: itemDtos }
}

// ---------------------------------------------------------------------------
// Record a payment (the heart of "actual vs expected")
// ---------------------------------------------------------------------------

export async function recordInstallmentPayment(
  db: Db,
  user: ServiceUser,
  installmentId: string,
  itemId: string,
  input: InstallmentPaymentCreateInput,
): Promise<InstallmentDetailDto> {
  // Idempotent replay from offline queue
  if (input.id) {
    const [existing] = await db.select({ id: installmentPayments.id }).from(installmentPayments)
      .where(and(eq(installmentPayments.id, input.id), eq(installmentPayments.userId, user.id))).limit(1)
    if (existing) return getInstallmentDetail(db, user, installmentId)
  }

  const [inst] = await db.select().from(installments)
    .where(and(eq(installments.id, installmentId), eq(installments.userId, user.id))).limit(1)
  if (!inst) throw new DomainError('Installment not found', 404)

  const [item] = await db.select().from(installmentItems)
    .where(and(eq(installmentItems.id, itemId), eq(installmentItems.installmentId, installmentId))).limit(1)
  if (!item) throw new DomainError('Installment schedule item not found', 404)
  if (item.status === 'paid') throw new DomainError(`Installment #${item.sequence} is already fully paid`, 409)

  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])
  const paymentMethodId = input.paymentMethodId ?? inst.paymentMethodId

  // 1) The actual expense transaction — this is real spending that happened.
  const txDto = await createTransaction(db, user, {
    type: 'expense',
    amountMinor: input.amountMinor,
    currency: inst.currency,
    date: input.paidDate,
    time: input.paidTime,
    categoryId: inst.categoryId,
    paymentMethodId,
    merchantId: inst.merchantId,
    note: input.note?.trim() || `${inst.title} — installment ${item.sequence}/${inst.count}`,
  } as never, { installmentId: inst.id })

  // 2) The payment history record
  const [payment] = await db.insert(installmentPayments).values({
    ...(input.id ? { id: input.id } : {}),
    userId: user.id,
    installmentId: inst.id,
    itemId: item.id,
    amountMinor: input.amountMinor,
    paidDate: input.paidDate,
    paidTime: (input.paidTime ?? '00:00').slice(0, 5),
    paymentMethodId,
    note: input.note || null,
    transactionId: txDto.id,
  }).returning()

  await db.update(transactions).set({ installmentPaymentId: payment!.id }).where(eq(transactions.id, txDto.id))

  // 3) Update the schedule item: paid vs partially paid (never touch the
  //    expected amount — actual and expected stay independent).
  const newPaid = item.paidMinor + input.amountMinor
  const newStatus = newPaid >= item.expectedAmountMinor ? 'paid' : 'partially_paid'
  await db.update(installmentItems).set({
    paidMinor: newPaid,
    status: newStatus,
    updatedAt: new Date(),
  }).where(eq(installmentItems.id, item.id))

  await refreshInstallmentStatus(db, inst.id)
  return getInstallmentDetail(db, user, installmentId)
}

/** Mark the parent completed when no open items remain. */
async function refreshInstallmentStatus(db: Db, installmentId: string) {
  const [{ open } = { open: 0 }] = await db.select({
    open: sql<number>`cast(count(*) filter (where ${installmentItems.status} not in ('paid', 'skipped')) as int)`,
  }).from(installmentItems).where(eq(installmentItems.installmentId, installmentId))

  await db.update(installments)
    .set({ status: open === 0 ? 'completed' : 'active', updatedAt: new Date() })
    .where(eq(installments.id, installmentId))
}

// ---------------------------------------------------------------------------
// Delete a payment (undo a mistake) — reverts item aggregates and removes the
// linked ledger transaction.
// ---------------------------------------------------------------------------

export async function deleteInstallmentPayment(db: Db, user: ServiceUser, installmentId: string, paymentId: string): Promise<InstallmentDetailDto> {
  const [payment] = await db.select().from(installmentPayments)
    .where(and(
      eq(installmentPayments.id, paymentId),
      eq(installmentPayments.installmentId, installmentId),
      eq(installmentPayments.userId, user.id),
    )).limit(1)
  if (!payment) throw new DomainError('Payment not found', 404)

  const [item] = await db.select().from(installmentItems).where(eq(installmentItems.id, payment.itemId)).limit(1)

  if (payment.transactionId) {
    await db.delete(transactions).where(and(eq(transactions.id, payment.transactionId), eq(transactions.userId, user.id)))
  }
  await db.delete(installmentPayments).where(eq(installmentPayments.id, paymentId))

  if (item) {
    const newPaid = Math.max(0, item.paidMinor - payment.amountMinor)
    await db.update(installmentItems).set({
      paidMinor: newPaid,
      status: newPaid <= 0 ? 'upcoming' : (newPaid >= item.expectedAmountMinor ? 'paid' : 'partially_paid'),
      updatedAt: new Date(),
    }).where(eq(installmentItems.id, item.id))
  }

  await refreshInstallmentStatus(db, installmentId)
  return getInstallmentDetail(db, user, installmentId)
}

// ---------------------------------------------------------------------------
// Edit schedule — only future expectations change; paid history is immutable
// ---------------------------------------------------------------------------

export interface InstallmentUpdatePreview {
  changedItems: { sequence: number, dueDate: string, newDueDate: string, expectedAmountMinor: number, newExpectedAmountMinor: number }[]
  untouchedPaidItems: number
}

export async function updateInstallment(
  db: Db,
  user: ServiceUser,
  id: string,
  input: InstallmentUpdateInput,
  options: { dryRun?: boolean } = {},
): Promise<{ preview: InstallmentUpdatePreview, installment?: InstallmentDetailDto }> {
  const [inst] = await db.select().from(installments)
    .where(and(eq(installments.id, id), eq(installments.userId, user.id))).limit(1)
  if (!inst) throw new DomainError('Installment not found', 404)

  if (input.categoryId) await assertCategoryOwned(db, user.id, input.categoryId)
  if (input.paymentMethodId) await assertPaymentMethodsOwned(db, user.id, [input.paymentMethodId])
  if (input.merchantId) await assertMerchantOwned(db, user.id, input.merchantId)

  const items = await db.select().from(installmentItems)
    .where(eq(installmentItems.installmentId, id)).orderBy(asc(installmentItems.sequence))

  // Only pure-future expectations are recalculated: unpaid, unskipped, no partial payments.
  const adjustable = items.filter(i => i.status === 'upcoming' && i.paidMinor === 0)
  const protectedCount = items.length - adjustable.length

  const preview: InstallmentUpdatePreview = { changedItems: [], untouchedPaidItems: protectedCount }

  for (const item of adjustable) {
    let newDue = item.dueDate
    if (input.dueDay) {
      const { year, month } = isoDateParts(item.dueDate)
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
      newDue = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(input.dueDay, last)).padStart(2, '0')}`
    }
    const newExpected = input.expectedInstallmentMinor ?? item.expectedAmountMinor
    if (newDue !== item.dueDate || newExpected !== item.expectedAmountMinor) {
      preview.changedItems.push({
        sequence: item.sequence,
        dueDate: item.dueDate,
        newDueDate: newDue,
        expectedAmountMinor: item.expectedAmountMinor,
        newExpectedAmountMinor: newExpected,
      })
    }
  }

  if (options.dryRun) return { preview }

  await db.update(installments).set({
    title: input.title ?? inst.title,
    categoryId: input.categoryId ?? inst.categoryId,
    paymentMethodId: input.paymentMethodId ?? inst.paymentMethodId,
    merchantId: input.merchantId !== undefined ? input.merchantId : inst.merchantId,
    note: input.note !== undefined ? input.note : inst.note,
    expectedInstallmentMinor: input.expectedInstallmentMinor ?? inst.expectedInstallmentMinor,
    dueDay: input.dueDay ?? inst.dueDay,
    updatedAt: new Date(),
  }).where(eq(installments.id, id))

  for (const change of preview.changedItems) {
    await db.update(installmentItems).set({
      dueDate: change.newDueDate,
      expectedAmountMinor: change.newExpectedAmountMinor,
      updatedAt: new Date(),
    }).where(and(
      eq(installmentItems.installmentId, id),
      eq(installmentItems.sequence, change.sequence),
    ))
  }

  return { preview, installment: await getInstallmentDetail(db, user, id) }
}

// ---------------------------------------------------------------------------
// Override one scheduled occurrence (different future amount, skip, move date)
// ---------------------------------------------------------------------------

export async function updateInstallmentItem(
  db: Db,
  user: ServiceUser,
  installmentId: string,
  itemId: string,
  input: InstallmentItemUpdateInput,
): Promise<InstallmentDetailDto> {
  const [item] = await db.select().from(installmentItems)
    .where(and(
      eq(installmentItems.id, itemId),
      eq(installmentItems.installmentId, installmentId),
      eq(installmentItems.userId, user.id),
    )).limit(1)
  if (!item) throw new DomainError('Installment schedule item not found', 404)

  if (item.status === 'paid') {
    throw new DomainError('This installment is already paid — historical payments are never modified', 409)
  }

  const patch: Partial<InstallmentItemRow> = { updatedAt: new Date() }
  if (input.expectedAmountMinor != null) patch.expectedAmountMinor = input.expectedAmountMinor
  if (input.dueDate) patch.dueDate = input.dueDate
  if (input.note !== undefined) patch.note = input.note

  if (input.skipped === true) {
    if (item.paidMinor > 0) throw new DomainError('This installment already has payments — it cannot be skipped', 409)
    patch.status = 'skipped'
  }
  else if (input.skipped === false && item.status === 'skipped') {
    patch.status = 'upcoming'
  }

  // If the expected amount changed and there are partial payments, keep the
  // status consistent.
  const expected = patch.expectedAmountMinor ?? item.expectedAmountMinor
  if (patch.status === undefined && item.status !== 'skipped') {
    patch.status = item.paidMinor <= 0 ? 'upcoming' : (item.paidMinor >= expected ? 'paid' : 'partially_paid')
  }

  await db.update(installmentItems).set(patch).where(eq(installmentItems.id, itemId))
  await refreshInstallmentStatus(db, installmentId)
  return getInstallmentDetail(db, user, installmentId)
}

// ---------------------------------------------------------------------------
// Delete flows — always preserve paid history in the ledger
// ---------------------------------------------------------------------------

export async function deleteInstallment(db: Db, user: ServiceUser, id: string, input: InstallmentDeleteInput): Promise<void> {
  const [inst] = await db.select().from(installments)
    .where(and(eq(installments.id, id), eq(installments.userId, user.id))).limit(1)
  if (!inst) throw new DomainError('Installment not found', 404)

  if (input.mode === 'keep_history') {
    // Deleting the parent cascades to items + payment records. Ledger
    // transactions reference the installment with ON DELETE SET NULL, so the
    // actual paid expenses remain untouched in history.
    await db.delete(installments).where(and(eq(installments.id, id), eq(installments.userId, user.id)))
    return
  }

  // future_only: remove remaining unpaid schedule, keep parent + paid history.
  await db.delete(installmentItems).where(and(
    eq(installmentItems.installmentId, id),
    eq(installmentItems.paidMinor, 0),
    inArray(installmentItems.status, ['upcoming', 'skipped']),
  ))
  await refreshInstallmentStatus(db, id)
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function installmentCalendar(db: Db, user: ServiceUser, range: { startDate: string, endDate: string }): Promise<InstallmentCalendarItem[]> {
  const rows = await db.select({
    item: installmentItems,
    inst: installments,
  })
    .from(installmentItems)
    .innerJoin(installments, eq(installmentItems.installmentId, installments.id))
    .where(and(
      eq(installmentItems.userId, user.id),
      gte(installmentItems.dueDate, range.startDate),
      lte(installmentItems.dueDate, range.endDate),
    ))
    .orderBy(asc(installmentItems.dueDate), asc(installmentItems.sequence))

  const today = todayInTz(user.timezone)
  return rows.map(({ item, inst }) => ({
    installmentId: inst.id,
    installmentTitle: inst.title,
    itemId: item.id,
    sequence: item.sequence,
    count: inst.count,
    dueDate: item.dueDate,
    expectedAmountMinor: item.expectedAmountMinor,
    paidMinor: item.paidMinor,
    currency: inst.currency,
    status: effectiveItemStatus(item, today),
  }))
}
