import type { z } from 'zod'

/**
 * The AI provider contract.
 *
 * This is the ONLY surface business code may depend on. No service outside
 * `src/server/integrations/ai/` imports a vendor SDK or knows a model name.
 */

export type AiRole = 'system' | 'user' | 'assistant'

export interface AiMessage {
  role: AiRole
  content: string
}

export interface ChatInput {
  /** System instruction. Never shown to the member. */
  system: string
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
  /** Abort signal, so a cancelled request stops billing. */
  signal?: AbortSignal
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChatResult {
  text: string
  usage: AiUsage
  provider: string
  model: string
}

export type ChatChunk =
  | { type: 'text'; text: string }
  | { type: 'done'; usage: AiUsage; provider: string; model: string }

export interface StructuredGenerationInput<T> {
  system: string
  messages: AiMessage[]
  /** The contract the output must satisfy. Validation is never skipped. */
  schema: z.ZodType<T>
  /** Name given to the provider's structured-output tool. */
  schemaName: string
  schemaDescription?: string
  maxTokens?: number
  signal?: AbortSignal
}

export interface StructuredResult<T> {
  data: T
  usage: AiUsage
  provider: string
  model: string
}

export interface AiProvider {
  readonly id: string
  readonly model: string
  /** False when no key is configured — the caller then reports AI_NOT_CONFIGURED. */
  readonly isConfigured: boolean

  chat(input: ChatInput): Promise<ChatResult>
  stream(input: ChatInput): AsyncIterable<ChatChunk>
  generateStructured<T>(input: StructuredGenerationInput<T>): Promise<StructuredResult<T>>
}

/**
 * Typed provider failures.
 *
 * `retryable` is what the caller uses to decide whether a retry is legitimate.
 * A validation or safety failure is never retryable — retrying a refused request
 * just burns money and can, with enough attempts, sample its way past a guardrail.
 */
export class AiProviderError extends Error {
  readonly code:
    | 'NOT_CONFIGURED'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE'
    | 'INVALID_OUTPUT'
    | 'REFUSED'
  readonly retryable: boolean
  readonly status?: number

  constructor(
    code: AiProviderError['code'],
    message: string,
    options: { retryable?: boolean; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AiProviderError'
    this.code = code
    this.status = options.status
    this.retryable =
      options.retryable ?? (code === 'TIMEOUT' || code === 'RATE_LIMITED' || code === 'UNAVAILABLE')
  }
}
