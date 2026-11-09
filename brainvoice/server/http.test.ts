import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readEnv } from './env';
import { createHttpServer } from './http';
import { createServerRuntime, type ServerRuntime } from './runtime';
import { FakeGmail } from '../src/core/email/gmail/testing/FakeGmail';

let runtime: ServerRuntime;
let baseUrl: string;
let server: ReturnType<typeof createHttpServer>;

beforeAll(async () => {
  runtime = await createServerRuntime(readEnv({ ALFRED_API_TOKEN: 'secret-token', ALFRED_LANGUAGE: 'nl', ALFRED_TIMEZONE: 'Europe/Brussels' }), { dbPath: ':memory:', quiet: true });
  server = createHttpServer({ client: runtime.client, token: 'secret-token', allowAnonymous: false, version: 'test', ready: runtime.ready, accounts: runtime.accounts });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await runtime.dispose();
});

async function rpc(method: string, args: unknown[], token: string | null = 'secret-token', url = baseUrl): Promise<{ status: number; body: { result?: unknown; error?: { code: string; message: string } } }> {
  const response = await fetch(`${url}/api/ops/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ args }) });
  return { status: response.status, body: (await response.json()) as { result?: unknown; error?: { code: string; message: string } } };
}

describe('Alfred server – HTTP API', () => {
  it('answers liveness and readiness probes without authentication', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, version: 'test' });
    const ready = await fetch(`${baseUrl}/api/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ ok: true, database: 'ok', dialect: 'sqlite', continuous: false, schedulerAlive: false });
  });

  it('refuses API calls without the bearer token', async () => {
    expect((await rpc('summary', [], null)).status).toBe(401);
    expect((await rpc('summary', [], 'wrong')).status).toBe(401);
    const response = await fetch(`${baseUrl}/api/mission-control`);
    expect(response.status).toBe(401);
  });

  it('creates and reads tickets through the RPC endpoint', async () => {
    const created = await rpc('createTicket', [{ text: 'Maak een factuur voor klant Acme voor 1 werkdag aan €750 per dag.' }]);
    expect(created.status).toBe(200);
    const ticket = created.body.result as { id: string; status: string; role: string };
    expect(ticket.status).toBe('QUEUED');
    expect(ticket.role).toBe('ADMIN_ASSISTANT');
    const detail = await rpc('ticket', [ticket.id]);
    expect((detail.body.result as { events: unknown[] }).events).toHaveLength(1);
    const list = await rpc('tickets', ['queue']);
    expect((list.body.result as { id: string }[]).map((t) => t.id)).toContain(ticket.id);
    const summary = await fetch(`${baseUrl}/api/mission-control`, { headers: { authorization: 'Bearer secret-token' } });
    expect(summary.status).toBe(200);
    const body = (await summary.json()) as { result: { counts: { QUEUED: number }; health: { mode: string; continuous: boolean } } };
    expect(body.result.counts.QUEUED).toBe(1);
    expect(body.result.health.continuous).toBe(false);
  });

  it('understands and executes Butler commands on the server (connected mode)', async () => {
    const understood = await rpc('understand', [{ text: 'Welke facturen staan nog open?', source: 'text', language: 'nl' }]);
    expect(understood.status).toBe(200);
    const result = understood.body.result as { decision: string; batch: { commands: { intent: string; tool?: string }[] } | null };
    expect(result.batch?.commands[0]?.intent).toBe('BUTLER_TOOL');
    expect(result.batch?.commands[0]?.tool).toBe('invoice.list');
    const executed = await rpc('executeBatch', [result.batch, {}]);
    expect(executed.status).toBe(200);
    const results = executed.body.result as { ok: boolean; payload: { kind: string } | null; error: unknown }[];
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.payload?.kind).toBe('tool');
    const bad = await rpc('executeBatch', [{ nope: true }, {}]);
    expect(bad.status).toBe(400);
    const dashboard = await rpc('call', ['administrative.dashboard', []]);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.result).toMatchObject({ invoicesOpen: expect.any(Number) });
    expect((await rpc('call', ['db.driver.run', ['DROP TABLE tickets']])).status).toBe(400);
  });

  it('runs a cycle on request and reports what happened', async () => {
    const tick = await rpc('runTick', []);
    expect(tick.status).toBe(200);
    expect(tick.body.result).toMatchObject({ scheduled: expect.any(Number), processed: expect.any(Number) });
  });

  it('rejects unknown methods and bad bodies with 400 and JSON errors', async () => {
    expect((await rpc('dropDatabase', [])).status).toBe(400);
    const bad = await fetch(`${baseUrl}/api/ops/summary`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer secret-token' }, body: '{not json' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('INVALID_ARGUMENTS');
    const missing = await rpc('ticket', ['does-not-exist']);
    expect(missing.status).toBe(200);
    expect(missing.body.result).toBeNull();
    expect((await rpc('cancelTicket', ['does-not-exist'])).status).toBe(404);
  });

  it('reports the local mailbox honestly and refuses to start a Gmail flow when Gmail is not configured', async () => {
    const account = await rpc('emailAccount', []);
    expect(account.body.result).toMatchObject({ providerId: 'local', canConnect: false, canList: false });
    expect((await rpc('connectEmailUrl', [])).body.result).toBeNull();
    const start = await fetch(`${baseUrl}/api/auth/gmail/start`, { headers: { authorization: 'Bearer secret-token' } });
    expect(start.status).toBe(404);
  });
});

describe('Alfred server – rate limiting', () => {
  it('limits authenticated calls per address and failed authentication separately', async () => {
    const limited = createHttpServer({ client: runtime.client, token: 'secret-token', allowAnonymous: false, version: 'test', rateLimitPerMinute: 10 });
    await new Promise<void>((resolve) => limited.listen(0, '127.0.0.1', () => resolve()));
    const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}`;
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) statuses.push((await rpc('health', [], 'secret-token', url)).status);
      expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
      const failures: number[] = [];
      for (let i = 0; i < 22; i++) failures.push((await rpc('health', [], 'wrong', url)).status);
      expect(failures.slice(0, 20).every((s) => s === 401)).toBe(true);
      expect(failures.slice(20)).toEqual([429, 429]);
    } finally {
      await new Promise<void>((resolve) => limited.close(() => resolve()));
    }
  });
});

describe('Alfred server – Gmail account flow (Phase 4, against Gmail-shaped payloads)', () => {
  let gmailRuntime: ServerRuntime;
  let gmailServer: ReturnType<typeof createHttpServer>;
  let gmailUrl: string;
  const fake = new FakeGmail({ accountEmail: 'mohamed@bouzouf.be' });

  beforeAll(async () => {
    gmailRuntime = await createServerRuntime(readEnv({ ALFRED_API_TOKEN: 'secret-token', ALFRED_EMAIL_PROVIDER: 'gmail', GMAIL_CLIENT_ID: 'client-id', GMAIL_CLIENT_SECRET: 'client-secret', ALFRED_PUBLIC_URL: 'https://alfred.example', ALFRED_SECRET_KEY: 'a'.repeat(64), ALFRED_EXPO_PUSH: '0' }), { dbPath: ':memory:', quiet: true, fetchImpl: fake.fetch });
    gmailServer = createHttpServer({ client: gmailRuntime.client, token: 'secret-token', allowAnonymous: false, version: 'test', ready: gmailRuntime.ready, accounts: gmailRuntime.accounts });
    await new Promise<void>((resolve) => gmailServer.listen(0, '127.0.0.1', () => resolve()));
    gmailUrl = `http://127.0.0.1:${(gmailServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => gmailServer.close(() => resolve()));
    await gmailRuntime.dispose();
  });

  it('starts consent, finishes the callback, stores encrypted tokens and reports the connected account', async () => {
    expect(gmailRuntime.credentialsPersistent).toBe(true);
    const before = await rpc('emailAccount', [], 'secret-token', gmailUrl);
    expect(before.body.result).toMatchObject({ providerId: 'gmail', connected: false, canConnect: true, state: 'not_configured' });

    const start = await fetch(`${gmailUrl}/api/auth/gmail/start`, { headers: { authorization: 'Bearer secret-token' } });
    expect(start.status).toBe(200);
    const consent = new URL(((await start.json()) as { result: { url: string } }).result.url);
    expect(consent.hostname).toBe('accounts.google.com');
    expect(consent.searchParams.get('redirect_uri')).toBe('https://alfred.example/api/auth/gmail/callback');
    expect(consent.searchParams.get('access_type')).toBe('offline');
    const state = consent.searchParams.get('state')!;

    const wrongState = await fetch(`${gmailUrl}/api/auth/gmail/callback?code=good-code&state=nope`);
    expect(wrongState.status).toBe(400);
    const callback = await fetch(`${gmailUrl}/api/auth/gmail/callback?code=good-code&state=${state}`);
    expect(callback.status).toBe(200);
    expect(await callback.text()).toContain('Gmail connected as mohamed@bouzouf.be');
    const replay = await fetch(`${gmailUrl}/api/auth/gmail/callback?code=good-code&state=${state}`);
    expect(replay.status).toBe(400);

    const after = await rpc('emailAccount', [], 'secret-token', gmailUrl);
    expect(after.body.result).toMatchObject({ providerId: 'gmail', connected: true, email: 'mohamed@bouzouf.be', state: 'ready', canSend: true });
    const row = await gmailRuntime.db.driver.get<{ secret_enc: string; meta_json: string }>("SELECT secret_enc, meta_json FROM provider_credentials WHERE provider = 'gmail'");
    expect(row?.secret_enc).toBeTruthy();
    expect(String(row?.secret_enc)).not.toContain('refresh-1');
    expect(String(row?.meta_json)).toContain('mohamed@bouzouf.be');

    const health = await rpc('health', [], 'secret-token', gmailUrl);
    expect((health.body.result as { email: { providerId: string; monitoring: boolean } }).email).toMatchObject({ providerId: 'gmail', monitoring: false });

    await rpc('disconnectEmail', [], 'secret-token', gmailUrl);
    expect(((await rpc('emailAccount', [], 'secret-token', gmailUrl)).body.result as { connected: boolean }).connected).toBe(false);
  });
});
