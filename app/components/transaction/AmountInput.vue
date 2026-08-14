<script setup lang="ts">
import { currencyDecimals, formatAmountPlain, parseAmountToMinor } from '#shared/utils/money'

/**
 * Large, fast amount input. Model value is integer minor units (or null).
 * Formats thousands separators live while typing.
 */
const props = withDefaults(defineProps<{
  currency?: string
  autofocus?: boolean
  size?: 'lg' | 'xl'
}>(), {
  currency: 'IDR',
  autofocus: false,
  size: 'xl',
})

const model = defineModel<number | null>({ default: null })

const inputEl = ref<HTMLInputElement | null>(null)
const text = ref('')

const symbol = computed(() => (props.currency === 'IDR' ? 'Rp' : props.currency))
const decimals = computed(() => currencyDecimals(props.currency))

function syncFromModel() {
  if (model.value == null || model.value === 0) {
    text.value = ''
  }
  else {
    text.value = formatAmountPlain(model.value, props.currency)
  }
}

watch(model, (v) => {
  // Only resync when the change came from outside (e.g. prefill)
  const current = parseAmountToMinor(text.value || '0', props.currency)
  if (v !== current) syncFromModel()
}, { immediate: true })

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  let raw = el.value

  if (decimals.value === 0) {
    // Digits only, live-grouped with dots (id-ID style)
    const digits = raw.replace(/\D/g, '').slice(0, 15)
    const grouped = digits ? Number(digits).toLocaleString('id-ID') : ''
    text.value = grouped
    el.value = grouped
    model.value = digits ? Number(digits) : null
  }
  else {
    raw = raw.replace(/[^\d.,]/g, '')
    text.value = raw
    el.value = raw
    model.value = parseAmountToMinor(raw, props.currency)
  }
}

function focus() {
  inputEl.value?.focus()
  inputEl.value?.select()
}

onMounted(() => {
  if (props.autofocus) setTimeout(focus, 80)
})

defineExpose({ focus })
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-2xl border border-default bg-elevated/50 px-4 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
    :class="size === 'xl' ? 'py-4' : 'py-2.5'"
  >
    <span class="text-muted font-medium" :class="size === 'xl' ? 'text-xl' : 'text-base'">{{ symbol }}</span>
    <input
      ref="inputEl"
      :value="text"
      inputmode="decimal"
      autocomplete="off"
      placeholder="0"
      aria-label="Amount"
      class="w-full bg-transparent outline-none font-semibold tnum placeholder:text-dimmed text-right"
      :class="size === 'xl' ? 'text-3xl' : 'text-xl'"
      @input="onInput"
    >
  </div>
</template>
