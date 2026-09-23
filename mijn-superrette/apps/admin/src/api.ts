import type { AuthResponse } from '@superrette/validation';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const KEY = 'superrette.admin.session';

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Session storage (not local storage): the admin session ends with the tab.
export const session = {
  get(): AuthResponse | null {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  },
  set(value: AuthResponse | null): void {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  },
};

async function refresh(): Promise<boolean> {
  const current = session.get();
  if (!current) return false;
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!res.ok) {
    session.set(null);
    return false;
  }
  session.set((await res.json()) as AuthResponse);
  return true;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const token = session.get()?.accessToken;
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (res.status === 401 && retry && (await refresh())) return api<T>(path, init, false);
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (!res.ok) throw new AdminApiError(res.status, body.code ?? 'ERROR', body.message ?? `HTTP ${res.status}`);
  return body as T;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const auth = await api<AuthResponse>('/v1/auth/login', { method: 'POST', body: { email, password } }, false);
  if (auth.user.role !== 'ADMIN') throw new AdminApiError(403, 'FORBIDDEN', 'Dit account heeft geen beheerrechten.');
  session.set(auth);
  return auth;
}

export const euro = (cents: number | null | undefined): string =>
  cents == null ? '—' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const dateTime = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('nl-BE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
