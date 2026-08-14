import { randomUUID } from 'node:crypto'
import { useDb } from '../../database/client'
import { normalizeHeader, validateImportRow } from '../../services/import'
import type { ImportPreviewResponse, ImportRowPreview } from '../../../shared/types/api'

/**
 * Upload → parse → validate → preview. Nothing is written yet; the client
 * sends the validated rows back to /api/import/commit after user review.
 */
export default defineApiHandler(async (event): Promise<ImportPreviewResponse> => {
  const user = await requireAuthUser(event)
  await useDb() // ensure db is reachable before doing work

  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'file' && f.data?.length)
  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'Upload a CSV or XLSX file' })
  }
  if (file.data.length > 8 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'File is too large (max 8 MB)' })
  }

  const fileName = file.filename ?? 'upload'
  const ext = fileName.toLowerCase().split('.').pop()

  let rawRows: Record<string, string>[] = []

  if (ext === 'csv' || ext === 'txt') {
    const Papa = (await import('papaparse')).default
    const text = file.data.toString('utf8').replace(/^\uFEFF/, '')
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    const fields = parsed.meta.fields ?? []
    const mapping = new Map<string, string>()
    for (const f of fields) {
      const norm = normalizeHeader(f)
      if (norm) mapping.set(f, norm)
    }
    if (!mapping.size) {
      throw createError({ statusCode: 422, statusMessage: 'No recognizable columns found. Expected headers like: type, date, amount, category, payment method.' })
    }
    rawRows = parsed.data.map((row) => {
      const out: Record<string, string> = {}
      for (const [orig, norm] of mapping) out[norm] = String(row[orig] ?? '')
      return out
    })
  }
  else if (ext === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(file.data as never)
    const ws = wb.worksheets[0]
    if (!ws) throw createError({ statusCode: 422, statusMessage: 'The workbook has no sheets' })

    const headerRow = ws.getRow(1)
    const mapping = new Map<number, string>()
    headerRow.eachCell((cell, col) => {
      const norm = normalizeHeader(String(cell.value ?? ''))
      if (norm) mapping.set(col, norm)
    })
    if (!mapping.size) {
      throw createError({ statusCode: 422, statusMessage: 'No recognizable columns found in the first sheet.' })
    }
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const out: Record<string, string> = {}
      let hasValue = false
      for (const [col, norm] of mapping) {
        const cell = row.getCell(col)
        let v = ''
        if (cell.value instanceof Date) v = cell.value.toISOString().slice(0, 10)
        else if (cell.value != null && typeof cell.value === 'object' && 'result' in (cell.value as object)) v = String((cell.value as { result: unknown }).result ?? '')
        else v = String(cell.value ?? '')
        if (v.trim()) hasValue = true
        out[norm] = v
      }
      if (hasValue) rawRows.push(out)
    })
  }
  else {
    throw createError({ statusCode: 422, statusMessage: 'Unsupported file type. Upload .csv or .xlsx' })
  }

  if (rawRows.length === 0) throw createError({ statusCode: 422, statusMessage: 'The file contains no data rows' })
  if (rawRows.length > 5000) throw createError({ statusCode: 422, statusMessage: 'Imports are limited to 5000 rows at a time' })

  const rows: ImportRowPreview[] = rawRows.map((raw, i) => validateImportRow(raw, i + 2, user.preferredCurrency))

  // Names that would be auto-created
  const db = await useDb()
  const { categories, paymentMethods, merchants } = await import('../../database/schema')
  const { eq } = await import('drizzle-orm')
  const [cats, pms, merchs] = await Promise.all([
    db.select({ name: categories.name }).from(categories).where(eq(categories.userId, user.id)),
    db.select({ name: paymentMethods.name }).from(paymentMethods).where(eq(paymentMethods.userId, user.id)),
    db.select({ name: merchants.normalizedName }).from(merchants).where(eq(merchants.userId, user.id)),
  ])
  const catSet = new Set(cats.map(c => c.name.toLowerCase()))
  const pmSet = new Set(pms.map(p => p.name.toLowerCase()))
  const merchSet = new Set(merchs.map(m => m.name))

  const newCategories = new Set<string>()
  const newPaymentMethods = new Set<string>()
  const newMerchants = new Set<string>()
  for (const r of rows) {
    if (!r.data) continue
    if (r.data.categoryName && !catSet.has(r.data.categoryName.toLowerCase())) newCategories.add(r.data.categoryName)
    if (r.data.paymentMethodName && !pmSet.has(r.data.paymentMethodName.toLowerCase())) newPaymentMethods.add(r.data.paymentMethodName)
    if (r.data.toPaymentMethodName && !pmSet.has(r.data.toPaymentMethodName.toLowerCase())) newPaymentMethods.add(r.data.toPaymentMethodName)
    if (r.data.merchantName && !merchSet.has(r.data.merchantName.trim().toLowerCase().replace(/\s+/g, ' '))) newMerchants.add(r.data.merchantName)
  }

  return {
    token: randomUUID(),
    fileName,
    totalRows: rows.length,
    validRows: rows.filter(r => r.valid).length,
    invalidRows: rows.filter(r => !r.valid).length,
    rows,
    newCategories: [...newCategories],
    newPaymentMethods: [...newPaymentMethods],
    newMerchants: [...newMerchants],
  }
})
