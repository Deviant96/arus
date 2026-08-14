import type { AIProviderName } from '../../../shared/schemas/ai'
import { DomainError } from '../errors'
import { OpenAIProvider } from './openai'
import { GeminiProvider } from './gemini'

export interface AICompletionRequest {
  system: string
  user: string
  model: string
  apiKey: string
}

/**
 * Provider abstraction — add future providers by implementing this interface
 * and registering it in `createAIProvider`.
 */
export interface AIProvider {
  readonly name: AIProviderName
  complete: (req: AICompletionRequest) => Promise<string>
}

export function createAIProvider(name: AIProviderName): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider()
    case 'gemini':
      return new GeminiProvider()
    default:
      throw new DomainError(`Unsupported AI provider: ${name satisfies never}`, 400)
  }
}

/** Translate provider HTTP failures into safe, user-friendly errors. */
export function mapProviderError(status: number | undefined, provider: string): DomainError {
  if (status === 401 || status === 403) {
    return new DomainError(`Your ${provider} API key was rejected. Check the key in Settings → AI.`, 400)
  }
  if (status === 429) {
    return new DomainError(`${provider} is rate-limiting requests right now. Try again in a minute.`, 429)
  }
  if (status === 404) {
    return new DomainError(`The selected model is not available for your ${provider} account.`, 400)
  }
  return new DomainError(`The ${provider} request failed. Please try again.`, 502)
}
