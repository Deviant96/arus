<script setup lang="ts">
import type { InstallmentDetailDto, InstallmentItemDto } from '#shared/types/api'

const props = defineProps<{
  installment: InstallmentDetailDto
  item: InstallmentItemDto | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ paid: [] }>()

const { money, today } = useFormat()
const api = useApi()
const toast = useToast()

const form = reactive({
  amountMinor: null as number | null,
  paidDate: today(),
  paymentMethodId: null as string | null,
  note: '',
})
const saving = ref(false)

watch(open, (v) => {
  if (v && props.item) {
    form.amountMinor = props.item.remainingMinor > 0 ? props.item.remainingMinor : props.item.expectedAmountMinor
    form.paidDate = today()
    form.paymentMethodId = props.installment.paymentMethodId
    form.note = ''
  }
})

const differs = computed(() =>
  props.item && form.amountMinor != null && form.amountMinor !== props.item.remainingMinor && form.amountMinor > 0,
)
const willBePartial = computed(() =>
  props.item && form.amountMinor != null && (props.item.paidMinor + form.amountMinor) < props.item.expectedAmountMinor,
)

async function submit() {
  if (!props.item || !form.amountMinor || form.amountMinor <= 0) return
  saving.value = true
  try {
    const id = crypto.randomUUID()
    const { queued } = await api.mutate(
      'POST',
      `/api/installments/${props.installment.id}/items/${props.item.id}/payments`,
      {
        id,
        amountMinor: form.amountMinor,
        paidDate: form.paidDate,
        paymentMethodId: form.paymentMethodId,
        note: form.note.trim() || null,
      },
      { kind: 'installment.payment', description: `Pay installment "${props.installment.title}" #${props.item.sequence}` },
    )
    if (queued) {
      toast.add({ title: 'Payment saved on this device', description: 'It will sync when you are back online.', icon: 'i-lucide-cloud-off', color: 'warning' })
    }
    else {
      toast.add({ title: `Installment #${props.item.sequence} payment recorded`, icon: 'i-lucide-check', color: 'success' })
    }
    open.value = false
    emit('paid')
  }
  catch (err: any) {
    toast.add({ title: "Couldn't record the payment", description: err?.statusMessage ?? err?.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="item ? `Record payment — #${item.sequence} of ${installment.count}` : 'Record payment'"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="item" class="space-y-4">
        <div class="rounded-xl bg-elevated/60 px-4 py-3 text-sm space-y-1">
          <div class="flex justify-between">
            <span class="text-muted">Expected</span>
            <span class="tnum">{{ money(item.expectedAmountMinor, installment.currency) }} · due {{ item.dueDate }}</span>
          </div>
          <div v-if="item.paidMinor > 0" class="flex justify-between">
            <span class="text-muted">Already paid</span>
            <span class="tnum text-success">{{ money(item.paidMinor, installment.currency) }}</span>
          </div>
          <div class="flex justify-between font-medium">
            <span class="text-muted">Remaining</span>
            <span class="tnum">{{ money(item.remainingMinor, installment.currency) }}</span>
          </div>
        </div>

        <UFormField label="Amount actually paid">
          <TransactionAmountInput v-model="form.amountMinor" :currency="installment.currency" autofocus />
          <template #help>
            <span v-if="willBePartial" class="text-warning">
              This is a partial payment — #{{ item.sequence }} will stay open for the rest.
            </span>
            <span v-else-if="differs">Different from the expected amount — that's fine, the actual payment is what counts.</span>
          </template>
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Payment date">
            <UInput v-model="form.paidDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Payment method">
            <TransactionPaymentMethodPicker v-model="form.paymentMethodId" label="Payment method" />
          </UFormField>
        </div>

        <UFormField label="Note (optional)">
          <UInput v-model="form.note" placeholder="e.g. paid late, fee waived…" class="w-full" />
        </UFormField>

        <p class="text-xs text-muted flex items-start gap-1.5">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0 mt-0.5" />
          This records an actual expense transaction. The schedule's expected amounts stay untouched.
        </p>

        <div class="flex justify-end gap-2">
          <UButton variant="soft" color="neutral" @click="open = false">Cancel</UButton>
          <UButton :loading="saving" icon="i-lucide-check" @click="submit">Record payment</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
