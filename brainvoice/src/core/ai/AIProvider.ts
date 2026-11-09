import type { AIParseOutput } from './schema';
import { DomainError, type Language } from '../types/common';

/**
 * AIProvider – the only interface the intent engine knows about for LLM work.
 * Implementations: AnthropicProvider (direct or via proxy), NullAIProvider.
 * Adding OpenAI or an on-device model means implementing this interface only.
 */

export interface AIParseContext {
  language: Language;
  /** ISO timestamp of "now" in the device zone, e.g. 2026-09-23T10:00:00+02:00 */
  nowISO: string;
  timezone: string;
  /** User categories so the model can pick one of them. */
  categories: string[];
  /** The open clarification question, if any, so the model can complete the pending command. */
  pendingQuestion?: string | null;
  /** One-line summary of the last proposed command for "make that 3 instead". */
  lastCommandSummary?: string | null;
}

export interface AIClassification {
  category: string;
  confidence: number;
  tags: string[];
}

export interface AIEntities {
  people: string[];
  places: string[];
  topics: string[];
}

/** A multimodal message part for structured requests (receipt photos, invoice scans). */
export type ContentPart = { type: 'text'; text: string } | { type: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; base64: string };

export interface AIStructuredRequest {
  system: string;
  user: string | ContentPart[];
  /** JSON Schema the model must follow; the caller validates the result again with Zod. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when the provider is configured (key or proxy) – does not check the network. */
  isConfigured(): Promise<boolean>;
  parseCommand(text: string, ctx: AIParseContext): Promise<AIParseOutput>;
  summarize(text: string, opts: { language: Language; maxWords?: number }): Promise<string>;
  classify(text: string, opts: { language: Language; categories: string[] }): Promise<AIClassification>;
  extractEntities(text: string, opts: { language: Language }): Promise<AIEntities>;
  /**
   * Generic structured request used by the administrative services (email analysis, reply
   * drafting, meeting extraction, invoice/receipt reading). Optional so that lightweight
   * providers and test fakes keep working; services fall back to deterministic logic.
   */
  structured?(request: AIStructuredRequest): Promise<unknown>;
}

/** Provider used when cloud AI is disabled: every call reports AI_UNAVAILABLE. */
export class NullAIProvider implements AIProvider {
  readonly id = 'none';
  readonly displayName = 'Off (deterministic only)';

  async isConfigured(): Promise<boolean> {
    return false;
  }

  async parseCommand(): Promise<AIParseOutput> {
    throw new DomainError('AI_UNAVAILABLE', 'Cloud AI is disabled');
  }

  async summarize(): Promise<string> {
    throw new DomainError('AI_UNAVAILABLE', 'Cloud AI is disabled');
  }

  async classify(): Promise<AIClassification> {
    throw new DomainError('AI_UNAVAILABLE', 'Cloud AI is disabled');
  }

  async extractEntities(): Promise<AIEntities> {
    throw new DomainError('AI_UNAVAILABLE', 'Cloud AI is disabled');
  }
}
