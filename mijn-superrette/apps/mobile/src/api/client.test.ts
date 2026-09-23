import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, type Tokens, type TokenStore } from './client';

class MemoryStore implements TokenStore {
  constructor(public tokens: Tokens | null) {}
  async get() {
    return this.tokens;
  }
  async set(t: Tokens | null) {
    this.tokens = t;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ApiClient', () => {
  it('refreshes once for concurrent 401s and retries', async () => {
    const store = new MemoryStore({ accessToken: 'old', refreshToken: 'r1' });
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/v1/auth/refresh')) {
        refreshCalls++;
        return json(200, { accessToken: 'new', refreshToken: 'r2', user: {}, expiresIn: 900 });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new' ? json(200, { ok: true }) : json(401, { code: 'INVALID_TOKEN', message: 'expired' });
    });
    const client = new ApiClient('http://api', store, fetchMock as unknown as typeof fetch);
    const results = await Promise.all([client.get('/v1/me'), client.get('/v1/home'), client.get('/v1/lists')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(store.tokens).toEqual({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('signs out when the refresh token is rejected', async () => {
    const store = new MemoryStore({ accessToken: 'old', refreshToken: 'r1' });
    const lost = vi.fn();
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/refresh')
        ? json(401, { code: 'REFRESH_TOKEN_REUSED', message: 'x' })
        : json(401, { code: 'INVALID_TOKEN', message: 'x' }),
    );
    const client = new ApiClient('http://api', store, fetchMock as unknown as typeof fetch, lost);
    await expect(client.get('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(store.tokens).toBeNull();
    expect(lost).toHaveBeenCalledOnce();
  });

  it('maps API errors', async () => {
    const client = new ApiClient('http://api', new MemoryStore(null), (async () =>
      json(409, {
        statusCode: 409,
        code: 'VERSION_CONFLICT',
        message: 'changed',
        details: { current: 1 },
      })) as unknown as typeof fetch);
    await expect(client.patch('/v1/lists/1/items/2', {})).rejects.toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      details: { current: 1 },
    });
  });
});
