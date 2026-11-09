/**
 * Provider-factory. Eén actieve provider, gekozen via `AI_PROVIDER`.
 *
 * `AI_ENABLED=false` levert een provider op die netjes een `AiDisabledError`
 * gooit in plaats van `null` terug te geven. Zo hoeft geen enkele aanroeper te
 * controleren of AI aanstaat: de fout komt uit dezelfde plek als elke andere
 * AI-fout en wordt door dezelfde errorHandler afgehandeld.
 */
import type { AiProvider } from "../../types/ai.js";
import { AiDisabledError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { AnthropicProvider } from "./anthropicProvider.js";
import { OpenAiProvider } from "./openaiProvider.js";

class DisabledAiProvider implements AiProvider {
  readonly name = "anthropic" as const;
  complete<T>(): Promise<T> {
    return Promise.reject(new AiDisabledError());
  }
  completeText(): Promise<string> {
    return Promise.reject(new AiDisabledError());
  }
}

let cached: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  cached = createAiProvider();
  return cached;
}

function createAiProvider(): AiProvider {
  if (!env.AI_ENABLED) return new DisabledAiProvider();

  if (env.AI_PROVIDER === "openai") {
    // Non-null: env.ts weigert deze combinatie zonder key en model.
    return new OpenAiProvider(env.OPENAI_API_KEY!, env.OPENAI_MODEL!);
  }
  return new AnthropicProvider(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_MODEL!);
}

/** Alleen voor tests: vervang de provider door een stub. */
export function setAiProvider(provider: AiProvider | undefined): void {
  cached = provider;
}

export function isAiEnabled(): boolean {
  return env.AI_ENABLED;
}
