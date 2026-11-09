/**
 * Anthropic-provider.
 *
 * Bewust `fetch` en geen SDK: dit is één endpoint met een stabiel contract, en
 * de SDK zou een afhankelijkheid toevoegen die in de Next-serverbundle terecht
 * komt zonder dat we er meer voor terugkrijgen dan een typeddefinitie.
 *
 * De modelnaam komt uit `AI_MODEL` en staat nergens in deze code. Een
 * hardcoded modelnaam werkt tot het model uitgefaseerd wordt en breekt dan in
 * productie, ver van de plek waar hij staat.
 */
import 'server-only'
import { AiResponseError } from '@/lib/errors'
import { env } from '@/config/env'
import type { AiCompletion, AiCompletionOptions, AiProvider } from '@/types/ai'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

interface AnthropicResponse {
  content: { type: string; text?: string }[]
  model: string
  usage?: { input_tokens: number; output_tokens: number }
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async completeText(options: AiCompletionOptions): Promise<AiCompletion> {
    const data = await this.request(options)
    const text = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim()

    if (!text) throw new AiResponseError('Het model gaf een leeg antwoord')

    return {
      text,
      model: data.model,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    }
  }

  /**
   * Gestructureerde output.
   *
   * We vragen om JSON en valideren met Zod. Bij een ongeldig antwoord proberen
   * we het opnieuw met de validatiefout erbij — modellen corrigeren zichzelf
   * doorgaans op de eerste poging. Het aantal pogingen staat in
   * `AI_MAX_VALIDATION_RETRIES` en is bewust laag: blijven proberen kost geld
   * en levert bij een structureel probleem niets op.
   */
  async completeJson<T>(
    options: AiCompletionOptions & {
      schemaName: string
      jsonSchema: Record<string, unknown>
      validate: (value: unknown) => T
    },
  ): Promise<{ value: T; model: string }> {
    const instruction =
      `${options.system}\n\n` +
      `Antwoord uitsluitend met geldige JSON die voldoet aan dit schema, zonder ` +
      `toelichting en zonder markdown-codeblok:\n${JSON.stringify(options.jsonSchema)}`

    let messages = options.messages
    let lastError: unknown

    for (let attempt = 0; attempt <= env.AI_MAX_VALIDATION_RETRIES; attempt++) {
      const completion = await this.completeText({ ...options, system: instruction, messages })

      try {
        return { value: options.validate(parseJson(completion.text)), model: completion.model }
      } catch (error) {
        lastError = error
        messages = [
          ...messages,
          { role: 'assistant', content: completion.text },
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

  private async request(options: AiCompletionOptions): Promise<AnthropicResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0,
          system: options.system,
          messages: options.messages,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // De body kan de prompt bevatten; die gaat niet in de foutmelding.
        throw new AiResponseError(`Anthropic gaf status ${response.status}`)
      }

      return (await response.json()) as AnthropicResponse
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** Haalt JSON uit een antwoord dat eventueel in een codeblok verpakt zit. */
export function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned)
}
