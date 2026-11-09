import { stableHash } from '@/lib/utils'
import {
  AiProviderError,
  type AiProvider,
  type ChatChunk,
  type ChatInput,
  type StructuredGenerationInput,
  type StructuredResult,
} from '@/server/integrations/ai/types'

/**
 * Deterministic mock provider.
 *
 * The default. It exists so the entire assistant — chat, streaming, every
 * generator, the safety layer and the plan-apply flow — can be exercised with no
 * API key and no spend, in development and in CI.
 *
 * Responses are deterministic for a given input, which is what makes the tests
 * meaningful rather than flaky.
 *
 * Everything it produces is prefixed as a demo response, because a member must
 * never mistake mock output for a real model.
 */

export const MOCK_DEMO_PREFIX = '**Demo AI response** — no live model is configured.'

function lastUserMessage(input: ChatInput | StructuredGenerationInput<unknown>): string {
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const message = input.messages[i]
    if (message?.role === 'user') return message.content
  }
  return ''
}

function matches(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase()
  return needles.some((needle) => lower.includes(needle))
}

/** Canned replies, chosen by intent so the UI shows something coherent. */
function composeReply(prompt: string): string {
  if (matches(prompt, ['halal', 'haram', 'fatwa', 'ruling', 'permissible', 'mag ik'])) {
    return [
      MOCK_DEMO_PREFIX,
      '',
      'Scholars differ on questions like this, and the answer often depends on details of your specific situation.',
      '',
      '**What the discussion usually turns on**',
      '- The precise circumstances, which change the ruling',
      '- Which school of thought you follow',
      '- Local context and custom',
      '',
      'For a decision that affects you personally, put it to a qualified scholar who can ask you the follow-up questions. I can help you prepare what to ask, and organise whatever you decide.',
    ].join('\n')
  }

  if (matches(prompt, ['week', 'plan my', 'schedule', 'organise', 'organize'])) {
    return [
      MOCK_DEMO_PREFIX,
      '',
      'Here is how I would shape the week around your prayers and what is already in your planner.',
      '',
      '- Mornings after Fajr are your clearest focus window',
      '- Keep the block before Asr short — it tends to get interrupted',
      '- Leave Friday midday free for Jumu’ah',
      '',
      'I can turn this into planner items you review before anything is added.',
    ].join('\n')
  }

  if (matches(prompt, ['ramadan', 'fasting', 'suhoor', 'iftar'])) {
    return [
      MOCK_DEMO_PREFIX,
      '',
      'A Ramadan schedule works best when it is built backwards from sleep.',
      '',
      '- Decide your sleep window first, then fit worship and work around it',
      '- Set a Qur’an target you can hold on a tired day, not your best day',
      '- Batch cooking on the weekend removes most weekday pressure',
      '',
      'Tell me your working hours and I will draft something you can review.',
    ].join('\n')
  }

  if (matches(prompt, ['travel', 'trip', 'flight', 'istanbul', 'umrah', 'visiting'])) {
    return [
      MOCK_DEMO_PREFIX,
      '',
      'For a trip, I would split preparation into what must happen before you fly and what matters once you land.',
      '',
      '- Documents and money before anything else',
      '- Check prayer timings at your destination — they can shift by hours',
      '- Find two or three food options near where you are staying, in advance',
      '',
      'Shall I turn this into a checklist in your planner?',
    ].join('\n')
  }

  return [
    MOCK_DEMO_PREFIX,
    '',
    'I can help you organise this. In development no live model is connected, so this reply is canned — but the planner integration below is real, and anything I propose still goes through your review before it is added.',
  ].join('\n')
}

/** Rough token estimate so usage accounting is exercised in development. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function createMockProvider(model = 'mock-1'): AiProvider {
  return {
    id: 'mock',
    model,
    isConfigured: true,

    async chat(input) {
      if (input.signal?.aborted) {
        throw new AiProviderError('UNAVAILABLE', 'Request was cancelled.', { retryable: false })
      }

      const prompt = lastUserMessage(input)
      const text = composeReply(prompt)

      return {
        text,
        usage: {
          inputTokens: estimateTokens(input.system + prompt),
          outputTokens: estimateTokens(text),
        },
        provider: 'mock',
        model,
      }
    },

    async *stream(input): AsyncIterable<ChatChunk> {
      const prompt = lastUserMessage(input)
      const text = composeReply(prompt)

      // Chunked by word so the client exercises real incremental rendering.
      // This is a simulation of a stream, not a replay of a finished string —
      // the distinction matters because the consumer code path is identical.
      const words = text.split(/(\s+)/)
      let emitted = ''

      for (const word of words) {
        if (input.signal?.aborted) break
        emitted += word
        yield { type: 'text', text: word }
      }

      yield {
        type: 'done',
        usage: {
          inputTokens: estimateTokens(input.system + prompt),
          outputTokens: estimateTokens(emitted),
        },
        provider: 'mock',
        model,
      }
    },

    async generateStructured<T>(input: StructuredGenerationInput<T>): Promise<StructuredResult<T>> {
      const prompt = lastUserMessage(input)
      const fixture = buildFixture(input.schemaName, prompt)

      // The mock validates against the same schema as a real provider, so a
      // schema change breaks the mock too rather than silently diverging.
      const parsed = input.schema.safeParse(fixture)

      if (!parsed.success) {
        throw new AiProviderError(
          'INVALID_OUTPUT',
          `Mock fixture for "${input.schemaName}" no longer matches its schema.`,
          { retryable: false },
        )
      }

      return {
        data: parsed.data,
        usage: {
          inputTokens: estimateTokens(input.system + prompt),
          outputTokens: 400,
        },
        provider: 'mock',
        model,
      }
    },
  }
}

/**
 * Fixtures, keyed by generator.
 *
 * Dates are relative offsets resolved by the caller — the mock never invents
 * absolute dates, because a fixture that hard-codes 2026-08-07 rots.
 */
function buildFixture(schemaName: string, prompt: string): unknown {
  const seed = stableHash(prompt)

  switch (schemaName) {
    case 'weekly_plan':
      return {
        title: 'Your week, around your prayers',
        summary:
          'A light structure for the week: deep work in the mornings, errands after Asr, and Friday midday kept clear.',
        items: [
          { kind: 'TASK', title: 'Plan the week ahead', dayOffset: 0, preferredTime: '08:30', estimatedMinutes: 20, category: 'PERSONAL' },
          { kind: 'BLOCK', title: 'Deep work', dayOffset: 0, startTime: '09:00', endTime: '11:30', blockType: 'FOCUS' },
          { kind: 'TASK', title: 'Qur’an reading', dayOffset: 1, preferredTime: '07:00', estimatedMinutes: 20, category: 'WORSHIP' },
          { kind: 'BLOCK', title: 'Focus block', dayOffset: 1, startTime: '14:00', endTime: '17:00', blockType: 'FOCUS' },
          { kind: 'TASK', title: 'Weekly shop', dayOffset: 2, estimatedMinutes: 45, category: 'ERRAND' },
          { kind: 'TASK', title: 'Call family', dayOffset: 3, preferredTime: '19:00', estimatedMinutes: 30, category: 'FAMILY' },
          { kind: 'NOTE', title: 'Keep Friday midday clear for Jumu’ah' },
        ],
      }

    case 'ramadan_plan':
      return {
        title: 'Ramadan, built around your sleep',
        summary:
          'Suggestions only — your worship targets are yours to set. This shapes the practical day around them.',
        items: [
          { kind: 'HABIT_SUGGESTION', title: 'Qur’an — pages per day', description: 'Pick a number you can hold on a tired day.' },
          { kind: 'TASK', title: 'Plan suhoor meals for the week', dayOffset: 0, estimatedMinutes: 30, category: 'PERSONAL' },
          { kind: 'BLOCK', title: 'Rest before Isha', dayOffset: 0, startTime: '16:00', endTime: '17:00', blockType: 'PERSONAL' },
          { kind: 'TASK', title: 'Batch cook for the week', dayOffset: 1, estimatedMinutes: 120, category: 'PERSONAL' },
          { kind: 'TASK', title: 'Set aside charity for the month', dayOffset: 2, estimatedMinutes: 15, category: 'WORSHIP' },
          { kind: 'NOTE', title: 'Sleep window comes first; fit work around it, not the other way round.' },
        ],
      }

    case 'travel_plan':
      return {
        title: 'Trip preparation',
        summary: 'Split into what must happen before you fly and what matters once you land.',
        items: [
          { kind: 'TASK', title: 'Check passport validity', dayOffset: 0, estimatedMinutes: 10, category: 'ERRAND' },
          { kind: 'TASK', title: 'Arrange travel insurance', dayOffset: 0, estimatedMinutes: 20, category: 'ERRAND' },
          { kind: 'TASK', title: 'Look up prayer times at destination', dayOffset: 1, estimatedMinutes: 10, category: 'WORSHIP' },
          { kind: 'TASK', title: 'Find food options near the hotel', dayOffset: 1, estimatedMinutes: 20, category: 'PERSONAL' },
          { kind: 'TASK', title: 'Pack', dayOffset: 2, estimatedMinutes: 60, category: 'PERSONAL' },
          {
            kind: 'NOTE',
            title:
              'Shortening and combining prayers while travelling is a topic scholars discuss differently — worth asking someone qualified before you go.',
          },
        ],
      }

    case 'life_event_plan':
      return {
        title: 'Getting organised',
        summary: 'A practical starting checklist. Adjust anything that does not fit.',
        items: [
          { kind: 'TASK', title: 'Write down the budget', dayOffset: 0, estimatedMinutes: 45, category: 'PERSONAL' },
          { kind: 'TASK', title: 'List everyone who needs to be told', dayOffset: 1, estimatedMinutes: 30, category: 'FAMILY' },
          { kind: 'TASK', title: 'Agree the date with family', dayOffset: 2, estimatedMinutes: 30, category: 'FAMILY' },
          { kind: 'TASK', title: 'Research and shortlist options', dayOffset: 4, estimatedMinutes: 90, category: 'PERSONAL' },
          { kind: 'NOTE', title: 'Anything legal, medical or financial here should go to a qualified professional.' },
        ],
      }

    case 'conversation_title':
      return { title: seed % 2 === 0 ? 'Planning the week' : 'Getting organised' }

    default:
      return { title: 'Plan', summary: '', items: [] }
  }
}
