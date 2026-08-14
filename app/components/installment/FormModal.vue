<script setup lang="ts">
import { splitEvenly } from '#shared/utils/money'
import { generateInstallmentDueDates } from '#shared/utils/dates'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [id: string] }>()

const { money, today } = useFormat()
const { user } = useSessionUser()
const toast = useToast()

const form = reactive({
  title: '',
  totalAmountMinor: null as number | null,
  downPaymentMinor: null as number | null,
  interestMinor: null as number | null,
  feesMinor: null as number | null,
  count: 12,
  firstDueDate: today(),
  categoryId: null as string | null,
  paymentMethodId: null as string | null,
  merchantId: null as string | null,
  merchantName: null as string | null,
  note: '',
  createDownPaymentTransaction: false,
})
const saving = ref(false)
const errors = ref<Record<string, string>>({})

watch(open, (v) => {
  if (v) {
    Object.assign(form, {
      title: '',
      totalAmountMinor: null,
      downPaymentMinor: null,
      interestMinor: null,
      feesMinor: null,
      count: 12,
      firstDueDate: today(),
      categoryId: user.value?.defaultCategoryId ?? null,
      paymentMethodId: user.value?.defaultPaymentMethodId ?? null,
      merchantId: null,
      merchantName: null,
      note: '',
      createDownPaymentTransaction: false,
    })
    errors.value = {}
  }
})

const preview = computed(() => {
  const total = form.totalAmountMinor ?? 0
  const dp = form.downPaymentMinor ?? 0
  const financed = total - dp + (form.interestMinor ?? 0) + (form.feesMinor ?? 0)
  if (total <= 0 || dp > total || financed <= 0 || form.count < 1) return null
  const amounts = splitEvenly(financed, form.count)
  const dates = generateInstallmentDueDates(form.firstDueDate, Math.min(form.count, 3))
  return {
    principal: total - dp,
    financed,
    monthly: amounts[0]!,
    last: amounts[amounts.length - 1]!,
    firstDates: dates,
  }
})

async function submit() {
  const e: Record<string, string> = {}
  if (!form.title.trim()) e.title = 'Give it a name (e.g. Laptop)'
  if (!form.totalAmountMinor || form.totalAmountMinor <= 0) e.total = 'Enter the total purchase amount'
  if ((form.downPaymentMinor ?? 0) > (form.totalAmountMinor ?? 0)) e.downPayment = 'Down payment cannot exceed the purchase amount'
  if (!form.categoryId) e.categoryId = 'Pick a category'
  if (!form.paymentMethodId) e.paymentMethodId = 'Pick a payment method'
  if (form.count < 1 || form.count > 240) e.count = 'Between 1 and 240'
  errors.value = e
  if (Object.keys(e).length) return

  saving.value = true
  try {
    const res = await $fetch<{ item: { id: string } }>('/api/installments', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        categoryId: form.categoryId,
        paymentMethodId: form.paymentMethodId,
        merchantId: form.merchantId,
        currency: user.value?.preferredCurrency ?? 'IDR',
        totalAmountMinor: form.totalAmountMinor,
        downPaymentMinor: form.downPaymentMinor ?? 0,
        interestMinor: form.interestMinor ?? 0,
        feesMinor: form.feesMinor ?? 0,
        count: form.count,
        firstDueDate: form.firstDueDate,
        note: form.note.trim() || null,
        createDownPaymentTransaction: form.createDownPaymentTransaction,
      },
    })
    toast.add({ title: 'Installment created', icon: 'i-lucide-check', color: 'success' })
    open.value = false
    emit('created', res.item.id)
  }
  catch (err: any) {
    const fields = err?.data?.data?.fields
    if (fields) errors.value = fields
    toast.add({ title: "Couldn't create the installment", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New installment" description="Track a purchase paid over time — expected schedule vs what you actually pay." :ui="{ content: 'max-w-xl' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Title" :error="errors.title">
          <UInput v-model="form.title" placeholder="e.g. MacBook Air" class="w-full" size="lg" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Total price" :error="errors.total">
            <TransactionAmountInput v-model="form.totalAmountMinor" size="lg" />
          </UFormField>
          <UFormField label="Down payment" :error="errors.downPayment">
            <TransactionAmountInput v-model="form.downPaymentMinor" size="lg" />
          </UFormField>
          <UFormField label="Interest (total)">
            <TransactionAmountInput v-model="form.interestMinor" size="lg" />
          </UFormField>
          <UFormField label="Fees">
            <TransactionAmountInput v-model="form.feesMinor" size="lg" />
          </UFormField>
          <UFormField label="Number of installments" :error="errors.count">
            <UInputNumber v-model="form.count" :min="1" :max="240" class="w-full" size="lg" />
          </UFormField>
          <UFormField label="First due date">
            <UInput v-model="form.firstDueDate" type="date" class="w-full" size="lg" />
          </UFormField>
        </div>

        <div v-if="preview" class="rounded-xl bg-primary/8 border border-primary/20 px-4 py-3 text-sm space-y-1">
          <div class="flex justify-between"><span class="text-muted">Financed (principal + interest + fees)</span><span class="tnum font-medium">{{ money(preview.financed) }}</span></div>
          <div class="flex justify-between"><span class="text-muted">Expected monthly</span><span class="tnum font-semibold text-primary">{{ money(preview.monthly) }}</span></div>
          <div v-if="preview.last !== preview.monthly" class="flex justify-between"><span class="text-muted">Final installment</span><span class="tnum">{{ money(preview.last) }}</span></div>
          <div class="flex justify-between text-xs text-dimmed pt-1">
            <span>Due dates</span>
            <span>{{ preview.firstDates.join(' · ') }}{{ form.count > 3 ? ' · …' : '' }}</span>
          </div>
        </div>

        <UFormField label="Category" :error="errors.categoryId" help="Payments will be recorded as expenses in this category">
          <TransactionCategoryPicker v-model="form.categoryId" />
        </UFormField>
        <UFormField label="Default payment method" :error="errors.paymentMethodId">
          <TransactionPaymentMethodPicker v-model="form.paymentMethodId" />
        </UFormField>
        <UFormField label="Merchant (optional)">
          <TransactionMerchantPicker v-model:merchant-id="form.merchantId" v-model:merchant-name="form.merchantName" />
        </UFormField>
        <UFormField label="Note (optional)">
          <UInput v-model="form.note" class="w-full" />
        </UFormField>

        <USwitch
          v-if="(form.downPaymentMinor ?? 0) > 0"
          v-model="form.createDownPaymentTransaction"
          label="Record the down payment as an expense today"
          size="sm"
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="soft" color="neutral" @click="open = false">Cancel</UButton>
          <UButton :loading="saving" icon="i-lucide-check" @click="submit">Create installment</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
