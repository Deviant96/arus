<script setup lang="ts">
import type { AIAnalysisResult, AISettingsDto, InsightDto } from '#shared/types/api'
import { formatMonthString, pad2, todayInTz } from '#shared/utils/dates'

const api = useApi()
const toast = useToast()
const { timezone } = useFormat()

const month = ref(todayInTz(timezone.value).slice(0, 7))
const monthLabel = computed(() => formatMonthString(month.value))

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  month.value = `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

const { data: insights, status } = await useAsyncData('insights', async () => {
  const res = await api.cachedGet<{ items: InsightDto[] }>(`insights:${month.value}`, '/api/insights', { month: month.value })
  return res.data.items
}, { server: false, lazy: true, default: () => [], watch: [month] })

const { data: aiSettings } = await useAsyncData('ai-settings-insights', async () => {
  try {
    return await $fetch<AISettingsDto>('/api/ai/settings')
  }
  catch {
    return null
  }
}, { server: false, lazy: true })

const analyzing = ref(false)
const analysis = ref<AIAnalysisResult | null>(null)
const analysisHtml = ref('')

watch(analysis, async (a) => {
  if (!a || !import.meta.client) {
    analysisHtml.value = ''
    return
  }
  const [{ marked }, DOMPurify] = await Promise.all([
    import('marked'),
    import('dompurify').then(m => m.default),
  ])
  const html = marked.parse(a.content, { async: false }) as string
  analysisHtml.value = DOMPurify.sanitize(html)
})

async function analyze() {
  analyzing.value = true
  analysis.value = null
  try {
    analysis.value = await $fetch<AIAnalysisResult>('/api/ai/analyze', {
      method: 'POST',
      body: { month: month.value },
    })
  }
  catch (err: any) {
    toast.add({
      title: 'Analysis failed',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? 'Please try again.',
      color: 'error',
    })
  }
  finally {
    analyzing.value = false
  }
}
</script>

<template>
  <div>
    <UiPageHeader title="Insights" subtitle="Interpretation of your numbers — the app calculates, AI only explains" />

    <div class="px-4 sm:px-6 lg:px-8 space-y-6 max-w-3xl">
      <div class="flex items-center gap-1">
        <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="sm" aria-label="Previous month" @click="shiftMonth(-1)" />
        <span class="text-sm font-semibold w-40 text-center">{{ monthLabel }}</span>
        <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="sm" aria-label="Next month" @click="shiftMonth(1)" />
      </div>

      <!-- Rule-based insights -->
      <section>
        <h2 class="text-sm font-semibold mb-2 px-1">This month's patterns</h2>
        <div v-if="status === 'pending' && !insights?.length" class="space-y-2">
          <USkeleton v-for="i in 3" :key="i" class="h-16 rounded-2xl" />
        </div>
        <UiEmptyState
          v-else-if="(insights ?? []).length === 0"
          icon="i-lucide-lightbulb"
          title="Not enough data yet"
          description="Record a few transactions and insights will appear here — spending changes, weekend patterns, budget warnings and more."
        />
        <div v-else class="space-y-2">
          <InsightCard v-for="i in insights" :key="i.id" :insight="i" />
        </div>
      </section>

      <!-- AI analysis -->
      <section>
        <h2 class="text-sm font-semibold mb-2 px-1 flex items-center gap-2">
          AI analysis
          <UBadge color="neutral" variant="subtle" size="sm">optional</UBadge>
        </h2>

        <div v-if="!aiSettings?.configured" class="panel px-5 py-6 text-center">
          <UIcon name="i-lucide-sparkles" class="size-8 text-muted mx-auto mb-2" />
          <p class="text-sm font-medium">Bring your own AI key</p>
          <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
            Connect OpenAI or Gemini with your own API key to get a narrative analysis of your month.
            Arus works completely without it.
          </p>
          <UButton to="/settings/ai" variant="soft" size="sm" class="mt-4" icon="i-lucide-settings-2">
            Set up AI provider
          </UButton>
        </div>

        <div v-else class="panel px-5 py-4 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium">Analyze {{ monthLabel }}</p>
              <p class="text-xs text-muted mt-0.5">
                Sends a pre-aggregated summary (totals, categories, budgets, obligations) to {{ aiSettings.provider === 'openai' ? 'OpenAI' : 'Gemini' }} ·
                {{ aiSettings.model }} — never raw data, never your key to the browser.
              </p>
            </div>
            <UButton :loading="analyzing" icon="i-lucide-sparkles" @click="analyze">
              {{ analyzing ? 'Analyzing…' : 'Analyze with AI' }}
            </UButton>
          </div>

          <div v-if="analysis" class="rounded-xl bg-elevated/50 border border-default px-5 py-4">
            <div
              class="prose prose-invert prose-sm max-w-none prose-headings:text-sm prose-headings:font-semibold prose-p:text-[13px] prose-li:text-[13px] prose-p:leading-relaxed prose-li:leading-relaxed prose-p:text-zinc-300 prose-li:text-zinc-300"
              v-html="analysisHtml"
            />
            <p class="text-[11px] text-dimmed mt-3 border-t border-default pt-2">
              Generated by {{ analysis.provider }} · {{ analysis.model }}. Observations only — verify important decisions against the Reports page.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
