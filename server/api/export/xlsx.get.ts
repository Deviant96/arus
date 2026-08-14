import { useDb } from '../../database/client'
import { exportTransactionRows, rowsToXlsx } from '../../services/export'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const rows = await exportTransactionRows(db, user)
  const buffer = await rowsToXlsx(rows, user)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="arus-transactions-${new Date().toISOString().slice(0, 10)}.xlsx"`)
  return buffer
})
