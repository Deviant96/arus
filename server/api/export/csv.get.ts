import { useDb } from '../../database/client'
import { exportTransactionRows, rowsToCsv } from '../../services/export'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const rows = await exportTransactionRows(db, user)
  const csv = rowsToCsv(rows)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="arus-transactions-${new Date().toISOString().slice(0, 10)}.csv"`)
  return csv
})
