<script setup lang="ts">
import type { InstallmentDetailDto, InstallmentItemDto } from '#shared/types/api'

const route = useRoute()
const toast = useToast()
const { money, dayLabel } = useFormat()

const id = route.params.id as string

const { data: inst, refresh, status, error } = await useAsyncData(`installment-${id}`, async () => {
  const res = await $fetch<{ item: InstallmentDetailDto }>(`/api/installments/${id}`)
  return res.item
}, { server: false, lazy: true })

// ---- Record payment ----
const payOpen = ref(false)
const payItem = ref<InstallmentItemDto | null>(null)
function openPay(item: InstallmentItemDto) {
  payItem.value = item
  payOpen.value = true
}

// ---- Edit occurrence override ----
const itemEditOpen = ref(false)
const itemEditing = ref<InstallmentItemDto | null>(null)
const itemForm = reactive({ expectedAmountMinor: null as number | null, dueDate: '', note: '' })
const itemSaving = ref(false)

function openItemEdit(item: InstallmentItemDto) {
  itemEditing.value = item
  itemForm.expectedAmountMinor = item.expectedAmountMinor
  itemForm.dueDate = item.dueDate
  itemForm.note = item.note ?? ''
  itemEditOpen.value = true
}

async function saveItem(skip?: boolean) {
  if (!itemEditing.value) return
  itemSaving.value = true
  try {
    await $fetch(`/api/installments/${id}/items/${itemEditing.value.id}`, {
      method: 'PATCH',
      body: skip !== undefined
        ? { skipped: skip }
        : {
            expectedAmountMinor: itemForm.expectedAmountMinor ?? undefined,
            dueDate: itemForm.dueDate || undefined,
            note: itemForm.note.trim() || null,
          },
    })
    toast.add({ title: skip === true ? 'Occurrence skipped' : skip === false ? 'Occurrence restored' : 'Occurrence updated', color: 'success', icon: 'i-lucide-check' })
    itemEditOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't update", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    itemSaving.value = false
  }
}

// ---- Delete payment ----
const deletingPaymentId = ref<string | null>(null)
async function deletePayment(paymentId: string) {
  deletingPaymentId.value = paymentId
  try {
    await $fetch(`/api/installments/${id}/payments/${paymentId}`, { method: 'DELETE' })
    toast.add({ title: 'Payment removed', description: 'The linked expense was removed from your history too.', color: 'success' })
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't remove the payment", description: err?.statusMessage, color: 'error' })
  }
  finally {
    deletingPaymentId.value = null
  }
}

// ---- Edit installment (future only, with preview) ----
const editOpen = ref(false)
const editForm = reactive({ title: '', expectedInstallmentMinor: null as number | null, dueDay: null as number | null, note: '' })
const editPreview = ref<{ changedItems: { sequence: number, dueDate: string, newDueDate: string, expectedAmountMinor: number, newExpectedAmountMinor: number }[], untouchedPaidItems: number } | null>(null)
const editSaving = ref(false)

function openEditInstallment() {
  if (!inst.value) return
  editForm.title = inst.value.title
  editForm.expectedInstallmentMinor = inst.value.expectedInstallmentMinor
  editForm.dueDay = inst.value.dueDay
  editForm.note = inst.value.note ?? ''
  editPreview.value = null
  editOpen.value = true
}

function editBody() {
  return {
    title: editForm.title.trim() || undefined,
    expectedInstallmentMinor: editForm.expectedInstallmentMinor ?? undefined,
    dueDay: editForm.dueDay ?? undefined,
    note: editForm.note.trim() || null,
  }
}

async function previewEdit() {
  editSaving.value = true
  try {
    const res = await $fetch<{ preview: typeof editPreview.value }>(`/api/installments/${id}`, {
      method: 'PATCH',
      body: { ...editBody(), dryRun: true },
    })
    editPreview.value = res.preview
  }
  catch (err: any) {
    toast.add({ title: 'Preview failed', description: err?.statusMessage, color: 'error' })
  }
  finally {
    editSaving.value = false
  }
}

async function saveEdit() {
  editSaving.value = true
  try {
    await $fetch(`/api/installments/${id}`, { method: 'PATCH', body: editBody() })
    toast.add({ title: 'Installment updated', description: 'Paid history untouched; future expectations recalculated.', color: 'success', icon: 'i-lucide-check' })
    editOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't save", description: err?.statusMessage, color: 'error' })
  }
  finally {
    editSaving.value = false
  }
}

// ---- Delete installment ----
const deleteOpen = ref(false)
const deleteSaving = ref(false)
async function doDelete(mode: 'keep_history' | 'future_only') {
  deleteSaving.value = true
  try {
    await $fetch(`/api/installments/${id}`, { method: 'DELETE', body: { mode } })
    toast.add({
      title: mode === 'keep_history' ? 'Installment deleted' : 'Future schedule removed',
      description: 'Paid payment history remains in your transactions.',
      color: 'success',
    })
    if (mode === 'keep_history') return navigateTo('/installments')
    deleteOpen.value = false
    await refresh()
  }
  catch (err: any) {
    toast.add({ title: "Couldn't delete", description: err?.statusMessage, color: 'error' })
  }
  finally {
    deleteSaving.value = false
  }
}

const expandedItem = ref<string | null>(null)
</script>

<template>
  <div>
    <div v-if="error" class="px-4 sm:px-6 lg:px-8 pt-10">
      <UiEmptyState icon="i-lucide-search-x" title="Installment not found">
        <UButton to="/installments" variant="soft" color="neutral">Back to installments</UButton>
      </UiEmptyState>
    </div>

    <div v-else-if="status === 'pending' || !inst" class="px-4 sm:px-6 lg:px-8 pt-8 space-y-4">
      <USkeleton class="h-8 w-56" />
      <USkeleton class="h-40 w-full rounded-2xl" />
      <USkeleton class="h-80 w-full rounded-2xl" />
    </div>

    <template v-else>
      <UiPageHeader :title="inst.title" :subtitle="`${inst.category?.name ?? ''} · ${inst.paymentMethod?.name ?? ''}${inst.merchant ? ` · ${inst.merchant.name}` : ''}`">
        <UButton variant="soft" color="neutral" icon="i-lucide-pencil" @click="openEditInstallment">Edit</UButton>
        <UButton variant="soft" color="error" icon="i-lucide-trash-2" @click="deleteOpen = true">Delete</UButton>
      </UiPageHeader>

      <div class="px-4 sm:px-6 lg:px-8 space-y-6">
        <UButton to="/installments" variant="link" color="neutral" size="xs" icon="i-lucide-arrow-left" class="-mt-2">
          All installments
        </UButton>

        <!-- Summary -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Total price</p>
            <p class="text-lg font-semibold tnum mt-1">{{ money(inst.totalAmountMinor, inst.currency) }}</p>
            <p v-if="inst.downPaymentMinor > 0" class="text-xs text-muted mt-0.5 tnum">DP {{ money(inst.downPaymentMinor, inst.currency) }}</p>
          </div>
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Financed</p>
            <p class="text-lg font-semibold tnum mt-1">{{ money(inst.totalExpectedMinor, inst.currency) }}</p>
            <p class="text-xs text-muted mt-0.5 tnum">
              incl. interest {{ money(inst.interestMinor, inst.currency) }}<template v-if="inst.feesMinor > 0"> + fees {{ money(inst.feesMinor, inst.currency) }}</template>
            </p>
          </div>
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Actually paid</p>
            <p class="text-lg font-semibold tnum mt-1 text-success">{{ money(inst.totalPaidMinor, inst.currency) }}</p>
            <p class="text-xs text-muted mt-0.5">{{ inst.paidCount }} of {{ inst.count }} installments</p>
          </div>
          <div class="panel px-4 py-3.5">
            <p class="text-[11px] font-medium text-muted uppercase tracking-wide">Remaining</p>
            <p class="text-lg font-semibold tnum mt-1">{{ money(inst.remainingExpectedMinor, inst.currency) }}</p>
            <p class="text-xs text-muted mt-0.5 tnum">~{{ money(inst.expectedInstallmentMinor, inst.currency) }}/month · day {{ inst.dueDay }}</p>
          </div>
        </section>

        <UAlert
          v-if="inst.status === 'completed'"
          color="success"
          variant="subtle"
          icon="i-lucide-party-popper"
          title="This installment is fully settled."
        />

        <!-- Schedule -->
        <section>
          <h2 class="text-sm font-semibold mb-2 px-1">Schedule & payment history</h2>
          <div class="panel divide-y divide-default/40">
            <div v-for="item in inst.items" :key="item.id">
              <div
                class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-elevated/40 transition-colors"
                @click="expandedItem = expandedItem === item.id ? null : item.id"
              >
                <span class="flex items-center justify-center size-8 rounded-lg bg-elevated text-xs font-semibold tnum shrink-0">
                  {{ item.sequence }}
                </span>
                <span class="flex-1 min-w-0">
                  <span class="flex items-center gap-2">
                    <span class="text-sm font-medium tnum">{{ dayLabel(item.dueDate) }}</span>
                    <InstallmentStatusBadge :status="item.status" />
                  </span>
                  <span class="block text-xs text-muted mt-0.5 tnum">
                    Expected {{ money(item.expectedAmountMinor, inst.currency) }}
                    <template v-if="item.paidMinor > 0"> · paid {{ money(item.paidMinor, inst.currency) }}</template>
                    <template v-if="item.status === 'partially_paid' || (item.paidMinor > 0 && item.remainingMinor > 0)"> · {{ money(item.remainingMinor, inst.currency) }} left</template>
                    <template v-if="item.note"> · {{ item.note }}</template>
                  </span>
                </span>
                <UButton
                  v-if="item.status !== 'paid' && item.status !== 'skipped'"
                  size="xs"
                  variant="soft"
                  icon="i-lucide-banknote"
                  @click.stop="openPay(item)"
                >
                  <span class="hidden sm:inline">Record payment</span>
                </UButton>
                <UDropdownMenu
                  :items="[[
                    ...(item.status !== 'paid' && item.status !== 'skipped' ? [{ label: 'Adjust this occurrence', icon: 'i-lucide-pencil', onSelect: () => openItemEdit(item) }] : []),
                    ...(item.status === 'skipped' ? [{ label: 'Restore occurrence', icon: 'i-lucide-rotate-ccw', onSelect: () => { itemEditing = item; saveItem(false) } }] : []),
                    ...(item.status === 'upcoming' || item.status === 'late' ? [{ label: 'Skip this occurrence', icon: 'i-lucide-skip-forward', onSelect: () => { itemEditing = item; saveItem(true) } }] : []),
                  ]]"
                >
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-more-vertical" aria-label="Occurrence actions" @click.stop />
                </UDropdownMenu>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-4 text-dimmed transition-transform"
                  :class="expandedItem === item.id ? 'rotate-180' : ''"
                />
              </div>

              <div v-if="expandedItem === item.id" class="px-4 pb-3 pl-15">
                <div v-if="item.payments.length === 0" class="text-xs text-muted py-2">
                  No payments recorded for this installment yet.
                </div>
                <div v-else class="space-y-1.5">
                  <div
                    v-for="p in item.payments"
                    :key="p.id"
                    class="flex items-center gap-3 rounded-lg bg-elevated/50 px-3 py-2"
                  >
                    <UIcon name="i-lucide-check-circle-2" class="size-4 text-success shrink-0" />
                    <span class="flex-1 text-xs">
                      <span class="font-medium tnum">{{ money(p.amountMinor, inst.currency) }}</span>
                      <span class="text-muted"> on {{ dayLabel(p.paidDate) }}</span>
                      <span v-if="p.paymentMethod" class="text-muted"> · {{ p.paymentMethod.name }}</span>
                      <span v-if="p.note" class="text-dimmed"> · {{ p.note }}</span>
                    </span>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-lucide-trash-2"
                      :loading="deletingPaymentId === p.id"
                      aria-label="Delete payment"
                      @click="deletePayment(p.id)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="text-xs text-dimmed mt-2 px-1 flex items-center gap-1.5">
            <UIcon name="i-lucide-shield-check" class="size-3.5" />
            Late status is derived from dates automatically. Paid history is never modified by schedule edits.
          </p>
        </section>
      </div>

      <!-- Modals -->
      <InstallmentPayModal v-model:open="payOpen" :installment="inst" :item="payItem" @paid="refresh()" />

      <UModal v-model:open="itemEditOpen" :title="`Adjust occurrence #${itemEditing?.sequence}`" description="Override this single scheduled installment — history stays intact.">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Expected amount">
              <TransactionAmountInput v-model="itemForm.expectedAmountMinor" :currency="inst.currency" />
            </UFormField>
            <UFormField label="Due date">
              <UInput v-model="itemForm.dueDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Note">
              <UInput v-model="itemForm.note" class="w-full" placeholder="e.g. promo month — lower amount" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton variant="soft" color="neutral" @click="itemEditOpen = false">Cancel</UButton>
              <UButton :loading="itemSaving" @click="saveItem()">Save</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="editOpen" title="Edit installment" description="Changes apply to future unpaid installments only.">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Title">
              <UInput v-model="editForm.title" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Expected monthly amount">
                <TransactionAmountInput v-model="editForm.expectedInstallmentMinor" :currency="inst.currency" size="lg" />
              </UFormField>
              <UFormField label="Due day of month">
                <UInputNumber v-model="editForm.dueDay" :min="1" :max="31" class="w-full" size="lg" />
              </UFormField>
            </div>
            <UFormField label="Note">
              <UInput v-model="editForm.note" class="w-full" />
            </UFormField>

            <div v-if="editPreview" class="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              <p class="font-medium text-warning mb-1.5 flex items-center gap-1.5">
                <UIcon name="i-lucide-eye" class="size-4" /> What will change
              </p>
              <p v-if="editPreview.changedItems.length === 0" class="text-muted text-xs">
                No future occurrences change with these values.
              </p>
              <ul v-else class="space-y-1 text-xs text-toned max-h-40 overflow-y-auto">
                <li v-for="c in editPreview.changedItems" :key="c.sequence" class="tnum">
                  #{{ c.sequence }}:
                  <template v-if="c.dueDate !== c.newDueDate">{{ c.dueDate }} → {{ c.newDueDate }}</template>
                  <template v-if="c.expectedAmountMinor !== c.newExpectedAmountMinor">
                    {{ money(c.expectedAmountMinor, inst.currency) }} → <span class="font-semibold">{{ money(c.newExpectedAmountMinor, inst.currency) }}</span>
                  </template>
                </li>
              </ul>
              <p class="text-[11px] text-muted mt-2">
                {{ editPreview.untouchedPaidItems }} paid/partial/skipped occurrence{{ editPreview.untouchedPaidItems === 1 ? '' : 's' }} stay exactly as recorded.
              </p>
            </div>

            <div class="flex justify-between gap-2">
              <UButton variant="soft" color="neutral" :loading="editSaving" icon="i-lucide-eye" @click="previewEdit">
                Preview changes
              </UButton>
              <div class="flex gap-2">
                <UButton variant="soft" color="neutral" @click="editOpen = false">Cancel</UButton>
                <UButton :loading="editSaving" @click="saveEdit">Save</UButton>
              </div>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="deleteOpen" title="Delete this installment?">
        <template #body>
          <div class="space-y-4">
            <div class="text-sm text-toned space-y-2">
              <p>This will affect:</p>
              <ul class="list-disc pl-5 text-muted space-y-1">
                <li>The parent installment record</li>
                <li>Future unpaid scheduled installments</li>
              </ul>
              <p class="flex items-center gap-1.5 text-success text-xs font-medium">
                <UIcon name="i-lucide-shield-check" class="size-4" />
                Paid payment history will be preserved in your transactions either way.
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <UButton color="error" block :loading="deleteSaving" @click="doDelete('keep_history')">
                Delete parent & future schedule
              </UButton>
              <UButton color="neutral" variant="soft" block :loading="deleteSaving" @click="doDelete('future_only')">
                Keep parent, delete future schedule only
              </UButton>
              <UButton variant="ghost" color="neutral" block @click="deleteOpen = false">Cancel</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
