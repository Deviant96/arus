<script setup lang="ts">
import type { ImportPreviewResponse } from '#shared/types/api'
import { formatMoney } from '#shared/utils/money'

const toast = useToast()
const { currency } = useFormat()

function download(kind: 'csv' | 'xlsx' | 'json') {
  window.location.href = `/api/export/${kind}`
}

const fileInput = ref<HTMLInputElement | null>(null)
const previewing = ref(false)
const preview = ref<ImportPreviewResponse | null>(null)
const committing = ref(false)

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  previewing.value = true
  preview.value = null
  try {
    const fd = new FormData()
    fd.append('file', file)
    preview.value = await $fetch<ImportPreviewResponse>('/api/import/preview', { method: 'POST', body: fd })
  }
  catch (err: any) {
    toast.add({ title: "Couldn't parse the file", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    previewing.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function commit() {
  if (!preview.value) return
  const rows = preview.value.rows.filter(r => r.valid && r.data).map(r => r.data!)
  if (rows.length === 0) return toast.add({ title: 'No valid rows to import', color: 'error' })
  committing.value = true
  try {
    const res = await $fetch<{ imported: number, skipped: number, createdCategories: number, createdPaymentMethods: number, createdMerchants: number }>('/api/import/commit', {
      method: 'POST',
      body: { rows },
    })
    toast.add({
      title: `Imported ${res.imported} transaction${res.imported === 1 ? '' : 's'}`,
      description: [
        res.skipped ? `${res.skipped} skipped` : '',
        res.createdCategories ? `${res.createdCategories} new categories` : '',
        res.createdPaymentMethods ? `${res.createdPaymentMethods} new payment methods` : '',
        res.createdMerchants ? `${res.createdMerchants} new merchants` : '',
      ].filter(Boolean).join(' · ') || undefined,
      color: 'success',
      icon: 'i-lucide-check',
    })
    preview.value = null
  }
  catch (err: any) {
    toast.add({ title: 'Import failed', description: err?.statusMessage, color: 'error' })
  }
  finally {
    committing.value = false
  }
}

// JSON restore
const restoreInput = ref<HTMLInputElement | null>(null)
const restoring = ref(false)

async function onRestore(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  restoring.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ counts: Record<string, number> }>('/api/import/restore', { method: 'POST', body: fd })
    toast.add({
      title: 'Backup restored',
      description: Object.entries(res.counts).map(([k, n]) => `${k}: ${n}`).join(' · '),
      color: 'success',
      icon: 'i-lucide-check',
    })
  }
  catch (err: any) {
    toast.add({ title: 'Restore failed', description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    restoring.value = false
    if (restoreInput.value) restoreInput.value.value = ''
  }
}

function amountLabel(row: NonNullable<ImportPreviewResponse['rows'][number]['data']>) {
  return formatMoney(row.amountMinor, row.currency)
}
</script>

<template>
  <div>
    <UiPageHeader title="Import / Export" />
    <SettingsNav />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6 max-w-3xl">
      <section class="panel p-5 space-y-3">
        <h2 class="text-sm font-semibold">Export</h2>
        <p class="text-xs text-muted">Download your data. JSON is a complete backup (including installments, recurring, budgets and favorites).</p>
        <div class="flex flex-wrap gap-2">
          <UButton variant="soft" color="neutral" icon="i-lucide-file-spreadsheet" @click="download('csv')">CSV</UButton>
          <UButton variant="soft" color="neutral" icon="i-lucide-table" @click="download('xlsx')">Excel (XLSX)</UButton>
          <UButton icon="i-lucide-archive" @click="download('json')">JSON backup</UButton>
        </div>
      </section>

      <section class="panel p-5 space-y-3">
        <h2 class="text-sm font-semibold">Import transactions</h2>
        <p class="text-xs text-muted">
          Upload CSV or XLSX. Columns recognized: type, date, amount, category, payment method, merchant, note.
          Invalid rows are shown and skipped — nothing is imported until you confirm the preview.
        </p>
        <input ref="fileInput" type="file" accept=".csv,.xlsx,.txt" class="hidden" @change="onFile">
        <UButton :loading="previewing" variant="soft" icon="i-lucide-upload" @click="fileInput?.click()">
          Upload CSV or XLSX
        </UButton>
      </section>

      <section v-if="preview" class="panel overflow-hidden">
        <div class="px-5 py-4 border-b border-default/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold">Preview — {{ preview.fileName }}</h3>
            <p class="text-xs text-muted mt-0.5">
              {{ preview.validRows }} valid · {{ preview.invalidRows }} invalid of {{ preview.totalRows }} rows
            </p>
          </div>
          <div class="flex gap-2">
            <UButton variant="soft" color="neutral" @click="preview = null">Cancel</UButton>
            <UButton :disabled="preview.validRows === 0" :loading="committing" icon="i-lucide-check" @click="commit">
              Import {{ preview.validRows }}
            </UButton>
          </div>
        </div>

        <div v-if="preview.newCategories.length || preview.newPaymentMethods.length || preview.newMerchants.length" class="px-5 py-3 bg-info/5 text-xs text-info border-b border-info/20">
          Will also create:
          <span v-if="preview.newCategories.length"> categories {{ preview.newCategories.join(', ') }}</span>
          <span v-if="preview.newPaymentMethods.length"> · payment methods {{ preview.newPaymentMethods.join(', ') }}</span>
          <span v-if="preview.newMerchants.length"> · merchants {{ preview.newMerchants.join(', ') }}</span>
        </div>

        <div class="overflow-x-auto max-h-96">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-elevated text-muted">
              <tr>
                <th class="text-left font-medium px-4 py-2">#</th>
                <th class="text-left font-medium px-2 py-2">Status</th>
                <th class="text-left font-medium px-2 py-2">Type</th>
                <th class="text-left font-medium px-2 py-2">Date</th>
                <th class="text-right font-medium px-2 py-2">Amount</th>
                <th class="text-left font-medium px-2 py-2">Category</th>
                <th class="text-left font-medium px-2 py-2">Payment</th>
                <th class="text-left font-medium px-2 py-2">Merchant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in preview.rows" :key="r.row" class="border-t border-default/30" :class="r.valid ? '' : 'bg-error/5'">
                <td class="px-4 py-1.5 tnum text-dimmed">{{ r.row }}</td>
                <td class="px-2 py-1.5">
                  <span v-if="r.valid" class="text-success">OK</span>
                  <span v-else class="text-error" :title="r.errors.join('; ')">{{ r.errors[0] }}</span>
                </td>
                <td class="px-2 py-1.5 capitalize">{{ r.data?.type ?? '—' }}</td>
                <td class="px-2 py-1.5 tnum">{{ r.data?.date ?? '—' }}</td>
                <td class="px-2 py-1.5 tnum text-right">{{ r.data ? amountLabel(r.data) : '—' }}</td>
                <td class="px-2 py-1.5">{{ r.data?.categoryName ?? '—' }}</td>
                <td class="px-2 py-1.5">{{ r.data?.paymentMethodName ?? '—' }}</td>
                <td class="px-2 py-1.5">{{ r.data?.merchantName ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel p-5 space-y-3">
        <h2 class="text-sm font-semibold">Restore JSON backup</h2>
        <p class="text-xs text-muted">
          Restore a previously exported Arus JSON backup. Existing records with the same IDs are skipped (idempotent).
        </p>
        <input ref="restoreInput" type="file" accept=".json" class="hidden" @change="onRestore">
        <UButton :loading="restoring" variant="soft" color="warning" icon="i-lucide-rotate-ccw" @click="restoreInput?.click()">
          Restore backup
        </UButton>
      </section>
    </div>
  </div>
</template>
