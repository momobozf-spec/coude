import 'server-only'

import { isProduction, serverEnv } from '@/config/env'
import { createAnthropicProvider } from '@/server/integrations/ai/anthropic-provider'
import { createMockProvider } from '@/server/integrations/ai/mock-provider'
import { createOpenAiProvider } from '@/server/integrations/ai/openai-provider'
import { AiProviderError, type AiProvider } from '@/server/integrations/ai/types'

export * from '@/server/integrations/ai/types'
export { MOCK_DEMO_PREFIX } from '@/server/integrations/ai/mock-provider'

/**
 * Provider resolution.
 *
 * The only place a model name or vendor is chosen.
 *
 * **There is no silent fallback.** Naming a provider and omitting its key is a
 * misconfiguration, and it fails as one:
 *
 *   AI_PROVIDER=mock                   → mock
 *   AI_PROVIDER=anthropic, no key      → AI_NOT_CONFIGURED
 *   AI_PROVIDER=openai, no key         → AI_NOT_CONFIGURED
 *
 * Quietly serving canned replies while the UI says an assistant is active would
 * mean shipping a fake product — worse for a member than an honest error, and
 * worse still if they are paying for it.
 *
 * Mock in production is refused for the same reason, unless the deployment
 * explicitly opts in with `ALLOW_MOCK_AI_IN_PRODUCTION=true` (for a preview or
 * demo environment).
 */

export type AiStatus =
  | { configured: true; providerId: string; model: string; isMock: boolean }
  | { configured: false; reason: AiNotConfiguredReason; providerId: string }

export type AiNotConfiguredReason =
  | 'MISSING_API_KEY'
  | 'MOCK_NOT_ALLOWED_IN_PRODUCTION'

let cached: AiProvider | null = null
let cachedStatus: AiStatus | null = null

function resolve(): { provider: AiProvider | null; status: AiStatus } {
  const env = serverEnv()

  switch (env.AI_PROVIDER) {
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) {
        return {
          provider: null,
          status: { configured: false, reason: 'MISSING_API_KEY', providerId: 'anthropic' },
        }
      }

      const model = env.ANTHROPIC_MODEL ?? env.AI_MODEL
      return {
        provider: createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model }),
        status: { configured: true, providerId: 'anthropic', model, isMock: false },
      }
    }

    case 'openai': {
      if (!env.OPENAI_API_KEY) {
        return {
          provider: null,
          status: { configured: false, reason: 'MISSING_API_KEY', providerId: 'openai' },
        }
      }

      const model = env.OPENAI_MODEL ?? env.AI_MODEL
      return {
        provider: createOpenAiProvider({
          apiKey: env.OPENAI_API_KEY,
          model,
          baseUrl: env.OPENAI_BASE_URL,
        }),
        status: { configured: true, providerId: 'openai', model, isMock: false },
      }
    }

    case 'mock':
    default: {
      if (isProduction && !env.ALLOW_MOCK_AI_IN_PRODUCTION) {
        return {
          provider: null,
          status: {
            configured: false,
            reason: 'MOCK_NOT_ALLOWED_IN_PRODUCTION',
            providerId: 'mock',
          },
        }
      }

      const provider = createMockProvider()
      return {
        provider,
        status: { configured: true, providerId: 'mock', model: provider.model, isMock: true },
      }
    }
  }
}

/** Status, for UI and health checks. Never throws. */
export function getAiStatus(): AiStatus {
  if (cachedStatus) return cachedStatus

  const { provider, status } = resolve()
  cached = provider
  cachedStatus = status
  return status
}

/**
 * The provider. Throws `AiProviderError('NOT_CONFIGURED')` when the environment
 * names a provider it cannot actually use.
 */
export function getAiProvider(): AiProvider {
  const status = getAiStatus()

  if (!status.configured || !cached) {
    throw new AiProviderError(
      'NOT_CONFIGURED',
      status.configured
        ? 'The assistant is not configured.'
        : status.reason === 'MOCK_NOT_ALLOWED_IN_PRODUCTION'
          ? 'The mock assistant cannot be used in production. Configure a real provider, or set ALLOW_MOCK_AI_IN_PRODUCTION=true for a demo deployment.'
          : `AI_PROVIDER is "${status.providerId}" but no API key is configured for it.`,
      { retryable: false },
    )
  }

  return cached
}

/** Test seam. Passing `null` restores environment-driven resolution. */
export function setAiProvider(provider: AiProvider | null) {
  cached = provider
  cachedStatus = provider
    ? { configured: true, providerId: provider.id, model: provider.model, isMock: provider.id === 'mock' }
    : null
}

/** True when a real, paid provider is behind the abstraction. */
export function isLiveProvider(): boolean {
  const status = getAiStatus()
  return status.configured && !status.isMock
}

/** True when the assistant can be used at all. */
export function isAiConfigured(): boolean {
  return getAiStatus().configured
}
