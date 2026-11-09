import { z, type ZodType } from 'zod';

import type { AIProvider, ContentPart } from './AIProvider';
import { DomainError } from '../types/common';

/**
 * AIGateway – the single door through which the administrative services reach the
 * LLM (§137). It is optional everywhere: every service has a deterministic path and
 * only *improves* results when a provider with structured output is configured.
 * Output is always validated with Zod before anything else sees it.
 */

export interface StructuredRequest {
  system: string;
  user: string | ContentPart[];
  maxTokens?: number;
}

export class AIGateway {
  private provider: AIProvider | null = null;

  setProvider(provider: AIProvider | null): void {
    this.provider = provider;
  }

  getProvider(): AIProvider | null {
    return this.provider;
  }

  /** True when a provider that supports structured requests is configured. */
  isAvailable(): boolean {
    return Boolean(this.provider && typeof this.provider.structured === 'function');
  }

  async structured<T>(request: StructuredRequest, schema: ZodType<T>): Promise<T> {
    const provider = this.provider;
    if (!provider || typeof provider.structured !== 'function') throw new DomainError('AI_UNAVAILABLE', 'Cloud AI is not configured');
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
    const raw = await provider.structured({ ...request, schema: jsonSchema });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError('AI_INVALID_OUTPUT', 'The AI response did not match the expected schema', { details: { issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) } });
    }
    return parsed.data;
  }
}
