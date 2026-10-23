import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createMockProvider, MOCK_DEMO_PREFIX } from '@/server/integrations/ai/mock-provider'
import { AiProviderError } from '@/server/integrations/ai/types'
import { errorForStatus, withRetry } from '@/server/integrations/ai/http'
import { generatedPlanSchema } from '@/server/modules/assistant/plan.schema'

const provider = createMockProvider()

describe('mock provider — chat', () => {
  it('returns text and usage', async () => {
    const result = await provider.chat({
      system: 'You are a helper.',
      messages: [{ role: 'user', content: 'Plan my week' }],
    })

    expect(result.text.length).toBeGreaterThan(0)
    expect(result.provider).toBe('mock')
    expect(result.usage.inputTokens).toBeGreaterThan(0)
    expect(result.usage.outputTokens).toBeGreaterThan(0)
  })

  it('labels itself as a demo response', async () => {
    // A member must never mistake mock output for a real model.
    const result = await provider.chat({
      system: '',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.text).toContain(MOCK_DEMO_PREFIX)
  })

  it('is deterministic for the same input', async () => {
    const input = { system: 'x', messages: [{ role: 'user' as const, content: 'Plan my week' }] }

    const first = await provider.chat(input)
    const second = await provider.chat(input)

    expect(first.text).toBe(second.text)
  })

  it('answers a religious question with a referral, not a ruling', async () => {
    const result = await provider.chat({
      system: '',
      messages: [{ role: 'user', content: 'Is this halal for me?' }],
    })

    expect(result.text.toLowerCase()).toContain('scholars differ')
    expect(result.text.toLowerCase()).toContain('qualified scholar')
  })

  it('refuses when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      provider.chat({ system: '', messages: [{ role: 'user', content: 'x' }], signal: controller.signal }),
    ).rejects.toThrow(AiProviderError)
  })
})

describe('mock provider — streaming', () => {
  it('emits incremental chunks then a done frame', async () => {
    const chunks: string[] = []
    let done = false

    for await (const chunk of provider.stream({
      system: '',
      messages: [{ role: 'user', content: 'Plan my week' }],
    })) {
      if (chunk.type === 'text') chunks.push(chunk.text)
      else {
        done = true
        expect(chunk.usage.outputTokens).toBeGreaterThan(0)
      }
    }

    // More than one chunk, so the client genuinely renders incrementally.
    expect(chunks.length).toBeGreaterThan(3)
    expect(done).toBe(true)
  })

  it('reassembles to the same text as the non-streaming call', async () => {
    const input = { system: '', messages: [{ role: 'user' as const, content: 'Plan my week' }] }

    const full = await provider.chat(input)
    let streamed = ''
    for await (const chunk of provider.stream(input)) {
      if (chunk.type === 'text') streamed += chunk.text
    }

    expect(streamed).toBe(full.text)
  })

  it('stops early when cancelled mid-stream', async () => {
    const controller = new AbortController()
    let received = 0

    for await (const chunk of provider.stream({
      system: '',
      messages: [{ role: 'user', content: 'Plan my week' }],
      signal: controller.signal,
    })) {
      if (chunk.type === 'text') {
        received += 1
        if (received === 2) controller.abort()
      }
    }

    expect(received).toBeLessThan(10)
  })
})

describe('mock provider — structured generation', () => {
  it('produces output that satisfies the plan schema', async () => {
    for (const schemaName of ['weekly_plan', 'ramadan_plan', 'travel_plan', 'life_event_plan']) {
      const result = await provider.generateStructured({
        system: '',
        messages: [{ role: 'user', content: 'Generate' }],
        schema: generatedPlanSchema,
        schemaName,
      })

      expect(result.data.items.length, schemaName).toBeGreaterThan(0)
      expect(result.data.title.length).toBeGreaterThan(0)
    }
  })

  it('validates against the caller’s schema rather than trusting the fixture', async () => {
    // A schema the fixture cannot satisfy must fail loudly, so a schema change
    // breaks the mock too instead of silently diverging from the real provider.
    const impossible = z.object({ somethingElse: z.string() })

    await expect(
      provider.generateStructured({
        system: '',
        messages: [{ role: 'user', content: 'Generate' }],
        schema: impossible,
        schemaName: 'weekly_plan',
      }),
    ).rejects.toThrow(AiProviderError)
  })

  it('never proposes prayers as tasks', async () => {
    const result = await provider.generateStructured({
      system: '',
      messages: [{ role: 'user', content: 'Plan my week' }],
      schema: generatedPlanSchema,
      schemaName: 'weekly_plan',
    })

    const titles = result.data.items.map((item) => item.title.toLowerCase())
    for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(titles.some((title) => title === prayer)).toBe(false)
    }
  })
})

describe('http error mapping', () => {
  it('marks auth failures as not configured and not retryable', () => {
    const error = errorForStatus(401, '')

    expect(error.code).toBe('NOT_CONFIGURED')
    expect(error.retryable).toBe(false)
  })

  it('marks rate limits and 5xx as retryable', () => {
    expect(errorForStatus(429, '').retryable).toBe(true)
    expect(errorForStatus(503, '').retryable).toBe(true)
  })

  it('marks a 400 as refused and not retryable', () => {
    // Retrying an identical bad request just spends money to fail again.
    const error = errorForStatus(400, 'bad request')

    expect(error.code).toBe('REFUSED')
    expect(error.retryable).toBe(false)
  })
})

describe('withRetry', () => {
  it('retries a transient failure and then succeeds', async () => {
    let attempts = 0

    const result = await withRetry(
      async () => {
        attempts += 1
        if (attempts < 3) throw new AiProviderError('UNAVAILABLE', 'down')
        return 'ok'
      },
      { baseDelayMs: 1 },
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('never retries a refusal', async () => {
    let attempts = 0

    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw new AiProviderError('REFUSED', 'no', { retryable: false })
        },
        { baseDelayMs: 1 },
      ),
    ).rejects.toThrow(AiProviderError)

    expect(attempts).toBe(1)
  })

  it('never retries invalid output', async () => {
    // Re-rolling a refused or malformed generation is how a guardrail gets
    // sampled past.
    let attempts = 0

    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw new AiProviderError('INVALID_OUTPUT', 'bad shape')
        },
        { baseDelayMs: 1 },
      ),
    ).rejects.toThrow()

    expect(attempts).toBe(1)
  })

  it('gives up after the attempt limit', async () => {
    let attempts = 0

    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw new AiProviderError('TIMEOUT', 'slow')
        },
        { attempts: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow()

    expect(attempts).toBe(2)
  })
})
