/**
 * Het contract waaraan elke AI-provider voldoet.
 *
 * De rest van de applicatie kent alleen dit interface. Nergens buiten
 * `src/server/integrations/ai/` staat de naam Anthropic of OpenAI, en nergens
 * staat een modelnaam — die komt uit `AI_MODEL` in de omgeving.
 */

export type AiProviderName = 'anthropic' | 'openai'

export interface AiMessageInput {
  role: 'user' | 'assistant'
  content: string
}

export interface AiCompletionOptions {
  /** De systeeminstructie. Bepaalt de grenzen van wat het model mag beweren. */
  system: string
  messages: AiMessageInput[]
  maxTokens?: number
  temperature?: number
}

export interface AiCompletion {
  text: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

export interface AiProvider {
  readonly name: AiProviderName

  /** Vrije tekst. Voor uitleg en samenvattingen. */
  completeText(options: AiCompletionOptions): Promise<AiCompletion>

  /**
   * Gestructureerde output, gevalideerd tegen een JSON-schema.
   * Wordt gebruikt door de zoekparser: vrije tekst in, `SearchCriteria` uit.
   */
  completeJson<T>(
    options: AiCompletionOptions & {
      schemaName: string
      jsonSchema: Record<string, unknown>
      validate: (value: unknown) => T
    },
  ): Promise<{ value: T; model: string }>
}
