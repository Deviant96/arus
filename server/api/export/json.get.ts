import { useDb } from '../../database/client'
import { exportJsonBackup } from '../../services/export'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  const db = await useDb()
  const backup = await exportJsonBackup(db, user)

  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="arus-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  return backup
})
