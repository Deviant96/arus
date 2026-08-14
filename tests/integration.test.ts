/**
 * End-to-end domain tests against a fresh in-memory PGlite database.
 * Covers: transaction types, transfer exclusion from expenses, installment
 * payment edge cases, and "never rewrite paid history".
 */
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import path from 'node:path'
import * as schema from '../server/database/schema'
import { setDb, type Db } from '../server/database/client'
import { bootstrapUserDefaults } from '../server/services/users'
import { createTransaction, listTransactions } from '../server/services/transactions'
import { createInstallment, getInstallmentDetail, recordInstallmentPayment, updateInstallment, updateInstallmentItem } from '../server/services/installments'
import { reportSummary } from '../server/services/reports'
import { hashUserPassword } from '../server/utils/password'
import { users, categories, paymentMethods } from '../server/database/schema'
import { eq } from 'drizzle-orm'

let pglite: PGlite
let db: Db
let user: { id: string, timezone: string, preferredCurrency: string }
let catFood: string
let catShop: string
let pmCash: string
let pmBca: string

beforeAll(async () => {
  pglite = new PGlite()
  const drizzleDb = drizzle(pglite, { schema })
  await migrate(drizzleDb, { migrationsFolder: path.resolve('server/database/migrations') })
  db = drizzleDb as unknown as Db
  setDb(db)

  const [u] = await db.insert(users).values({
    name: 'Tester',
    email: 'tester@arus.test',
    passwordHash: await hashUserPassword('password12'),
    preferredCurrency: 'IDR',
    timezone: 'Asia/Jakarta',
  }).returning()
  user = { id: u!.id, timezone: 'Asia/Jakarta', preferredCurrency: 'IDR' }
  await bootstrapUserDefaults(db, user.id)

  const cats = await db.select().from(categories).where(eq(categories.userId, user.id))
  const pms = await db.select().from(paymentMethods).where(eq(paymentMethods.userId, user.id))
  catFood = cats.find(c => c.name === 'Food & Drinks')!.id
  catShop = cats.find(c => c.name === 'Shopping')!.id
  pmCash = pms.find(p => p.name === 'Cash')!.id

  const [bca] = await db.insert(paymentMethods).values({
    userId: user.id, name: 'BCA', type: 'bank', currency: 'IDR',
  }).returning()
  pmBca = bca!.id
})

afterAll(async () => {
  await pglite.close()
})

describe('transactions', () => {
  it('stores expense/income as positive amounts of different types', async () => {
    const expense = await createTransaction(db, user, {
      type: 'expense', amountMinor: 35_000, currency: 'IDR', date: '2026-08-10',
      categoryId: catFood, paymentMethodId: pmCash, merchantName: 'Warteg',
    } as never)
    const income = await createTransaction(db, user, {
      type: 'income', amountMinor: 5_000_000, currency: 'IDR', date: '2026-08-01',
      paymentMethodId: pmBca, note: 'Salary',
    } as never)
    expect(expense.amountMinor).toBe(35_000)
    expect(expense.type).toBe('expense')
    expect(income.amountMinor).toBe(5_000_000)
    expect(income.type).toBe('income')
    expect(expense.merchant?.name).toBe('Warteg')
  })

  it('rejects a transfer with the same source and destination', async () => {
    await expect(createTransaction(db, user, {
      type: 'transfer', amountMinor: 100_000, currency: 'IDR', date: '2026-08-10',
      fromPaymentMethodId: pmBca, toPaymentMethodId: pmBca,
    } as never)).rejects.toThrow()
  })

  it('excludes transfers from expense totals in reports', async () => {
    await createTransaction(db, user, {
      type: 'transfer', amountMinor: 1_000_000, currency: 'IDR', date: '2026-08-11',
      fromPaymentMethodId: pmBca, toPaymentMethodId: pmCash, note: 'Top up',
    } as never)

    const summary = await reportSummary(db, user, { startDate: '2026-08-01', endDate: '2026-08-31' })
    // 35k expense from previous test; the 1M transfer is NOT an expense
    expect(summary.expenseMinor).toBe(35_000)
    expect(summary.incomeMinor).toBe(5_000_000)
    expect(summary.netMinor).toBe(5_000_000 - 35_000)
  })

  it('is idempotent when the same client UUID is replayed', async () => {
    const id = crypto.randomUUID()
    const a = await createTransaction(db, user, {
      id, type: 'expense', amountMinor: 12_000, currency: 'IDR', date: '2026-08-12',
      categoryId: catFood, paymentMethodId: pmCash,
    } as never)
    const b = await createTransaction(db, user, {
      id, type: 'expense', amountMinor: 12_000, currency: 'IDR', date: '2026-08-12',
      categoryId: catFood, paymentMethodId: pmCash,
    } as never)
    expect(a.id).toBe(id)
    expect(b.id).toBe(id)
    const list = await listTransactions(db, user, { limit: 100, sort: 'newest', source: 'all' } as never)
    expect(list.items.filter(t => t.id === id)).toHaveLength(1)
  })
})

describe('installments — expected vs actual', () => {
  let installmentId: string
  let item1: string
  let item2: string
  let item3: string

  it('creates a schedule of expected occurrences, not completed transactions', async () => {
    const inst = await createInstallment(db, user, {
      title: 'Laptop',
      categoryId: catShop,
      paymentMethodId: pmBca,
      currency: 'IDR',
      totalAmountMinor: 12_000_000,
      downPaymentMinor: 2_000_000,
      interestMinor: 500_000,
      feesMinor: 0,
      count: 12,
      firstDueDate: '2026-05-15',
      createDownPaymentTransaction: false,
      parentTransactionId: null,
    } as never)
    installmentId = inst.id
    expect(inst.items).toHaveLength(12)
    expect(inst.items.every(i => i.status === 'upcoming' || i.status === 'late')).toBe(true)
    expect(inst.items.reduce((s, i) => s + i.expectedAmountMinor, 0)).toBe(10_500_000)

    // No expense transactions were created for the 12 future installments
    const list = await listTransactions(db, user, { limit: 100, sort: 'newest', source: 'installment' } as never)
    expect(list.items.filter(t => t.installmentId === inst.id)).toHaveLength(0)

    item1 = inst.items[0]!.id
    item2 = inst.items[1]!.id
    item3 = inst.items[2]!.id
  })

  it('records an on-time payment as an actual expense, leaving the expected amount intact', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const expected = before.items[0]!.expectedAmountMinor

    await recordInstallmentPayment(db, user, installmentId, item1, {
      amountMinor: expected, paidDate: '2026-05-15',
    } as never)

    const after = await getInstallmentDetail(db, user, installmentId)
    expect(after.items[0]!.status).toBe('paid')
    expect(after.items[0]!.expectedAmountMinor).toBe(expected)
    expect(after.items[0]!.paidMinor).toBe(expected)
    expect(after.items[0]!.payments).toHaveLength(1)

    const summary = await reportSummary(db, user, { startDate: '2026-05-01', endDate: '2026-05-31' })
    expect(summary.expenseMinor).toBe(expected)
  })

  it('keeps a late payment associated with the original installment number', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const expected = before.items[1]!.expectedAmountMinor

    await recordInstallmentPayment(db, user, installmentId, item2, {
      amountMinor: expected, paidDate: '2026-06-20', note: 'paid 5 days late',
    } as never)

    const after = await getInstallmentDetail(db, user, installmentId)
    expect(after.items[1]!.sequence).toBe(2)
    expect(after.items[1]!.dueDate).toBe('2026-06-15') // original due date unchanged
    expect(after.items[1]!.payments[0]!.paidDate).toBe('2026-06-20')
    expect(after.items[1]!.status).toBe('paid')
    // later items were NOT shifted
    expect(after.items[2]!.dueDate).toBe('2026-07-15')
  })

  it('supports partial payments against the same installment', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const expected = before.items[2]!.expectedAmountMinor
    const first = Math.round(expected * 0.4)

    await recordInstallmentPayment(db, user, installmentId, item3, {
      amountMinor: first, paidDate: '2026-07-15',
    } as never)
    let after = await getInstallmentDetail(db, user, installmentId)
    expect(after.items[2]!.status).toBe('late') // due date has passed (today is 2026-08-14 in tests? wait - today is real today)
    // Status is derived from today. In August 2026 a July due date is late if not fully paid.
    expect(after.items[2]!.paidMinor).toBe(first)
    expect(after.items[2]!.remainingMinor).toBe(expected - first)

    await recordInstallmentPayment(db, user, installmentId, item3, {
      amountMinor: expected - first, paidDate: '2026-07-22',
    } as never)
    after = await getInstallmentDetail(db, user, installmentId)
    expect(after.items[2]!.status).toBe('paid')
    expect(after.items[2]!.payments).toHaveLength(2)
    expect(after.items[2]!.expectedAmountMinor).toBe(expected) // schedule never overwritten
  })

  it('records an early payment without changing the original due date', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const item4 = before.items[3]!
    await recordInstallmentPayment(db, user, installmentId, item4.id, {
      amountMinor: item4.expectedAmountMinor, paidDate: '2026-08-01',
    } as never)
    const after = await getInstallmentDetail(db, user, installmentId)
    expect(after.items[3]!.dueDate).toBe('2026-08-15')
    expect(after.items[3]!.payments[0]!.paidDate).toBe('2026-08-01')
    expect(after.items[3]!.status).toBe('paid')
  })

  it('never modifies historical paid records when the schedule is edited', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const paidSnapshot = before.items.filter(i => i.status === 'paid').map(i => ({
      sequence: i.sequence,
      dueDate: i.dueDate,
      expected: i.expectedAmountMinor,
      paid: i.paidMinor,
      paymentCount: i.payments.length,
    }))

    const result = await updateInstallment(db, user, installmentId, {
      expectedInstallmentMinor: 999_000,
      dueDay: 20,
    })

    // Preview/result must list only unpaid items as changed
    expect(result.preview.changedItems.every(c => c.sequence > 4)).toBe(true)
    expect(result.preview.untouchedPaidItems).toBeGreaterThanOrEqual(4)

    const after = await getInstallmentDetail(db, user, installmentId)
    const paidAfter = after.items.filter(i => i.status === 'paid').map(i => ({
      sequence: i.sequence,
      dueDate: i.dueDate,
      expected: i.expectedAmountMinor,
      paid: i.paidMinor,
      paymentCount: i.payments.length,
    }))
    expect(paidAfter).toEqual(paidSnapshot)

    // Future unpaid items picked up the new expected amount
    const future = after.items.find(i => i.status === 'upcoming' || i.status === 'late')
    expect(future?.expectedAmountMinor).toBe(999_000)
  })

  it('allows overriding a single future occurrence without touching others', async () => {
    const before = await getInstallmentDetail(db, user, installmentId)
    const future = before.items.find(i => i.status === 'upcoming')!
    await updateInstallmentItem(db, user, installmentId, future.id, {
      expectedAmountMinor: 500_000,
      note: 'promo month',
    })
    const after = await getInstallmentDetail(db, user, installmentId)
    const updated = after.items.find(i => i.id === future.id)!
    expect(updated.expectedAmountMinor).toBe(500_000)
    expect(updated.note).toBe('promo month')
    // A neighboring unpaid item (if any) is unchanged unless it was the one we edited
    const neighbor = after.items.find(i => (i.status === 'upcoming' || i.status === 'late') && i.id !== future.id)
    if (neighbor) expect(neighbor.expectedAmountMinor).not.toBe(500_000)
  })
})
