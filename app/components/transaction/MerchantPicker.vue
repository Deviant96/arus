<script setup lang="ts">
import type { MerchantDto } from '#shared/types/api'
import { useSyncStore } from '../../stores/sync'

/**
 * Merchant autocomplete: free text creates a new merchant on save; picking a
 * suggestion links the existing one. Works offline from the cached list.
 */
const merchantId = defineModel<string | null>('merchantId', { default: null })
const merchantName = defineModel<string | null>('merchantName', { default: null })

const emit = defineEmits<{ picked: [merchant: MerchantDto] }>()

const { merchants } = useLookups()
const sync = useSyncStore()

const query = ref(merchantName.value ?? '')
const open = ref(false)
const remote = ref<MerchantDto[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined

const suggestions = computed<MerchantDto[]>(() => {
  const q = query.value.trim().toLowerCase()
  const local = merchants.value.filter(m => !q || m.name.toLowerCase().includes(q))
  const seen = new Set(local.map(m => m.id))
  const extra = remote.value.filter(m => !seen.has(m.id))
  return [...local, ...extra].slice(0, 6)
})

watch(query, (q) => {
  merchantName.value = q || null
  merchantId.value = null
  clearTimeout(searchTimer)
  if (q.trim().length >= 2 && sync.isOnline) {
    searchTimer = setTimeout(async () => {
      try {
        const res = await $fetch<{ items: MerchantDto[] }>('/api/merchants', { params: { q: q.trim(), limit: 6 } })
        remote.value = res.items
      }
      catch { /* offline fallback already covered by local list */ }
    }, 250)
  }
})

function pick(m: MerchantDto) {
  merchantId.value = m.id
  merchantName.value = m.name
  query.value = m.name
  open.value = false
  emit('picked', m)
}

function closeSoon() {
  setTimeout(() => { open.value = false }, 150)
}

function syncFromOutside() {
  query.value = merchantName.value ?? ''
}

defineExpose({ syncFromOutside })
</script>

<template>
  <div class="relative">
    <UInput
      v-model="query"
      placeholder="Merchant (e.g. Starbucks)"
      icon="i-lucide-store"
      class="w-full"
      autocomplete="off"
      @focus="open = true"
      @blur="closeSoon"
    />
    <div
      v-if="open && suggestions.length"
      class="absolute z-30 mt-1 w-full rounded-xl border border-default bg-elevated shadow-xl overflow-hidden"
    >
      <button
        v-for="m in suggestions"
        :key="m.id"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accented/50"
        @mousedown.prevent="pick(m)"
      >
        <UIcon name="i-lucide-store" class="size-3.5 text-muted" />
        <span class="flex-1 truncate">{{ m.name }}</span>
        <span v-if="m.transactionCount" class="text-xs text-dimmed">{{ m.transactionCount }}×</span>
      </button>
    </div>
  </div>
</template>
