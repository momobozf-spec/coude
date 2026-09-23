import type { ApiErrorBody, AuthResponse } from '@superrette/validation';

/** Platform-independent HTTP client (unit-tested without React Native). */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  auth?: boolean;
  signal?: AbortSignal;
}

export class ApiClient {
  private refreshing: Promise<Tokens | null> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly store: TokenStore,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly onAuthLost: () => void = () => {},
  ) {}

  async setSession(auth: AuthResponse): Promise<void> {
    await this.store.set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
  }

  async clearSession(): Promise<void> {
    const tokens = await this.store.get();
    await this.store.set(null);
    if (tokens) {
      await this.fetchImpl(`${this.baseUrl}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => undefined);
    }
  }

  async accessToken(): Promise<string | null> {
    return (await this.store.get())?.accessToken ?? null;
  }

  /** Single-flight refresh: concurrent 401s share one refresh request (tokens rotate). */
  private refresh(): Promise<Tokens | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const tokens = await this.store.get();
        if (!tokens) return null;
        const res = await this.fetchImpl(`${this.baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        }).catch(() => null);
        if (!res) return tokens; // offline: keep the session, try later
        if (!res.ok) {
          await this.store.set(null);
          this.onAuthLost();
          return null;
        }
        const body = (await res.json()) as AuthResponse;
        const next = { accessToken: body.accessToken, refreshToken: body.refreshToken };
        await this.store.set(next);
        return next;
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const auth = options.auth ?? true;
    const send = async (token: string | null): Promise<Response> =>
      this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });

    let token = auth ? await this.accessToken() : null;
    let res = await send(token);
    if (res.status === 401 && auth && token) {
      const refreshed = await this.refresh();
      token = refreshed?.accessToken ?? null;
      if (token) res = await send(token);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json ?? {}) as Partial<ApiErrorBody>;
      throw new ApiError(res.status, err.code ?? 'HTTP_ERROR', err.message ?? `HTTP ${res.status}`, err.details);
    }
    return json as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }
  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }
  put<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
  patch<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
