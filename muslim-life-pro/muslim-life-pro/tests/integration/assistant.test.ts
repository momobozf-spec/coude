import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  createConversation,
  deleteConversation,
  deriveTitle,
  getConversation,
  listConversations,
  sendMessage,
} from '@/server/modules/assistant/conversation.service'
import { generatePlan, getPlan, listPlans } from '@/server/modules/assistant/plan-generator.service'
import { applyGeneratedPlan } from '@/server/modules/assistant/plan-apply.service'
import { getUsage, reserve, release, commit } from '@/server/modules/assistant/usage.service'
import { listToday } from '@/server/modules/planner/task.service'
import { listBlocksForDay } from '@/server/modules/planner/planner-block.service'
import { NotFoundError, QuotaExceededError } from '@/lib/errors'
import { PLAN_LIMITS } from '@/config/plans'
import { todayIn } from '@/lib/dates'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — ASSISTANT integration tests were SKIPPED.\n',
  )
}

const TZ = 'Europe/Brussels'

describeIfDb('conversations', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`assistant-${Date.now()}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('persists a message exchange', async () => {
    const result = await sendMessage(actor, { message: 'Help me plan my week' })

    expect(result.conversationId).toBeTruthy()
    expect(result.reply.length).toBeGreaterThan(0)

    const conversation = await getConversation(actor, result.conversationId)
    expect(conversation.messages).toHaveLength(2)
  })

  it('orders messages oldest first', async () => {
    const first = await sendMessage(actor, { message: 'First question' })
    await sendMessage(actor, { conversationId: first.conversationId, message: 'Second question' })

    const conversation = await getConversation(actor, first.conversationId)
    const userMessages = conversation.messages.filter((message) => message.role === 'USER')

    expect(userMessages[0]!.content).toBe('First question')
    expect(userMessages[1]!.content).toBe('Second question')

    for (let i = 1; i < conversation.messages.length; i++) {
      expect(
        conversation.messages[i]!.createdAt.getTime(),
      ).toBeGreaterThanOrEqual(conversation.messages[i - 1]!.createdAt.getTime())
    }
  })

  it('never returns system messages to a member', async () => {
    const prisma = testPrisma()
    const conversation = await createConversation(actor, 'With a system message')

    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'SYSTEM',
        content: 'INTERNAL SYSTEM PROMPT — must never be exposed',
      },
    })

    const loaded = await getConversation(actor, conversation.id)

    // The return type does not even admit a SYSTEM role — TypeScript rejects a
    // comparison against it — so this asserts what actually matters: the prompt
    // text is nowhere in the payload that reaches the client.
    expect(loaded.messages).toHaveLength(0)
    expect(JSON.stringify(loaded)).not.toContain('INTERNAL SYSTEM PROMPT')

    // It is still stored, for auditability.
    const stored = await prisma.aIMessage.count({
      where: { conversationId: conversation.id, role: 'SYSTEM' },
    })
    expect(stored).toBe(1)
  })

  it('derives a title from the first message without a model call', async () => {
    expect(deriveTitle('Plan my week around work')).toBe('Plan my week around work')
    expect(deriveTitle('')).toBe('New conversation')
    expect(deriveTitle('a'.repeat(120)).endsWith('…')).toBe(true)

    const result = await sendMessage(actor, { message: 'Prepare for a trip to Istanbul' })
    const conversation = await getConversation(actor, result.conversationId)
    expect(conversation.title).toContain('Istanbul')
  })

  it('lists conversations newest first', async () => {
    const conversations = await listConversations(actor)
    expect(conversations.length).toBeGreaterThan(0)

    for (let i = 1; i < conversations.length; i++) {
      expect(conversations[i - 1]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        conversations[i]!.updatedAt.getTime(),
      )
    }
  })

  it('cascades messages when a conversation is deleted', async () => {
    const prisma = testPrisma()
    const result = await sendMessage(actor, { message: 'Temporary conversation' })

    await deleteConversation(actor, result.conversationId)

    const remaining = await prisma.aIMessage.count({
      where: { conversationId: result.conversationId },
    })
    expect(remaining).toBe(0)
  })

  it('flags a ruling request on the stored message', async () => {
    const prisma = testPrisma()
    const result = await sendMessage(actor, { message: 'Is my prayer valid if I forgot wudu?' })

    const stored = await prisma.aIMessage.findFirst({
      where: { conversationId: result.conversationId, role: 'USER' },
      select: { flagged: true, flagReason: true },
    })

    expect(stored?.flagged).toBe(true)
    expect(stored?.flagReason).toContain('RULING')

    // And the reply carries the referral, applied server-side.
    expect(result.reply.toLowerCase()).toContain('qualified scholar')
  })
})

describeIfDb('generated plans and planner integration', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`plans-${Date.now()}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('generates a plan in READY, never APPLIED', async () => {
    const plan = await generatePlan(actor, { type: 'WEEKLY' })

    // The hard rule: generation never writes to the planner.
    expect(plan.status).toBe('READY')
    expect(plan.appliedAt).toBeNull()
    expect(plan.items.length).toBeGreaterThan(0)
  })

  it('creates no tasks at generation time', async () => {
    const today = todayIn(TZ)
    const before = await listToday(actor, today)

    await generatePlan(actor, { type: 'WEEKLY' })

    const after = await listToday(actor, today)
    expect(after.length).toBe(before.length)
  })

  it('persists items relationally, so suggestion → task is traceable', async () => {
    const prisma = testPrisma()
    const plan = await generatePlan(actor, { type: 'WEEKLY' })

    const items = await prisma.generatedPlanItem.findMany({ where: { planId: plan.id } })
    expect(items.length).toBe(plan.items.length)
    expect(items.every((item) => item.itemKey.length > 0)).toBe(true)
  })

  it('applies only the selected items and links them back', async () => {
    const prisma = testPrisma()
    const plan = await generatePlan(actor, { type: 'WEEKLY' })

    const actionable = plan.items.filter(
      (item) => item.kind === 'TASK' || item.kind === 'BLOCK',
    )
    const chosen = actionable.slice(0, 2)

    const result = await applyGeneratedPlan(actor, {
      planId: plan.id,
      selections: chosen.map((item) => ({ itemId: item.id })),
    })

    expect(result.tasksCreated + result.blocksCreated).toBe(chosen.length)
    expect(result.plan.status).toBe('APPLIED')

    // Applied items carry the id of the row they created.
    const applied = await prisma.generatedPlanItem.findMany({
      where: { planId: plan.id, status: 'APPLIED' },
    })
    expect(applied.length).toBe(chosen.length)
    for (const item of applied) {
      expect(item.taskId || item.blockId).toBeTruthy()
    }

    // Unselected items are recorded as skipped, not left pending forever.
    const skipped = await prisma.generatedPlanItem.count({
      where: { planId: plan.id, status: 'SKIPPED' },
    })
    expect(skipped).toBe(actionable.length - chosen.length + countNotes(plan.items))
  })

  it('makes applied items visible in the planner', async () => {
    const plan = await generatePlan(actor, { type: 'WEEKLY' })
    const today = todayIn(TZ)

    const todayTask = plan.items.find(
      (item) => item.kind === 'TASK' && item.localDate === today,
    )
    if (!todayTask) return

    await applyGeneratedPlan(actor, {
      planId: plan.id,
      selections: [{ itemId: todayTask.id }],
    })

    // The moat: it lands in the real planner, not a parallel AI list.
    const tasks = await listToday(actor, today)
    expect(tasks.map((task) => task.title)).toContain(todayTask.title)
  })

  it('creates blocks in the real planner', async () => {
    const plan = await generatePlan(actor, { type: 'WEEKLY' })
    const block = plan.items.find((item) => item.kind === 'BLOCK' && item.localDate)
    if (!block) return

    await applyGeneratedPlan(actor, { planId: plan.id, selections: [{ itemId: block.id }] })

    const blocks = await listBlocksForDay(actor, block.localDate!)
    expect(blocks.map((entry) => entry.title)).toContain(block.title)
  })

  it('honours member edits made in the preview', async () => {
    const plan = await generatePlan(actor, { type: 'WEEKLY' })
    const item = plan.items.find((entry) => entry.kind === 'TASK')!
    const today = todayIn(TZ)

    await applyGeneratedPlan(actor, {
      planId: plan.id,
      selections: [{ itemId: item.id, title: 'Renamed by the member', localDate: today }],
    })

    const tasks = await listToday(actor, today)
    expect(tasks.map((task) => task.title)).toContain('Renamed by the member')
  })

  it('refuses to apply the same plan twice', async () => {
    const plan = await generatePlan(actor, { type: 'WEEKLY' })
    const item = plan.items.find((entry) => entry.kind === 'TASK')!

    await applyGeneratedPlan(actor, { planId: plan.id, selections: [{ itemId: item.id }] })

    await expect(
      applyGeneratedPlan(actor, { planId: plan.id, selections: [{ itemId: item.id }] }),
    ).rejects.toThrow()
  })

  it('does not duplicate tasks when the same plan content is applied again', async () => {
    const today = todayIn(TZ)

    const first = await generatePlan(actor, { type: 'WEEKLY' })
    const firstItem = first.items.find((item) => item.kind === 'TASK')!

    await applyGeneratedPlan(actor, {
      planId: first.id,
      selections: [{ itemId: firstItem.id, localDate: today, title: 'Duplicate probe' }],
    })

    // A regenerated plan proposing the same thing must not create a second copy.
    const second = await generatePlan(actor, { type: 'WEEKLY' })
    const secondItem = second.items.find((item) => item.kind === 'TASK')!

    const result = await applyGeneratedPlan(actor, {
      planId: second.id,
      selections: [{ itemId: secondItem.id, localDate: today, title: 'Duplicate probe' }],
    })

    expect(result.skipped).toBe(1)
    expect(result.tasksCreated).toBe(0)

    const tasks = await listToday(actor, today)
    expect(tasks.filter((task) => task.title === 'Duplicate probe')).toHaveLength(1)
  })

  it('leaves a regenerated plan as separate history', async () => {
    const before = await listPlans(actor)
    await generatePlan(actor, { type: 'RAMADAN' })
    const after = await listPlans(actor)

    expect(after.length).toBe(before.length + 1)
  })

  it('generates each plan type', async () => {
    for (const input of [
      { type: 'RAMADAN' as const },
      { type: 'TRAVEL' as const, destination: 'Istanbul' },
      { type: 'LIFE_EVENT' as const, event: 'Wedding' },
    ]) {
      const plan = await generatePlan(actor, input)
      expect(plan.items.length, input.type).toBeGreaterThan(0)
      expect(plan.status).toBe('READY')
    }
  })
})

function countNotes(items: { kind: string }[]): number {
  return items.filter((item) => item.kind === 'NOTE' || item.kind === 'HABIT_SUGGESTION').length
}

describeIfDb('assistant cross-user isolation', () => {
  let alice: ReturnType<typeof actorFor>
  let bob: ReturnType<typeof actorFor>
  const created: string[] = []

  let aliceConversationId: string
  let alicePlanId: string
  let alicePlanItemId: string

  beforeAll(async () => {
    const stamp = Date.now()
    const a = await createTestUser(`ai-alice-${stamp}@test.local`, 'PREMIUM')
    const b = await createTestUser(`ai-bob-${stamp}@test.local`, 'PREMIUM')

    created.push(a.id, b.id)
    alice = actorFor(a.id, a.email, 'PREMIUM')
    bob = actorFor(b.id, b.email, 'PREMIUM')

    const conversation = await sendMessage(alice, { message: 'Alice private question' })
    aliceConversationId = conversation.conversationId

    const plan = await generatePlan(alice, { type: 'WEEKLY' })
    alicePlanId = plan.id
    alicePlanItemId = plan.items.find((item) => item.kind === 'TASK')!.id
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('does not expose a conversation to another member', async () => {
    await expect(getConversation(bob, aliceConversationId)).rejects.toThrow(NotFoundError)

    const bobConversations = await listConversations(bob)
    expect(bobConversations.map((c) => c.id)).not.toContain(aliceConversationId)
  })

  it('does not let another member delete a conversation', async () => {
    await expect(deleteConversation(bob, aliceConversationId)).rejects.toThrow(NotFoundError)

    const stillThere = await getConversation(alice, aliceConversationId)
    expect(stillThere.messages.length).toBeGreaterThan(0)
  })

  it('does not expose a plan to another member', async () => {
    expect(await getPlan(bob, alicePlanId)).toBeNull()

    const bobPlans = await listPlans(bob)
    expect(bobPlans.map((plan) => plan.id)).not.toContain(alicePlanId)
  })

  it('does not let another member apply a plan', async () => {
    await expect(
      applyGeneratedPlan(bob, { planId: alicePlanId, selections: [{ itemId: alicePlanItemId }] }),
    ).rejects.toThrow()

    const plan = await getPlan(alice, alicePlanId)
    expect(plan?.status).toBe('READY')
  })
})

describeIfDb('AI usage quotas', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function freshUser(plan: 'FREE' | 'PREMIUM') {
    const user = await createTestUser(
      `quota-${plan}-${Date.now()}-${Math.round(performance.now())}@test.local`,
      plan,
    )
    created.push(user.id)
    return actorFor(user.id, user.email, plan)
  }

  it('reports the free allowance', async () => {
    const actor = await freshUser('FREE')
    const usage = await getUsage(actor)

    expect(usage.messageLimit).toBe(PLAN_LIMITS.FREE.aiMessagesPerMonth)
    expect(usage.messagesRemaining).toBe(PLAN_LIMITS.FREE.aiMessagesPerMonth)
  })

  it('blocks a free member from generators without calling the provider', async () => {
    const actor = await freshUser('FREE')

    // Free has zero generator allowance, so the reservation fails before any
    // provider call — an out-of-quota member costs nothing.
    await expect(generatePlan(actor, { type: 'WEEKLY' })).rejects.toThrow(QuotaExceededError)

    const prisma = testPrisma()
    const plans = await prisma.generatedPlan.count({ where: { userId: actor.userId } })
    expect(plans).toBe(0)
  })

  it('counts messages and refuses past the limit', async () => {
    const actor = await freshUser('FREE')
    const limit = PLAN_LIMITS.FREE.aiMessagesPerMonth

    for (let i = 0; i < limit; i++) {
      await sendMessage(actor, { message: `Message ${i}` })
    }

    const usage = await getUsage(actor)
    expect(usage.messageCount).toBe(limit)
    expect(usage.messagesRemaining).toBe(0)

    await expect(sendMessage(actor, { message: 'One too many' })).rejects.toThrow(
      QuotaExceededError,
    )
  })

  it('never lets concurrent requests both claim the last slot', async () => {
    const actor = await freshUser('FREE')
    const limit = PLAN_LIMITS.FREE.aiMessagesPerMonth

    // Burn all but one.
    for (let i = 0; i < limit - 1; i++) {
      await reserve(actor, 'MESSAGE')
    }

    // Two racers, one slot. Exactly one must win.
    const results = await Promise.allSettled([
      reserve(actor, 'MESSAGE'),
      reserve(actor, 'MESSAGE'),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const usage = await getUsage(actor)
    expect(usage.messageCount).toBe(limit)
  })

  it('releases a slot when the provider fails', async () => {
    const actor = await freshUser('PREMIUM')

    const before = await getUsage(actor)
    const reservation = await reserve(actor, 'MESSAGE')

    const during = await getUsage(actor)
    expect(during.messageCount).toBe(before.messageCount + 1)

    // Infrastructure failure: the member got nothing, so the slot goes back.
    await release(reservation)

    const after = await getUsage(actor)
    expect(after.messageCount).toBe(before.messageCount)
  })

  it('records tokens on commit', async () => {
    const actor = await freshUser('PREMIUM')
    const reservation = await reserve(actor, 'MESSAGE')

    await commit(reservation, { inputTokens: 120, outputTokens: 340 })

    const prisma = testPrisma()
    const usage = await prisma.aIUsage.findFirst({ where: { userId: actor.userId } })

    expect(usage?.tokensIn).toBe(120)
    expect(usage?.tokensOut).toBe(340)
    expect(usage?.reserved).toBe(0)
  })

  it('is idempotent — releasing twice does not refund twice', async () => {
    const actor = await freshUser('PREMIUM')
    const reservation = await reserve(actor, 'MESSAGE')

    await release(reservation)
    await release(reservation)

    const usage = await getUsage(actor)
    expect(usage.messageCount).toBe(0)
  })
})
