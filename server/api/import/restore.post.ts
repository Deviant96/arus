import { useDb } from '../../database/client'
import { restoreJsonBackup } from '../../services/import'

export default defineApiHandler(async (event) => {
  const user = await requireAuthUser(event)
  rateLimit(event, { key: 'restore', max: 3, windowMs: 60_000 })

  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'file' && f.data?.length)
  if (!file || !file.data) throw createError({ statusCode: 400, statusMessage: 'Upload an Arus JSON backup file' })
  if (file.data.length > 32 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'File is too large (max 32 MB)' })

  let backup: unknown
  try {
    backup = JSON.parse(file.data.toString('utf8'))
  }
  catch {
    throw createError({ statusCode: 422, statusMessage: 'This file is not valid JSON' })
  }

  const db = await useDb()
  const counts = await restoreJsonBackup(db, user, backup)
  return { ok: true, counts }
})
