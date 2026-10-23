import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { NotFoundError } from '@/lib/errors'
import { getAiProvider, isAiConfigured, isLiveProvider, type AiMessage } from '@/server/integrations/ai'
import { toAiError } from '@/server/modules/assistant/ai-errors'
import { buildAssistantContext } from '@/server/modules/assistant/context'
import { buildChatSystemPrompt } from '@/server/modules/assistant/prompts'
import { applyDisclaimer, classifyQuery, type SafetyAssessment } from '@/server/modules/assistant/safety'
import { commit, release, reserve, type Reservation } from '@/server/modules/assistant/usage.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

/**
 * Conversations.
 *
 * Every query is scoped by `userId` in the WHERE clause. System messages are
 * persisted for auditability but never returned to a member — the system prompt
 * is not theirs to read, and exposing it hands anyone the guardrails to work
 * around.
 */

export interface MessageView {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: Date
  disclaimerShown: boolean
  isDemoProvider: boolean
}

export interface ConversationView {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
}

export interface ConversationDetail extends ConversationView {
  messages: MessageView[]
}

/** SYSTEM is deliberately excluded from every read path. */
const VISIBLE_ROLES = ['USER', 'ASSISTANT'] as const

const MESSAGE_SELECT = {
  id: true,
  role: true,
  content: true,
  createdAt: true,
  disclaimerShown: true,
  provider: true,
} satisfies Prisma.AIMessageSelect

export async function listConversations(actor: Actor, take = 30): Promise<ConversationView[]> {
  const conversations = await prisma.aIConversation.findMany({
    where: { userId: actor.userId, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: { where: { role: { in: [...VISIBLE_ROLES] } } } } },
    },
  })

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation._count.messages,
  }))
}

export async function getConversation(
  actor: Actor,
  conversationId: string,
): Promise<ConversationDetail> {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId: actor.userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        where: { role: { in: [...VISIBLE_ROLES] } },
        orderBy: { createdAt: 'asc' },
        select: MESSAGE_SELECT,
      },
    },
  })

  if (!conversation) throw new NotFoundError('Conversation')

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role as 'USER' | 'ASSISTANT',
      content: message.content,
      createdAt: message.createdAt,
      disclaimerShown: message.disclaimerShown,
      isDemoProvider: message.provider === 'mock',
    })),
  }
}

export async function createConversation(actor: Actor, title?: string) {
  return prisma.aIConversation.create({
    data: { userId: actor.userId, title: title?.slice(0, 60) ?? 'New conversation' },
    select: { id: true, title: true },
  })
}

export async function deleteConversation(actor: Actor, conversationId: string): Promise<void> {
  // Messages cascade. Generated plans do NOT — see the ownership note in the
  // docs: a plan a member applied is planner history, not chat history, and
  // deleting the conversation must not silently revoke it.
  const { count } = await prisma.aIConversation.deleteMany({
    where: { id: conversationId, userId: actor.userId },
  })

  if (count === 0) throw new NotFoundError('Conversation')
}

/**
 * Deterministic title from the first message.
 *
 * No model call: conversation creation must never fail because a title could not
 * be generated, and a title is not worth a round trip.
 */
export function deriveTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim()
  if (cleaned.length === 0) return 'New conversation'
  if (cleaned.length <= 52) return cleaned

  const cut = cleaned.slice(0, 52)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export interface PreparedTurn {
  conversationId: string
  system: string
  messages: AiMessage[]
  assessment: SafetyAssessment
  reservation: Reservation
  userMessageId: string
}

/**
 * Everything before the provider call: quota, safety, context, persistence.
 *
 * Separated from the streaming itself so the route handler stays thin and the
 * whole pre-flight is unit-testable.
 */
export async function prepareTurn(
  actor: Actor,
  input: { conversationId?: string; message: string },
): Promise<PreparedTurn> {
  const content = input.message.trim().slice(0, 4000)

  // Fail before the quota is claimed: a deployment that names a provider without
  // a key must not spend a member's allowance to produce an error.
  if (!isAiConfigured()) {
    try {
      getAiProvider()
    } catch (error) {
      throw toAiError(error)
    }
  }

  // Classify before anything else — this decides the system prompt.
  const assessment = classifyQuery(content)

  // Quota is claimed before the provider is touched.
  const reservation = await reserve(actor, 'MESSAGE')

  try {
    let conversationId = input.conversationId

    if (conversationId) {
      const owned = await prisma.aIConversation.findFirst({
        where: { id: conversationId, userId: actor.userId },
        select: { id: true },
      })
      if (!owned) throw new NotFoundError('Conversation')
    } else {
      const created = await prisma.aIConversation.create({
        data: { userId: actor.userId, title: deriveTitle(content) },
        select: { id: true },
      })
      conversationId = created.id
    }

    const context = await buildAssistantContext(actor, { days: 7 })
    const system = buildChatSystemPrompt(context, assessment)

    // Recent turns only — a long conversation does not need replaying in full,
    // and every extra message is cost.
    const history = await prisma.aIMessage.findMany({
      where: { conversationId, role: { in: [...VISIBLE_ROLES] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    })

    const userMessage = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content,
        flagged: assessment.requiresScholarReferral,
        flagReason: assessment.requiresScholarReferral ? assessment.queryType : null,
      },
      select: { id: true },
    })

    await track(actor.userId, ANALYTICS_EVENTS.AI_MESSAGE_SENT, {
      isGenerator: false,
      requiredDisclaimer: assessment.requiresDisclaimer,
      requiredReferral: assessment.requiresScholarReferral,
    })

    const messages: AiMessage[] = [
      ...history
        .reverse()
        .map((message) => ({
          role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
          content: message.content,
        })),
      { role: 'user' as const, content },
    ]

    return {
      conversationId,
      system,
      messages,
      assessment,
      reservation,
      userMessageId: userMessage.id,
    }
  } catch (error) {
    await release(reservation)
    throw error
  }
}

/**
 * Persist the assistant's reply.
 *
 * The disclaimer is applied here, on the server, after the model has finished —
 * so it cannot be omitted by a model that decided not to follow instructions.
 */
export async function completeTurn(
  actor: Actor,
  turn: PreparedTurn,
  result: { text: string; usage: { inputTokens: number; outputTokens: number }; provider: string; model: string },
): Promise<string> {
  const finalText = applyDisclaimer(result.text, turn.assessment)

  await prisma.$transaction([
    prisma.aIMessage.create({
      data: {
        conversationId: turn.conversationId,
        role: 'ASSISTANT',
        content: finalText,
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens,
        provider: result.provider,
        model: result.model,
        disclaimerShown: turn.assessment.requiresDisclaimer || turn.assessment.requiresScholarReferral,
      },
    }),
    prisma.aIConversation.update({
      where: { id: turn.conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  await commit(turn.reservation, result.usage)

  await track(actor.userId, ANALYTICS_EVENTS.AI_RESPONSE_COMPLETED, {
    streamed: true,
    outputTokens: result.usage.outputTokens,
    isLiveProvider: isLiveProvider(),
  })

  return finalText
}

/** Non-streaming turn, used by tests and as a fallback. */
export async function sendMessage(
  actor: Actor,
  input: { conversationId?: string; message: string },
): Promise<{ conversationId: string; reply: string }> {
  const turn = await prepareTurn(actor, input)

  try {
    const provider = getAiProvider()
    const result = await provider.chat({ system: turn.system, messages: turn.messages })
    const reply = await completeTurn(actor, turn, result)

    return { conversationId: turn.conversationId, reply }
  } catch (error) {
    await release(turn.reservation)
    throw error
  }
}
