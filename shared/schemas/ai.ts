import { z } from 'zod'
import { zMonthString } from './common'

export const AI_PROVIDERS = ['openai', 'gemini'] as const
export type AIProviderName = (typeof AI_PROVIDERS)[number]

export const aiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim().min(10, 'API key looks too short').max(400),
  model: z.string().trim().min(1, 'Model is required').max(100),
})
export type AISettingsInput = z.infer<typeof aiSettingsSchema>

export const aiAnalyzeSchema = z.object({
  month: zMonthString,
})
export type AIAnalyzeInput = z.infer<typeof aiAnalyzeSchema>

export const DEFAULT_AI_MODELS: Record<AIProviderName, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
}
