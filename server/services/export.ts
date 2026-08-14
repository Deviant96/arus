import { asc, eq } from 'drizzle-orm'
import type { Db } from '../database/client'
import { budgets, categories, favorites, installmentItems, installmentPayments, installments, merchants, paymentMethods, recurringRules, transactions } from '../database/schema'
import type { UserRow } from '../database/schema'
import { minorToMajor } from '../../shared/utils/money'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency' | 'name' | 'email'>

export interface ExportTransactionRow {
  id: string
  type: string
  date: string
  time: string
  amount: string
  currency: string
  category: string
  payment_method: string
  from_payment_method: string
  to_payment_method: string
  merchant: string
  note: string
  tags: string
}

export async function exportTransactionRows(db: Db, user: ServiceUser): Promise<ExportTransactionRow[]> {
  const catRows = await db.select().from(categories).where(eq(categories.userId, user.id))
  const pmRows = await db.select().from(paymentMethods).where(eq(paymentMethods.userId, user.id))
  const merchRows = await db.select().from(merchants).where(eq(merchants.userId, user.id))
  const catById = new Map(catRows.map(c => [c.id, c.name]))
  const pmById = new Map(pmRows.map(p => [p.id, p.name]))
  const merchById = new Map(merchRows.map(m => [m.id, m.name]))

  const txRows = await db.select().from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(asc(transactions.occurredAt))

  return txRows.map(tx => ({
    id: tx.id,
    type: tx.type,
    date: tx.localDate,
    time: tx.localTime,
    // Major units, exact: e.g. IDR 50000 -> "50000", USD 1250 -> "12.5"
    amount: String(minorToMajor(tx.amountMinor, tx.currency)),
    currency: tx.currency,
    category: tx.categoryId ? catById.get(tx.categoryId) ?? '' : '',
    payment_method: tx.paymentMethodId ? pmById.get(tx.paymentMethodId) ?? '' : '',
    from_payment_method: tx.fromPaymentMethodId ? pmById.get(tx.fromPaymentMethodId) ?? '' : '',
    to_payment_method: tx.toPaymentMethodId ? pmById.get(tx.toPaymentMethodId) ?? '' : '',
    merchant: tx.merchantId ? merchById.get(tx.merchantId) ?? '' : '',
    note: tx.note ?? '',
    tags: Array.isArray(tx.tags) ? tx.tags.join(', ') : '',
  }))
}

export function rowsToCsv(rows: ExportTransactionRow[]): string {
  const headers = ['id', 'type', 'date', 'time', 'amount', 'currency', 'category', 'payment_method', 'from_payment_method', 'to_payment_method', 'merchant', 'note', 'tags'] as const
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => escape(String(row[h] ?? ''))).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export async function rowsToXlsx(rows: ExportTransactionRow[], user: ServiceUser): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Arus'
  const ws = wb.addWorksheet('Transactions')

  ws.columns = [
    { header: 'ID', key: 'id', width: 38 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Time', key: 'time', width: 8 },
    { header: 'Amount', key: 'amount', width: 16 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Payment Method', key: 'payment_method', width: 18 },
    { header: 'From', key: 'from_payment_method', width: 18 },
    { header: 'To', key: 'to_payment_method', width: 18 },
    { header: 'Merchant', key: 'merchant', width: 20 },
    { header: 'Note', key: 'note', width: 32 },
    { header: 'Tags', key: 'tags', width: 16 },
  ]
  ws.getRow(1).font = { bold: true }

  for (const row of rows) {
    ws.addRow({ ...row, amount: Number(row.amount) })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/** Complete JSON backup of every user-owned entity. */
export async function exportJsonBackup(db: Db, user: ServiceUser) {
  const [cats, pms, merchs, txs, insts, items, payments, recs, buds, favs] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, user.id)),
    db.select().from(paymentMethods).where(eq(paymentMethods.userId, user.id)),
    db.select().from(merchants).where(eq(merchants.userId, user.id)),
    db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(asc(transactions.occurredAt)),
    db.select().from(installments).where(eq(installments.userId, user.id)),
    db.select().from(installmentItems).where(eq(installmentItems.userId, user.id)),
    db.select().from(installmentPayments).where(eq(installmentPayments.userId, user.id)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, user.id)),
    db.select().from(budgets).where(eq(budgets.userId, user.id)),
    db.select().from(favorites).where(eq(favorites.userId, user.id)),
  ])

  return {
    app: 'arus',
    format: 'arus-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email, preferredCurrency: user.preferredCurrency, timezone: user.timezone },
    categories: cats,
    paymentMethods: pms,
    merchants: merchs,
    transactions: txs,
    installments: insts,
    installmentItems: items,
    installmentPayments: payments,
    recurringRules: recs,
    budgets: buds,
    favorites: favs,
  }
}
