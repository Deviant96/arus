import type { AICompletionRequest, AIProvider } from './provider'
import { mapProviderError } from './provider'

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const

  async complete(req: AICompletionRequest): Promise<string> {
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          temperature: 0.3,
          max_tokens: 1600,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      })
    }
    catch {
      throw mapProviderError(undefined, 'OpenAI')
    }

    if (!response.ok) throw mapProviderError(response.status, 'OpenAI')

    const data = await response.json() as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw mapProviderError(502, 'OpenAI')
    return content
  }
}
