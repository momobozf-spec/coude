import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import { toErrorResponse } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { getAiProvider } from '@/server/integrations/ai'
import { completeTurn, prepareTurn } from '@/server/modules/assistant/conversation.service'
import { release } from '@/server/modules/assistant/usage.service'
import { enforce } from '@/server/services/rate-limit'

/**
 * Streaming chat.
 *
 * A route handler rather than a Server Action, because Server Actions cannot
 * return a stream. The response is real server-sent events fed by the provider's
 * own stream — the client renders tokens as they arrive rather than replaying a
 * finished string with a typing animation.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
})

function sse(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
}

export async function POST(request: Request) {
  let actor
  try {
    requireSameOrigin(request)
    actor = await requireActor()
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return Response.json(body, { status })
  }

  let turn
  try {
    await enforce('ai.message', actor.userId)

    const parsed = bodySchema.parse(await request.json())
    turn = await prepareTurn(actor, parsed)
  } catch (error) {
    // Quota, rate limit and validation all land here — before any provider call,
    // so a blocked request costs nothing.
    const { status, body } = toErrorResponse(error)
    return Response.json(body, { status })
  }

  const provider = getAiProvider()
  const preparedTurn = turn

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = ''
      let usage = { inputTokens: 0, outputTokens: 0 }
      let providerId = provider.id
      let model = provider.model
      let streamStarted = false

      try {
        controller.enqueue(sse({ type: 'start', conversationId: preparedTurn.conversationId }))

        for await (const chunk of provider.stream({
          system: preparedTurn.system,
          messages: preparedTurn.messages,
          signal: request.signal,
        })) {
          if (chunk.type === 'text') {
            streamStarted = true
            text += chunk.text
            controller.enqueue(sse({ type: 'delta', text: chunk.text }))
          } else {
            usage = chunk.usage
            providerId = chunk.provider
            model = chunk.model
          }
        }

        // The disclaimer is applied server-side after generation, so a model
        // that ignored its instructions still cannot omit it. The client
        // replaces its accumulated text with this final version.
        const finalText = await completeTurn(actor, preparedTurn, {
          text,
          usage,
          provider: providerId,
          model,
        })

        controller.enqueue(
          sse({
            type: 'done',
            content: finalText,
            conversationId: preparedTurn.conversationId,
            isDemoProvider: providerId === 'mock',
          }),
        )
      } catch (error) {
        logger.error('assistant.stream.failed', { error, userId: actor.userId })

        if (streamStarted) {
          // Output already reached the member and the provider has already been
          // billed. The call is counted — see the policy note in usage.service.
          await completeTurn(actor, preparedTurn, {
            text: text || '…',
            usage,
            provider: providerId,
            model,
          }).catch(() => undefined)
        } else {
          // Nothing was produced: give the quota slot back.
          await release(preparedTurn.reservation)
        }

        const { body } = toErrorResponse(error)
        controller.enqueue(sse({ type: 'error', message: body.error.message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Stops nginx and friends buffering the stream into one blob.
      'x-accel-buffering': 'no',
    },
  })
}
