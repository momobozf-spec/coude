/**
 * Provider-factory voor AI. Eén actieve provider, gekozen via `AI_PROVIDER`.
 *
 * `AI_ENABLED=false` levert een provider op die netjes een `AiDisabledError`
 * gooit in plaats van `null` terug te geven. Zo hoeft geen enkele aanroeper te
 * controleren of AI aanstaat: de fout komt uit dezelfde plek als elke andere
 * AI-fout en wordt door dezelfde errorhandler afgehandeld. Dat scheelt een
 * `if (ai)` in elke route.
 */
import 'server-only'
import type { AiProvider } from '@/types/ai'
import { AiDisabledError } from '@/lib/errors'
import { env } from '@/config/env'
import { AnthropicProvider } from './anthropicProvider'
import { OpenAiProvider } from './openaiProvider'

class DisabledAiProvider implements AiProvider {
  readonly name = 'anthropic' as const

  completeText(): Promise<never> {
    return Promise.reject(new AiDisabledError())
  }

  completeJson<T>(): Promise<{ value: T; model: string }> {
    return Promise.reject(new AiDisabledError())
  }
}

let cached: AiProvider | undefined

export function getAiProvider(): AiProvider {
  cached ??= createAiProvider()
  return cached
}

function createAiProvider(): AiProvider {
  if (!env.AI_ENABLED) return new DisabledAiProvider()

  // Non-null: env.ts weigert deze combinaties zonder key en model.
  if (env.AI_PROVIDER === 'openai') {
    return new OpenAiProvider(env.OPENAI_API_KEY!, env.AI_MODEL!)
  }
  return new AnthropicProvider(env.ANTHROPIC_API_KEY!, env.AI_MODEL!)
}

/** Alleen voor tests: vervang de provider door een stub. */
export function setAiProvider(provider: AiProvider | undefined): void {
  cached = provider
}

export function isAiEnabled(): boolean {
  return env.AI_ENABLED
}
