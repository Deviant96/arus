import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../../database/client'
import { aiSettings } from '../../database/schema'
import type { UserRow } from '../../database/schema'
import type { AIAnalysisResult } from '../../../shared/types/api'
import { formatMonthString, monthStringRange } from '../../../shared/utils/dates'
import { minorToMajor } from '../../../shared/utils/money'
import { decryptSecret } from '../../utils/crypto'
import { DomainError } from '../errors'
import { listBudgets } from '../budgets'
import { categoryBreakdown, installmentReport, merchantBreakdown, reportSummary } from '../reports'
import { recurringReport } from '../recurring'
import { createAIProvider } from './provider'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

/**
 * The application owns all calculations. The AI receives a compact,
 * pre-aggregated snapshot — never raw transactions, never the whole database.
 */
export async function buildAnalysisPayload(db: Db, user: ServiceUser, month: string) {
  const range = monthStringRange(month)
  const cur = user.preferredCurrency
  const toMajor = (minor: number) => minorToMajor(minor, cur)

  const [summary, cats, budgets, inst, rec, merchantsTop] = await Promise.all([
    reportSummary(db, user, range),
    categoryBreakdown(db, user, range, 'expense'),
    listBudgets(db, user, month),
    installmentReport(db, user, range),
    recurringReport(db, user, range),
    merchantBreakdown(db, user, range, 8),
  ])

  return {
    period: month,
    currency: cur,
    note: 'All monetary values are in major units of the given currency. actual = recorded transactions; expected = scheduled obligations that have NOT happened yet.',
    actual: {
      income: toMajor(summary.incomeMinor),
      expenses: toMajor(summary.expenseMinor),
      net: toMajor(summary.netMinor),
      transaction_count: summary.transactionCount,
      installment_payments_made: toMajor(inst.paidMinor),
    },
    expected: {
      upcoming_installments: toMajor(summary.upcomingInstallmentsMinor),
      late_installments: toMajor(inst.lateMinor),
      remaining_recurring: toMajor(summary.expectedRecurringMinor),
    },
    category_breakdown: cats.map(c => ({
      category: c.name,
      amount: toMajor(c.amountMinor),
      share_percent: c.percent,
      transactions: c.count,
    })),
    budget_status: budgets.map(b => ({
      category: b.category?.name ?? 'Unknown',
      budget: toMajor(b.amountMinor),
      spent: toMajor(b.spentMinor),
      used_percent: b.percent,
    })),
    top_merchants: merchantsTop.map(m => ({ merchant: m.name, amount: toMajor(m.amountMinor), transactions: m.count })),
    recurring: rec.rows.map(r => ({
      name: r.name,
      due_date: r.dueDate,
      type: r.type,
      status: r.confirmed ? 'confirmed' : 'expected',
      expected_amount: toMajor(r.expectedAmountMinor),
      actual_amount: r.actualAmountMinor != null ? toMajor(r.actualAmountMinor) : null,
    })),
  }
}

const SYSTEM_PROMPT = `You are a careful personal-finance analyst embedded in a spending tracker app.

Rules you must follow strictly:
- Use ONLY the numbers provided in the JSON snapshot. Never invent transactions, amounts, merchants, or categories.
- Never perform speculative arithmetic; if a number is not present or derivable trivially (e.g. a provided total), do not state it.
- Keep "actual" (recorded) strictly separate from "expected" (scheduled but not yet paid). Never describe expected amounts as money already spent.
- If data is sparse or ambiguous, say so plainly instead of guessing.
- You provide observations and practical suggestions, not regulated financial advice. Do not recommend financial products.
- Format the response as concise Markdown: a 2-3 sentence overview, then short sections with bullet points ("What stands out", "Budgets", "Obligations", "Suggestions"). No tables. Use the currency formatting of the data (e.g. Rp for IDR) with thousand separators.`

export async function analyzeMonth(db: Db, user: ServiceUser, month: string, encryptionKey: string): Promise<AIAnalysisResult> {
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.userId, user.id)).limit(1)
  if (!settings) throw new DomainError('Set up an AI provider in Settings → AI first', 400)

  let apiKey: string
  try {
    apiKey = decryptSecret(settings.encryptedKey, encryptionKey)
  }
  catch {
    throw new DomainError('Your stored API key could not be decrypted. Please re-enter it in Settings → AI.', 409)
  }

  const payload = await buildAnalysisPayload(db, user, month)
  const provider = createAIProvider(settings.provider)

  const content = await provider.complete({
    system: SYSTEM_PROMPT,
    user: `Analyze my spending for ${formatMonthString(month)}.\n\nData snapshot:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
    model: settings.model,
    apiKey,
  })

  return {
    id: randomUUID(),
    month,
    provider: settings.provider,
    model: settings.model,
    content,
    createdAt: new Date().toISOString(),
  }
}
