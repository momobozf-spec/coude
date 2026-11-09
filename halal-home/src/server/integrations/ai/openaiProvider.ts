/**
 * OpenAI-provider. Zelfde contract als de Anthropic-provider; alleen de vorm
 * van het request verschilt.
 *
 * Ook hier: de modelnaam komt uit `AI_MODEL` en staat nergens in deze code.
 */
import 'server-only'
import { AiResponseError } from '@/lib/errors'
import { env } from '@/config/env'
import type { AiCompletion, AiCompletionOptions, AiProvider } from '@/types/ai'
import { parseJson } from './anthropicProvider'

const API_URL = 'https://api.openai.com/v1/chat/completions'

interface OpenAiResponse {
  choices: { message: { content: string | null } }[]
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async completeText(options: AiCompletionOptions): Promise<AiCompletion> {
    const data = await this.request(options, false)
    const text = data.choices[0]?.message.content?.trim() ?? ''
    if (!text) throw new AiResponseError('Het model gaf een leeg antwoord')

    return {
      text,
      model: data.model,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
  }

  async completeJson<T>(
    options: AiCompletionOptions & {
      schemaName: string
      jsonSchema: Record<string, unknown>
      validate: (value: unknown) => T
    },
  ): Promise<{ value: T; model: string }> {
    const instruction =
      `${options.system}\n\n` +
      `Antwoord uitsluitend met geldige JSON die voldoet aan dit schema:\n` +
      JSON.stringify(options.jsonSchema)

    let messages = options.messages
    let lastError: unknown

    for (let attempt = 0; attempt <= env.AI_MAX_VALIDATION_RETRIES; attempt++) {
      // json_object-modus dwingt syntactisch geldige JSON af; of het ook aan
      // óns schema voldoet, blijft de taak van Zod hieronder.
      const data = await this.request({ ...options, system: instruction, messages }, true)
      const text = data.choices[0]?.message.content?.trim() ?? ''

      try {
        return { value: options.validate(parseJson(text)), model: data.model }
      } catch (error) {
        lastError = error
        messages = [
          ...messages,
          { role: 'assistant', content: text },
          {
            role: 'user',
            content: `Dat antwoord voldeed niet aan het schema: ${
              error instanceof Error ? error.message : 'onbekende fout'
            }. Geef opnieuw uitsluitend geldige JSON.`,
          },
        ]
      }
    }

    throw new AiResponseError(
      `Het model gaf na ${env.AI_MAX_VALIDATION_RETRIES + 1} pogingen geen geldige ${options.schemaName}: ` +
        (lastError instanceof Error ? lastError.message : 'onbekende fout'),
    )
  }

  private async request(
    options: AiCompletionOptions,
    jsonMode: boolean,
  ): Promise<OpenAiResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0,
          messages: [
            { role: 'system', content: options.system },
            ...options.messages,
          ],
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new AiResponseError(`OpenAI gaf status ${response.status}`)
      }

      return (await response.json()) as OpenAiResponse
    } finally {
      clearTimeout(timeout)
    }
  }
}
