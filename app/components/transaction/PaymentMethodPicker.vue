<script setup lang="ts">
import { PAYMENT_METHOD_TYPE_META } from '../../composables/useLookups'

const props = defineProps<{
  /** Exclude this id (e.g. the transfer counterpart). */
  excludeId?: string | null
  label?: string
}>()

const model = defineModel<string | null>({ default: null })
const { activePaymentMethods } = useLookups()

const list = computed(() => activePaymentMethods.value.filter(p => p.id !== props.excludeId))

// Searchable select for many methods, chips for few
const searchable = computed(() => list.value.length > 8)

const items = computed(() => list.value.map(p => ({
  label: p.name,
  value: p.id,
  icon: PAYMENT_METHOD_TYPE_META[p.type]?.icon ?? 'i-lucide-wallet',
})))

function toggle(id: string) {
  model.value = model.value === id ? null : id
}
</script>

<template>
  <div>
    <USelectMenu
      v-if="searchable"
      :model-value="model ?? undefined"
      :items="items"
      value-key="value"
      :search-input="{ placeholder: 'Search payment methods…' }"
      :placeholder="label ?? 'Select payment method'"
      class="w-full"
      size="lg"
      @update:model-value="model = ($event as string) ?? null"
    />
    <div v-else class="flex flex-wrap gap-1.5" role="listbox" :aria-label="label ?? 'Payment method'">
      <button
        v-for="p in list"
        :key="p.id"
        type="button"
        role="option"
        :aria-selected="model === p.id"
        class="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-all"
        :class="model === p.id
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-default bg-elevated/40 text-toned hover:border-accented hover:bg-elevated'"
        @click="toggle(p.id)"
      >
        <UIcon :name="PAYMENT_METHOD_TYPE_META[p.type]?.icon ?? 'i-lucide-wallet'" class="size-3.5" />
        {{ p.name }}
      </button>
    </div>
  </div>
</template>
