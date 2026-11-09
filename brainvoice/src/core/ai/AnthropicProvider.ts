import type { AIClassification, AIEntities, AIParseContext, AIProvider, AIStructuredRequest, ContentPart } from './AIProvider';
import { buildParseUserMessage, CLASSIFY_SYSTEM_PROMPT, ENTITIES_SYSTEM_PROMPT, PARSE_SYSTEM_PROMPT, SUMMARIZE_SYSTEM_PROMPT } from './prompts';
import { AIParseOutputSchema, aiParseJsonSchema, type AIParseOutput } from './schema';
import { DomainError, type Language } from '../types/common';

/**
 * AnthropicProvider – Claude Messages API client for the intent engine.
 *
 * Two transports, same wire format (`POST {baseUrl}/v1/messages`):
 *  - proxy  : the app talks to the BrainVoice proxy (see `proxy/`), which holds the
 *             real API key. Recommended for production. Auth: a per-device bearer token.
 *  - direct : the user pasted their own Anthropic key in Settings; it is stored in the
 *             device keychain (expo-secure-store) and sent as `x-api-key`.
 *
 * The domain layer must stay free of platform/SDK dependencies (ARCHITECTURE.md §3),
 * so this file uses `fetch` with the documented request shape instead of the Node SDK.
 * The proxy uses the official `@anthropic-ai/sdk`.
 *
 * Structured output: `output_config.format = { type: "json_schema", schema }` so the
 * model must answer with JSON matching `AIParseOutputSchema`. The answer is then
 * validated again with Zod before anything else sees it.
 */

export interface AnthropicProviderConfig {
  transport: 'proxy' | 'direct';
  baseUrl: string;
  /** Direct transport: the user's key. Proxy transport: a device token. Resolved lazily. */
  getCredential: () => Promise<string | null>;
  model: string;
  /** Low effort keeps latency down for short commands; adaptive thinking stays on. */
  effort: 'low' | 'medium' | 'high';
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Token usage per request, for cost tracking (§170). Never blocks the request. */
  onUsage?: (usage: { provider: string; model: string; inputTokens: number; outputTokens: number }) => void;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5';
export const ANTHROPIC_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;
const ANTHROPIC_VERSION = '2023-06-01';

type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface MessagesRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string | ContentBlock[] }[];
  output_config?: { effort?: 'low' | 'medium' | 'high'; format?: { type: 'json_schema'; schema: Record<string, unknown> } };
  metadata?: { user_id?: string };
}

interface MessagesResponse {
  id?: string;
  type?: string;
  stop_reason?: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly displayName = 'Claude (Anthropic)';

  constructor(private readonly config: AnthropicProviderConfig) {}

  async isConfigured(): Promise<boolean> {
    const credential = await this.config.getCredential();
    return Boolean(credential && this.config.baseUrl);
  }

  async parseCommand(text: string, ctx: AIParseContext): Promise<AIParseOutput> {
    const raw = await this.request({
      system: PARSE_SYSTEM_PROMPT,
      user: buildParseUserMessage(text, ctx),
      maxTokens: 2048,
      format: aiParseJsonSchema(),
    });
    const parsed = safeJson(raw);
    const result = AIParseOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new DomainError('AI_INVALID_OUTPUT', 'The AI response did not match the command schema', {
        details: { issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      });
    }
    return result.data;
  }

  async summarize(text: string, opts: { language: Language; maxWords?: number }): Promise<string> {
    const raw = await this.request({
      system: SUMMARIZE_SYSTEM_PROMPT,
      user: `Language: ${opts.language}\nMax words: ${opts.maxWords ?? 8}\n\n${text}`,
      maxTokens: 64,
    });
    return raw.trim().replace(/^["']|["']$/g, '');
  }

  async classify(text: string, opts: { language: Language; categories: string[] }): Promise<AIClassification> {
    const raw = await this.request({
      system: CLASSIFY_SYSTEM_PROMPT,
      user: `Language: ${opts.language}\nCategories: ${opts.categories.join(', ')}\n\n${text}`,
      maxTokens: 200,
      format: {
        type: 'object',
        properties: { category: { type: 'string' }, confidence: { type: 'number' }, tags: { type: 'array', items: { type: 'string' } } },
        required: ['category', 'confidence', 'tags'],
        additionalProperties: false,
      },
    });
    const parsed = safeJson(raw) as Partial<AIClassification> | null;
    if (!parsed || typeof parsed.category !== 'string') throw new DomainError('AI_INVALID_OUTPUT', 'Invalid classification');
    return { category: parsed.category, confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5, tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [] };
  }

  /** Structured request with optional image parts; the gateway validates the JSON with Zod. */
  async structured(request: AIStructuredRequest): Promise<unknown> {
    const raw = await this.request({ system: request.system, user: request.user, maxTokens: request.maxTokens ?? 2048, format: request.schema });
    const parsed = safeJson(raw);
    if (parsed === null) throw new DomainError('AI_INVALID_OUTPUT', 'The AI response was not valid JSON');
    return parsed;
  }

  async extractEntities(text: string, opts: { language: Language }): Promise<AIEntities> {
    const raw = await this.request({
      system: ENTITIES_SYSTEM_PROMPT,
      user: `Language: ${opts.language}\n\n${text}`,
      maxTokens: 300,
      format: {
        type: 'object',
        properties: { people: { type: 'array', items: { type: 'string' } }, places: { type: 'array', items: { type: 'string' } }, topics: { type: 'array', items: { type: 'string' } } },
        required: ['people', 'places', 'topics'],
        additionalProperties: false,
      },
    });
    const parsed = safeJson(raw) as Partial<AIEntities> | null;
    return { people: parsed?.people ?? [], places: parsed?.places ?? [], topics: parsed?.topics ?? [] };
  }

  // ---------------------------------------------------------------------------

  private async request(params: { system: string; user: string | ContentPart[]; maxTokens: number; format?: Record<string, unknown> }): Promise<string> {
    const credential = await this.config.getCredential();
    if (!credential) throw new DomainError('AI_UNAVAILABLE', 'No AI credential configured');
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) throw new DomainError('AI_UNAVAILABLE', 'fetch is not available');

    const content: string | ContentBlock[] = typeof params.user === 'string' ? params.user : params.user.map((part): ContentBlock => (part.type === 'text' ? { type: 'text', text: part.text } : { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } }));
    const body: MessagesRequest = {
      model: this.config.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: 'user', content }],
      output_config: {
        effort: this.config.effort,
        ...(params.format ? { format: { type: 'json_schema', schema: params.format } } : {}),
      },
    };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };
    if (this.config.transport === 'direct') headers['x-api-key'] = credential;
    else headers.authorization = `Bearer ${credential}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.timeoutMs) : null;
    let response: Response;
    try {
      response = await fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new DomainError(/abort/i.test(message) ? 'AI_UNAVAILABLE' : 'NO_INTERNET', message, { cause: e });
    } finally {
      if (timer) clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as MessagesResponse | null;
    if (!response.ok || !json) {
      const message = json?.error?.message ?? `HTTP ${response.status}`;
      throw new DomainError('AI_UNAVAILABLE', message, { details: { status: response.status } });
    }
    if (json.usage && this.config.onUsage) {
      try {
        this.config.onUsage({ provider: this.id, model: this.config.model, inputTokens: json.usage.input_tokens ?? 0, outputTokens: json.usage.output_tokens ?? 0 });
      } catch {
        // cost tracking must never affect the request
      }
    }
    if (json.stop_reason === 'refusal') {
      throw new DomainError('AI_INVALID_OUTPUT', json.stop_details?.explanation ?? 'The model declined the request');
    }
    const text = (json.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text ?? '')
      .join('')
      .trim();
    if (!text) throw new DomainError('AI_INVALID_OUTPUT', 'Empty response from the model');
    return text;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
