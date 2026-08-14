import type { AICompletionRequest, AIProvider } from './provider'
import { mapProviderError } from './provider'

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const

  async complete(req: AICompletionRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Key goes in a header, not the URL, so it can never end up in logs
          'x-goog-api-key': req.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.user }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1600 },
        }),
        signal: AbortSignal.timeout(90_000),
      })
    }
    catch {
      throw mapProviderError(undefined, 'Gemini')
    }

    if (!response.ok) throw mapProviderError(response.status, 'Gemini')

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const content = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
    if (!content) throw mapProviderError(502, 'Gemini')
    return content
  }
}
