<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Show only the first N; the rest behind "More". */
  compactCount?: number
}>(), { compactCount: 8 })

const model = defineModel<string | null>({ default: null })

const { activeCategories } = useLookups()
const expanded = ref(false)

const visible = computed(() => {
  if (expanded.value || activeCategories.value.length <= props.compactCount + 1) return activeCategories.value
  const list = activeCategories.value.slice(0, props.compactCount)
  // Always include the selected one
  if (model.value && !list.some(c => c.id === model.value)) {
    const sel = activeCategories.value.find(c => c.id === model.value)
    if (sel) list.push(sel)
  }
  return list
})

const hasMore = computed(() => !expanded.value && activeCategories.value.length > visible.value.length)

function toggle(id: string) {
  model.value = model.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5" role="listbox" aria-label="Category">
    <button
      v-for="c in visible"
      :key="c.id"
      type="button"
      role="option"
      :aria-selected="model === c.id"
      class="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-all"
      :class="model === c.id
        ? 'border-primary/60 bg-primary/15 text-primary'
        : 'border-default bg-elevated/40 text-toned hover:border-accented hover:bg-elevated'"
      @click="toggle(c.id)"
    >
      <UIcon :name="c.icon || 'i-lucide-tag'" class="size-3.5" :style="model === c.id ? undefined : { color: c.color ?? undefined }" />
      {{ c.name }}
    </button>
    <button
      v-if="hasMore"
      type="button"
      class="rounded-full border border-default px-2.5 py-1.5 text-[13px] text-muted hover:bg-elevated"
      @click="expanded = true"
    >
      More…
    </button>
  </div>
</template>
