import { z } from 'zod'

import { parseSseStream, postJson, withRetry } from '@/server/integrations/ai/http'
import {
  AiProviderError,
  type AiProvider,
  type ChatChunk,
  type ChatInput,
  type ChatResult,
  type StructuredGenerationInput,
  type StructuredResult,
} from '@/server/integrations/ai/types'

/**
 * OpenAI-compatible adapter (Chat Completions over HTTP).
 *
 * Deliberately targets the Chat Completions shape rather than anything
 * proprietary, so this same adapter also serves Azure OpenAI, Together, Groq,
 * OpenRouter and a local vLLM — anything that speaks the same protocol — by
 * changing the base URL.
 */

interface OpenAiConfig {
  apiKey: string
  model: string
  baseUrl?: string
}

function toUsage(raw: unknown) {
  const parsed = z
    .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
    .safeParse(raw)

  return {
    inputTokens: parsed.success ? (parsed.data.prompt_tokens ?? 0) : 0,
    outputTokens: parsed.success ? (parsed.data.completion_tokens ?? 0) : 0,
  }
}

export function createOpenAiProvider(config: OpenAiConfig): AiProvider {
  const baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const url = `${baseUrl}/chat/completions`
  const headers = { authorization: `Bearer ${config.apiKey}` }

  function toMessages(input: { system: string; messages: ChatInput['messages'] }) {
    return [
      { role: 'system', content: input.system },
      ...input.messages.filter((message) => message.role !== 'system'),
    ]
  }

  return {
    id: 'openai',
    model: config.model,
    isConfigured: true,

    async chat(input: ChatInput): Promise<ChatResult> {
      const response = await withRetry(() =>
        postJson({
          url,
          headers,
          signal: input.signal,
          body: {
            model: config.model,
            messages: toMessages(input),
            max_completion_tokens: input.maxTokens ?? 2048,
            temperature: input.temperature ?? 0.7,
          },
        }),
      )

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: unknown
      }

      const text = payload.choices?.[0]?.message?.content ?? ''
      if (text.trim().length === 0) {
        throw new AiProviderError('INVALID_OUTPUT', 'The model returned no text.', {
          retryable: false,
        })
      }

      return { text, usage: toUsage(payload.usage), provider: 'openai', model: config.model }
    },

    async *stream(input: ChatInput): AsyncIterable<ChatChunk> {
      const response = await postJson({
        url,
        headers,
        signal: input.signal,
        body: {
          model: config.model,
          messages: toMessages(input),
          max_completion_tokens: input.maxTokens ?? 2048,
          temperature: input.temperature ?? 0.7,
          stream: true,
          stream_options: { include_usage: true },
        },
      })

      let usage = { inputTokens: 0, outputTokens: 0 }

      for await (const event of parseSseStream(response)) {
        const frame = event as {
          choices?: { delta?: { content?: string } }[]
          usage?: unknown
        }

        const text = frame.choices?.[0]?.delta?.content
        if (text) yield { type: 'text', text }

        if (frame.usage) usage = toUsage(frame.usage)
      }

      yield { type: 'done', usage, provider: 'openai', model: config.model }
    },

    async generateStructured<T>(
      input: StructuredGenerationInput<T>,
    ): Promise<StructuredResult<T>> {
      const jsonSchema = z.toJSONSchema(input.schema, { target: 'draft-7' })

      const response = await withRetry(() =>
        postJson({
          url,
          headers,
          signal: input.signal,
          body: {
            model: config.model,
            messages: toMessages(input),
            max_completion_tokens: input.maxTokens ?? 4096,
            // Strict JSON schema mode: the API rejects non-conforming output at
            // the source rather than leaving us to repair it.
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: input.schemaName,
                description: input.schemaDescription,
                schema: jsonSchema,
                strict: false,
              },
            },
          },
        }),
      )

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: unknown
      }

      const raw = payload.choices?.[0]?.message?.content
      if (!raw) {
        throw new AiProviderError('INVALID_OUTPUT', 'The model returned no structured output.', {
          retryable: false,
        })
      }

      let candidate: unknown
      try {
        candidate = JSON.parse(raw)
      } catch {
        throw new AiProviderError('INVALID_OUTPUT', 'The model returned malformed JSON.', {
          retryable: false,
        })
      }

      const parsed = input.schema.safeParse(candidate)
      if (!parsed.success) {
        throw new AiProviderError(
          'INVALID_OUTPUT',
          'The model returned output that does not match the required schema.',
          { retryable: false, cause: parsed.error.issues.slice(0, 5) },
        )
      }

      return {
        data: parsed.data,
        usage: toUsage(payload.usage),
        provider: 'openai',
        model: config.model,
      }
    },
  }
}
