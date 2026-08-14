import { and, eq, gte, lte, sql } from 'drizzle-orm'
import type { Db } from '../database/client'
import { transactions } from '../database/schema'
import type { UserRow } from '../database/schema'
import type { InsightDto } from '../../shared/types/api'
import type { DateRange } from '../../shared/utils/dates'
import { addDays, addMonthsClamped, monthStringRange, todayInTz } from '../../shared/utils/dates'
import { formatMoney, percentOf } from '../../shared/utils/money'
import { listBudgets } from './budgets'
import { categoryBreakdown, installmentReport, reportSummary } from './reports'
import { recurringReport } from './recurring'

type ServiceUser = Pick<UserRow, 'id' | 'timezone' | 'preferredCurrency'>

/**
 * Deterministic, rule-based insights. All arithmetic happens here (or in the
 * report services) — never in an LLM.
 */
export async function generateInsights(db: Db, user: ServiceUser, month: string): Promise<InsightDto[]> {
  const cur = user.preferredCurrency
  const fmt = (minor: number) => formatMoney(minor, cur, { compact: minor >= 1_000_000 })

  const range = monthStringRange(month)
  const prevMonth = addMonthsClamped(`${month}-01`, -1).slice(0, 7)
  const prevRange = monthStringRange(prevMonth)

  const [summary, prevSummary, catNow, catPrev, instReport, recReport, budgets] = await Promise.all([
    reportSummary(db, user, range),
    reportSummary(db, user, prevRange),
    categoryBreakdown(db, user, range, 'expense'),
    categoryBreakdown(db, user, prevRange, 'expense'),
    installmentReport(db, user, range),
    recurringReport(db, user, range),
    listBudgets(db, user, month),
  ])

  const insights: InsightDto[] = []
  const today = todayInTz(user.timezone)
  const monthEnded = range.endDate < today

  // 1. Category month-over-month changes (largest increase + decrease)
  const prevByCat = new Map(catPrev.map(c => [c.categoryId ?? 'none', c.amountMinor]))
  let topIncrease: { name: string, pct: number, diff: number } | null = null
  let topDecrease: { name: string, pct: number, diff: number } | null = null
  for (const c of catNow) {
    const prev = prevByCat.get(c.categoryId ?? 'none') ?? 0
    if (prev <= 0) continue
    const diff = c.amountMinor - prev
    const pct = Math.round((diff / prev) * 100)
    if (pct >= 15 && diff > 0 && (!topIncrease || diff > topIncrease.diff)) topIncrease = { name: c.name, pct, diff }
    if (pct <= -15 && (!topDecrease || diff < topDecrease.diff)) topDecrease = { name: c.name, pct, diff }
  }
  if (topIncrease) {
    insights.push({
      id: 'cat-increase',
      tone: 'warning',
      icon: 'i-lucide-trending-up',
      title: `${topIncrease.name} spending increased ${topIncrease.pct}%`,
      body: `You spent ${fmt(topIncrease.diff)} more on ${topIncrease.name} than last month.`,
    })
  }
  if (topDecrease) {
    insights.push({
      id: 'cat-decrease',
      tone: 'positive',
      icon: 'i-lucide-trending-down',
      title: `${topDecrease.name} spending decreased ${Math.abs(topDecrease.pct)}%`,
      body: `You spent ${fmt(Math.abs(topDecrease.diff))} less on ${topDecrease.name} than last month.`,
    })
  }

  // 2. Largest expense category
  if (catNow.length > 0 && catNow[0]!.amountMinor > 0) {
    const top = catNow[0]!
    insights.push({
      id: 'top-category',
      tone: 'neutral',
      icon: 'i-lucide-pie-chart',
      title: `${top.name} was your largest category`,
      body: `${fmt(top.amountMinor)} across ${top.count} transaction${top.count === 1 ? '' : 's'} — ${top.percent}% of this month's spending.`,
    })
  }

  // 3. Weekend vs weekday spending
  const dowRows = await db.select({
    dow: sql<number>`cast(extract(isodow from ${transactions.localDate}) as int)`,
    total: sql<string>`sum(${transactions.amountMinor})`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.userId, user.id),
      eq(transactions.type, 'expense'),
      eq(transactions.currency, cur),
      gte(transactions.localDate, range.startDate),
      lte(transactions.localDate, range.endDate),
    ))
    .groupBy(sql`extract(isodow from ${transactions.localDate})`)

  let weekend = 0
  let weekday = 0
  for (const r of dowRows) {
    if (r.dow >= 6) weekend += Number(r.total)
    else weekday += Number(r.total)
  }
  if (weekend > 0 && weekday > 0) {
    // Compare per-day averages so 2 weekend days vs 5 weekdays is fair
    const weekendAvg = weekend / 2
    const weekdayAvg = weekday / 5
    if (weekendAvg > weekdayAvg * 1.3) {
      insights.push({
        id: 'weekend-spending',
        tone: 'neutral',
        icon: 'i-lucide-calendar-days',
        title: 'Weekends cost you more',
        body: `Average weekend day: ${fmt(Math.round(weekendAvg))} vs weekday: ${fmt(Math.round(weekdayAvg))} (${fmt(weekend)} total on weekends).`,
      })
    }
  }

  // 4. Installments this month
  if (instReport.paidMinor > 0 || instReport.upcomingMinor > 0 || instReport.lateMinor > 0) {
    const parts: string[] = []
    if (instReport.paidMinor > 0) parts.push(`${fmt(instReport.paidMinor)} paid`)
    if (instReport.upcomingMinor > 0) parts.push(`${fmt(instReport.upcomingMinor)} still due`)
    if (instReport.lateMinor > 0) parts.push(`${fmt(instReport.lateMinor)} late`)
    insights.push({
      id: 'installments',
      tone: instReport.lateMinor > 0 ? 'warning' : 'neutral',
      icon: 'i-lucide-calendar-clock',
      title: instReport.lateMinor > 0 ? 'You have late installments' : 'Installment obligations this month',
      body: parts.join(' · ') + '.',
    })
  }

  // 5. Budgets at risk / over
  const over = budgets.filter(b => b.percent >= 100)
  const atRisk = budgets.filter(b => b.percent >= 85 && b.percent < 100)
  if (over.length > 0) {
    insights.push({
      id: 'budget-over',
      tone: 'warning',
      icon: 'i-lucide-alert-triangle',
      title: over.length === 1 ? `${over[0]!.category?.name} budget exceeded` : `${over.length} budgets exceeded`,
      body: over.map(b => `${b.category?.name}: ${fmt(b.spentMinor)} of ${fmt(b.amountMinor)}`).join(' · '),
    })
  }
  else if (atRisk.length > 0 && !monthEnded) {
    insights.push({
      id: 'budget-risk',
      tone: 'warning',
      icon: 'i-lucide-gauge',
      title: `${atRisk[0]!.category?.name} budget is nearly used up`,
      body: `${atRisk[0]!.percent}% used with ${fmt(Math.max(0, atRisk[0]!.remainingMinor))} remaining this month.`,
    })
  }

  // 6. Savings rate
  if (summary.incomeMinor > 0) {
    const rate = percentOf(summary.netMinor, summary.incomeMinor)
    if (rate >= 20) {
      insights.push({
        id: 'savings-rate',
        tone: 'positive',
        icon: 'i-lucide-piggy-bank',
        title: `You kept ${rate}% of your income`,
        body: `Income ${fmt(summary.incomeMinor)} minus expenses ${fmt(summary.expenseMinor)} leaves ${fmt(summary.netMinor)}.`,
      })
    }
    else if (rate < 0) {
      insights.push({
        id: 'negative-net',
        tone: 'warning',
        icon: 'i-lucide-trending-down',
        title: 'You spent more than you earned',
        body: `Expenses exceeded income by ${fmt(Math.abs(summary.netMinor))} this month.`,
      })
    }
  }

  // 7. Upcoming recurring in the next 7 days
  const soonEnd = addDays(today, 7)
  const dueSoon = recReport.rows.filter(r => !r.confirmed && r.type === 'expense' && r.dueDate >= today && r.dueDate <= soonEnd)
  if (dueSoon.length > 0) {
    const total = dueSoon.reduce((s, r) => s + r.expectedAmountMinor, 0)
    insights.push({
      id: 'recurring-soon',
      tone: 'neutral',
      icon: 'i-lucide-repeat',
      title: `${dueSoon.length} recurring payment${dueSoon.length === 1 ? '' : 's'} due within a week`,
      body: `${dueSoon.map(r => r.name).slice(0, 3).join(', ')}${dueSoon.length > 3 ? '…' : ''} — expected total ${fmt(total)}.`,
    })
  }

  return insights.slice(0, 6)
}
