import { describe, expect, it } from 'vitest';

import { AnthropicProvider } from './AnthropicProvider';
import { aiParseJsonSchema } from './schema';

function provider(fetchImpl: typeof fetch, transport: 'direct' | 'proxy' = 'direct') {
  return new AnthropicProvider({
    transport,
    baseUrl: 'https://example.invalid',
    getCredential: async () => 'secret',
    model: 'claude-opus-5',
    effort: 'low',
    timeoutMs: 5000,
    fetchImpl,
  });
}

describe('AnthropicProvider', () => {
  it('sends a structured-output request and validates the reply', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl: typeof fetch = async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify({ language: 'en', commands: [{ intent: 'CREATE_TASK', confidence: 0.9, title: 'Buy milk', when: { phrase: 'tomorrow' } }] }) }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const out = await provider(fetchImpl).parseCommand('buy milk tomorrow', { language: 'en', nowISO: '2026-09-23T10:00:00+02:00', timezone: 'Europe/Brussels', categories: ['Work'] });
    expect(out.commands[0]?.intent).toBe('CREATE_TASK');
    const c = captured as { url: string; init: RequestInit } | null;
    expect(c?.url).toBe('https://example.invalid/v1/messages');
    const body = JSON.parse(String(c?.init.body)) as { model: string; output_config: { format: { type: string } }; messages: { content: string }[] };
    expect(body.model).toBe('claude-opus-5');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0]?.content).toContain('buy milk tomorrow');
    const headers = c?.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('secret');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('uses a bearer token for the proxy transport', async () => {
    let headers: Record<string, string> = {};
    const fetchImpl: typeof fetch = async (_url, init) => {
      headers = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"commands":[]}' }] }), { status: 200 });
    };
    await provider(fetchImpl, 'proxy').parseCommand('x', { language: 'en', nowISO: '', timezone: 'UTC', categories: [] });
    expect(headers.authorization).toBe('Bearer secret');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('rejects output that does not match the schema', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{"commands":[{"intent":"FLY_TO_MOON"}]}' }] }), { status: 200 });
    await expect(provider(fetchImpl).parseCommand('x', { language: 'en', nowISO: '', timezone: 'UTC', categories: [] })).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
  });

  it('maps HTTP errors to AI_UNAVAILABLE', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 });
    await expect(provider(fetchImpl).parseCommand('x', { language: 'en', nowISO: '', timezone: 'UTC', categories: [] })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', message: 'overloaded' });
  });

  it('generates a JSON schema with the command intents', () => {
    const schema = aiParseJsonSchema() as { properties: { commands: { items: { properties: { intent: { enum: string[] } } } } } };
    expect(schema.properties.commands.items.properties.intent.enum).toContain('CREATE_REMINDER');
  });
});
