import { todayInTz, monthStringRange, addDays } from '../../shared/utils/dates'
import { useDb } from '../database/client'
import { listBudgets } from '../services/budgets'
import { generateInsights } from '../services/insights'
import { installmentCalendar } from '../services/installments'
import { recurringReport } from '../services/recurring'
import { reportSummary } from '../services/reports'
import { listTransactions } from '../services/transactions'
import type { DashboardData } from '../../shared/types/api'

export default defineApiHandler(async (event): Promise<DashboardData> => {
  const user = await requireAuthUser(event)
  const db = await useDb()

  const today = todayInTz(user.timezone)
  const month = today.slice(0, 7)
  const range = monthStringRange(month)
  const upcomingWindow = { startDate: today, endDate: addDays(today, 30) }

  const [summary, recent, calendarItems, recReport, budgets, insights] = await Promise.all([
    reportSummary(db, user, range),
    listTransactions(db, user, { limit: 8, sort: 'newest', source: 'all' } as never),
    installmentCalendar(db, user, { startDate: addDays(today, -60), endDate: upcomingWindow.endDate }),
    recurringReport(db, user, upcomingWindow),
    listBudgets(db, user, month),
    generateInsights(db, user, month),
  ])

  const upcomingInstallments = calendarItems
    .filter(i => i.status === 'upcoming' || i.status === 'late' || i.status === 'partially_paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  const upcomingRecurring = recReport.rows
    .filter(r => !r.confirmed)
    .slice(0, 5)

  return {
    month,
    summary,
    recentTransactions: recent.items,
    upcomingInstallments,
    upcomingRecurring,
    budgets: budgets.slice(0, 5),
    insights: insights.slice(0, 4),
  }
})
