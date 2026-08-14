import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import { categories, installmentItems, installmentPayments, installments, merchants, paymentMethods, transactions } from '../database/schema'
import type { UserRow } from '../database/schema'
import type { CategoryBreakdownRow, InstallmentReport, MerchantBreakdownRow, PaymentMethodBreakdownRow, ReportSummary, TrendPoint } from '../../shared/types/api'
import type { DateRange } from '../../shared/utils/dates'
import { todayInTz } from '../../shared/utils/dates'
import { percentOf } from '../../shared/utils/money'
import { effectiveItemStatus } from './installments'
import { expectedOccurrencesInRange } from './recurring'
import { recurringRules } from '../database/schema'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

/**
 * Reports aggregate ACTUAL transactions only, in the user's preferred
 * currency. Transfers are excluded from income/expense by definition.
 * Expected (future) amounts are always reported separately.
 */

function actualTxConds(user: ServiceUser, range: DateRange) {
  return and(
    eq(transactions.userId, user.id),
    eq(transactions.currency, user.preferredCurrency),
    gte(transactions.localDate, range.startDate),
    lte(transactions.localDate, range.endDate),
  )
}

export async function reportSummary(db: Db, user: ServiceUser, range: DateRange): Promise<ReportSummary> {
  const [row] = await db.select({
    income: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income'), 0)`,
    expense: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`,
    count: sql<number>`cast(count(*) as int)`,
  }).from(transactions).where(actualTxConds(user, range))

  const incomeMinor = Number(row?.income ?? 0)
  const expenseMinor = Number(row?.expense ?? 0)

  // Expected obligations in the same period (NOT actual spending)
  const today = todayInTz(user.timezone)
  const items = await db.select({ item: installmentItems, currency: installments.currency })
    .from(installmentItems)
    .innerJoin(installments, eq(installmentItems.installmentId, installments.id))
    .where(and(
      eq(installmentItems.userId, user.id),
      eq(installments.currency, user.preferredCurrency),
      gte(installmentItems.dueDate, range.startDate),
      lte(installmentItems.dueDate, range.endDate),
    ))
  const upcomingInstallmentsMinor = items
    .filter(({ item }) => item.status !== 'paid' && item.status !== 'skipped')
    .reduce((s, { item }) => s + Math.max(0, item.expectedAmountMinor - item.paidMinor), 0)

  const rules = await db.select().from(recurringRules)
    .where(and(eq(recurringRules.userId, user.id), eq(recurringRules.currency, user.preferredCurrency), eq(recurringRules.type, 'expense')))
  let expectedRecurringMinor = 0
  for (const rule of rules) {
    expectedRecurringMinor += expectedOccurrencesInRange(rule, range).length * rule.amountMinor
  }

  return {
    currency: user.preferredCurrency,
    startDate: range.startDate,
    endDate: range.endDate,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    transactionCount: row?.count ?? 0,
    upcomingInstallmentsMinor,
    expectedRecurringMinor,
  }
}

export async function categoryBreakdown(db: Db, user: ServiceUser, range: DateRange, type: 'expense' | 'income' = 'expense'): Promise<CategoryBreakdownRow[]> {
  const rows = await db.select({
    categoryId: transactions.categoryId,
    name: categories.name,
    icon: categories.icon,
    color: categories.color,
    total: sql<string>`sum(${transactions.amountMinor})`,
    count: sql<number>`cast(count(*) as int)`,
  })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(actualTxConds(user, range), eq(transactions.type, type)))
    .groupBy(transactions.categoryId, categories.name, categories.icon, categories.color)
    .orderBy(desc(sql`sum(${transactions.amountMinor})`))

  const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0)
  return rows.map(r => ({
    categoryId: r.categoryId,
    name: r.name ?? 'Uncategorized',
    icon: r.icon,
    color: r.color,
    amountMinor: Number(r.total),
    count: r.count,
    percent: percentOf(Number(r.total), grandTotal),
  }))
}

export async function trendReport(db: Db, user: ServiceUser, range: DateRange, granularity: 'day' | 'month'): Promise<TrendPoint[]> {
  const bucketExpr = granularity === 'day'
    ? sql<string>`${transactions.localDate}::text`
    : sql<string>`left(${transactions.localDate}::text, 7)`

  const rows = await db.select({
    bucket: bucketExpr,
    income: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income'), 0)`,
    expense: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`,
  })
    .from(transactions)
    .where(actualTxConds(user, range))
    .groupBy(bucketExpr)
    .orderBy(bucketExpr)

  return rows.map(r => ({
    bucket: r.bucket,
    incomeMinor: Number(r.income),
    expenseMinor: Number(r.expense),
  }))
}

export async function paymentMethodBreakdown(db: Db, user: ServiceUser, range: DateRange): Promise<PaymentMethodBreakdownRow[]> {
  const rows = await db.select({
    paymentMethodId: transactions.paymentMethodId,
    name: paymentMethods.name,
    type: paymentMethods.type,
    expense: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`,
    income: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income'), 0)`,
    count: sql<number>`cast(count(*) as int)`,
  })
    .from(transactions)
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .where(and(actualTxConds(user, range), inArray(transactions.type, ['expense', 'income'])))
    .groupBy(transactions.paymentMethodId, paymentMethods.name, paymentMethods.type)
    .orderBy(desc(sql`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`))

  const totalExpense = rows.reduce((s, r) => s + Number(r.expense), 0)
  return rows.map(r => ({
    paymentMethodId: r.paymentMethodId,
    name: r.name ?? 'Unknown',
    type: r.type,
    expenseMinor: Number(r.expense),
    incomeMinor: Number(r.income),
    count: r.count,
    percent: percentOf(Number(r.expense), totalExpense),
  }))
}

export async function merchantBreakdown(db: Db, user: ServiceUser, range: DateRange, limit = 12): Promise<MerchantBreakdownRow[]> {
  const rows = await db.select({
    merchantId: transactions.merchantId,
    name: merchants.name,
    total: sql<string>`sum(${transactions.amountMinor})`,
    count: sql<number>`cast(count(*) as int)`,
  })
    .from(transactions)
    .innerJoin(merchants, eq(transactions.merchantId, merchants.id))
    .where(and(actualTxConds(user, range), eq(transactions.type, 'expense')))
    .groupBy(transactions.merchantId, merchants.name)
    .orderBy(desc(sql`sum(${transactions.amountMinor})`))
    .limit(limit)

  const [{ grand } = { grand: '0' }] = await db.select({
    grand: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)`,
  }).from(transactions).where(and(actualTxConds(user, range), eq(transactions.type, 'expense')))

  return rows.map(r => ({
    merchantId: r.merchantId,
    name: r.name ?? 'Unknown',
    amountMinor: Number(r.total),
    count: r.count,
    percent: percentOf(Number(r.total), Number(grand)),
  }))
}

export async function installmentReport(db: Db, user: ServiceUser, range: DateRange): Promise<InstallmentReport> {
  // Actual payments made during the period (what really happened)
  const [paidRow] = await db.select({
    total: sql<string>`coalesce(sum(${installmentPayments.amountMinor}), 0)`,
    count: sql<number>`cast(count(*) as int)`,
  })
    .from(installmentPayments)
    .innerJoin(installments, eq(installmentPayments.installmentId, installments.id))
    .where(and(
      eq(installmentPayments.userId, user.id),
      eq(installments.currency, user.preferredCurrency),
      gte(installmentPayments.paidDate, range.startDate),
      lte(installmentPayments.paidDate, range.endDate),
    ))

  // Scheduled items due in the period (expected obligations)
  const itemRows = await db.select({ item: installmentItems, inst: installments })
    .from(installmentItems)
    .innerJoin(installments, eq(installmentItems.installmentId, installments.id))
    .where(and(
      eq(installmentItems.userId, user.id),
      eq(installments.currency, user.preferredCurrency),
      gte(installmentItems.dueDate, range.startDate),
      lte(installmentItems.dueDate, range.endDate),
    ))
    .orderBy(installmentItems.dueDate)

  const today = todayInTz(user.timezone)
  let upcomingMinor = 0
  let upcomingCount = 0
  let lateMinor = 0
  let lateCount = 0

  const items = itemRows.map(({ item, inst }) => {
    const status = effectiveItemStatus(item, today)
    const remaining = Math.max(0, item.expectedAmountMinor - item.paidMinor)
    if (status === 'upcoming' || status === 'partially_paid') {
      upcomingMinor += remaining
      upcomingCount++
    }
    else if (status === 'late') {
      lateMinor += remaining
      lateCount++
    }
    return {
      installmentId: inst.id,
      installmentTitle: inst.title,
      itemId: item.id,
      sequence: item.sequence,
      count: inst.count,
      dueDate: item.dueDate,
      expectedAmountMinor: item.expectedAmountMinor,
      paidMinor: item.paidMinor,
      currency: inst.currency,
      status,
    }
  })

  return {
    currency: user.preferredCurrency,
    paidMinor: Number(paidRow?.total ?? 0),
    paidCount: paidRow?.count ?? 0,
    upcomingMinor,
    upcomingCount,
    lateMinor,
    lateCount,
    items,
  }
}
