import { z } from 'zod'

import { errorForStatus, parseSseStream, postJson, withRetry } from '@/server/integrations/ai/http'
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
 * Anthropic adapter (Messages API over HTTP).
 *
 * Structured output goes through a forced tool call: the schema becomes the
 * tool's input schema and `tool_choice` requires it, which is far more reliable
 * than asking for JSON in prose and hoping.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

interface AnthropicConfig {
  apiKey: string
  model: string
}

const usageSchema = z
  .object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() })
  .optional()

function toUsage(raw: unknown) {
  const parsed = usageSchema.safeParse(raw)
  return {
    inputTokens: parsed.success ? (parsed.data?.input_tokens ?? 0) : 0,
    outputTokens: parsed.success ? (parsed.data?.output_tokens ?? 0) : 0,
  }
}

export function createAnthropicProvider(config: AnthropicConfig): AiProvider {
  const headers = {
    'x-api-key': config.apiKey,
    'anthropic-version': API_VERSION,
  }

  return {
    id: 'anthropic',
    model: config.model,
    isConfigured: true,

    async chat(input: ChatInput): Promise<ChatResult> {
      const response = await withRetry(() =>
        postJson({
          url: API_URL,
          headers,
          signal: input.signal,
          body: {
            model: config.model,
            system: input.system,
            messages: input.messages.filter((message) => message.role !== 'system'),
            max_tokens: input.maxTokens ?? 2048,
            temperature: input.temperature ?? 0.7,
          },
        }),
      )

      const payload = (await response.json()) as {
        content?: { type: string; text?: string }[]
        usage?: unknown
      }

      const text = (payload.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('')

      if (text.trim().length === 0) {
        throw new AiProviderError('INVALID_OUTPUT', 'The model returned no text.', {
          retryable: false,
        })
      }

      return { text, usage: toUsage(payload.usage), provider: 'anthropic', model: config.model }
    },

    async *stream(input: ChatInput): AsyncIterable<ChatChunk> {
      // Streaming is deliberately not retried: once bytes have reached the
      // member, restarting would duplicate visible output.
      const response = await postJson({
        url: API_URL,
        headers,
        signal: input.signal,
        body: {
          model: config.model,
          system: input.system,
          messages: input.messages.filter((message) => message.role !== 'system'),
          max_tokens: input.maxTokens ?? 2048,
          temperature: input.temperature ?? 0.7,
          stream: true,
        },
      })

      let inputTokens = 0
      let outputTokens = 0

      for await (const event of parseSseStream(response)) {
        const frame = event as {
          type?: string
          delta?: { type?: string; text?: string }
          message?: { usage?: unknown }
          usage?: unknown
        }

        if (frame.type === 'message_start') {
          const usage = toUsage(frame.message?.usage)
          inputTokens = usage.inputTokens
        }

        if (frame.type === 'content_block_delta' && frame.delta?.type === 'text_delta') {
          const text = frame.delta.text ?? ''
          if (text) yield { type: 'text', text }
        }

        if (frame.type === 'message_delta') {
          outputTokens = toUsage(frame.usage).outputTokens || outputTokens
        }
      }

      yield {
        type: 'done',
        usage: { inputTokens, outputTokens },
        provider: 'anthropic',
        model: config.model,
      }
    },

    async generateStructured<T>(
      input: StructuredGenerationInput<T>,
    ): Promise<StructuredResult<T>> {
      const jsonSchema = z.toJSONSchema(input.schema, { target: 'draft-7' })

      const response = await withRetry(() =>
        postJson({
          url: API_URL,
          headers,
          signal: input.signal,
          body: {
            model: config.model,
            system: input.system,
            messages: input.messages.filter((message) => message.role !== 'system'),
            max_tokens: input.maxTokens ?? 4096,
            tools: [
              {
                name: input.schemaName,
                description: input.schemaDescription ?? 'Return the structured result.',
                input_schema: jsonSchema,
              },
            ],
            // Force the tool, so the model cannot answer in prose instead.
            tool_choice: { type: 'tool', name: input.schemaName },
          },
        }),
      )

      const payload = (await response.json()) as {
        content?: { type: string; name?: string; input?: unknown }[]
        usage?: unknown
      }

      const toolUse = (payload.content ?? []).find(
        (block) => block.type === 'tool_use' && block.name === input.schemaName,
      )

      if (!toolUse) {
        throw new AiProviderError('INVALID_OUTPUT', 'The model did not return structured output.', {
          retryable: false,
        })
      }

      // Never trusted directly — validated against the same schema the rest of
      // the application uses.
      const parsed = input.schema.safeParse(toolUse.input)
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
        provider: 'anthropic',
        model: config.model,
      }
    },
  }
}

export { errorForStatus }
