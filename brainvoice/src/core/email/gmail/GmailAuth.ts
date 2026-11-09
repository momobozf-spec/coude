import type { CredentialStore } from '../../ops/providers/CredentialStore';
import { DomainError } from '../../types/common';

/**
 * Google OAuth 2.0 for Gmail (authorization-code flow with offline access). Tokens are
 * kept in the server-side CredentialStore; the access token is refreshed on demand and a
 * rotated refresh token (when Google returns one) replaces the stored one. An
 * `invalid_grant` on refresh marks the account as needing reconnection instead of failing
 * silently – System Health and the email account status show it.
 */

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/userinfo.email'];
export const GMAIL_CREDENTIAL_KEY = 'gmail';

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  /** Endpoint overrides (staging against a mock Google); production uses Google's defaults. */
  authUrl?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  apiBaseUrl?: string;
}

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
  scope: string | null;
  email: string | null;
}

export interface GmailAccountMeta {
  email?: string | null;
  connectedAt?: string;
  lastRefreshAt?: string | null;
  lastError?: string | null;
  needsReconnect?: boolean;
}

export interface GmailAuthStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  needsReconnect: boolean;
  lastError: string | null;
  expiresAt: string | null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export class GmailAuth {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(
    private readonly config: GmailOAuthConfig | null,
    private readonly store: CredentialStore,
    options: { fetchImpl?: typeof fetch; now?: () => Date } = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
  }

  isConfigured(): boolean {
    return Boolean(this.config?.clientId && this.config?.clientSecret && this.config?.redirectUri);
  }

  authorizationUrl(state: string): string {
    if (!this.config || !this.isConfigured()) throw new DomainError('EMAIL_UNAVAILABLE', 'REQUIRES PROVIDER CREDENTIALS: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REDIRECT_URI are not set');
    const params = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri, response_type: 'code', scope: (this.config.scopes ?? GMAIL_SCOPES).join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
    return `${this.config.authUrl ?? 'https://accounts.google.com/o/oauth2/v2/auth'}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GmailTokens> {
    if (!this.config) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail OAuth is not configured');
    const response = await this.tokenRequest({ grant_type: 'authorization_code', code, client_id: this.config.clientId, client_secret: this.config.clientSecret, redirect_uri: this.config.redirectUri });
    if (!response.access_token || !response.refresh_token) throw new DomainError('EMAIL_UNAVAILABLE', `Google did not return tokens: ${response.error_description ?? response.error ?? 'unknown'}`);
    const email = await this.lookupEmail(response.access_token).catch(() => null);
    const tokens: GmailTokens = { accessToken: response.access_token, refreshToken: response.refresh_token, expiresAt: this.expiry(response.expires_in), scope: response.scope ?? null, email };
    await this.store.save(GMAIL_CREDENTIAL_KEY, tokens, { email, connectedAt: this.now().toISOString(), lastError: null, needsReconnect: false, lastRefreshAt: null } satisfies GmailAccountMeta);
    return tokens;
  }

  /** Valid access token, refreshing (and rotating the refresh token) when needed. */
  async accessToken(): Promise<string> {
    const stored = await this.store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY);
    if (!stored) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail is not connected');
    const expiresAt = Date.parse(stored.secret.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt - 60_000 > this.now().getTime()) return stored.secret.accessToken;
    return (await this.refresh()).accessToken;
  }

  async refresh(): Promise<GmailTokens> {
    if (!this.config) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail OAuth is not configured');
    const stored = await this.store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY);
    if (!stored) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail is not connected');
    const response = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: stored.secret.refreshToken, client_id: this.config.clientId, client_secret: this.config.clientSecret });
    if (!response.access_token) {
      const detail = response.error_description ?? response.error ?? 'refresh failed';
      await this.store.updateMeta(GMAIL_CREDENTIAL_KEY, { lastError: detail, needsReconnect: response.error === 'invalid_grant', lastRefreshAt: this.now().toISOString() } satisfies GmailAccountMeta);
      throw new DomainError('EMAIL_UNAVAILABLE', response.error === 'invalid_grant' ? 'Gmail access was revoked or expired – reconnect the account' : `Gmail token refresh failed: ${detail}`);
    }
    const tokens: GmailTokens = { ...stored.secret, accessToken: response.access_token, refreshToken: response.refresh_token ?? stored.secret.refreshToken, expiresAt: this.expiry(response.expires_in), scope: response.scope ?? stored.secret.scope };
    await this.store.save(GMAIL_CREDENTIAL_KEY, tokens, { lastRefreshAt: this.now().toISOString(), lastError: null, needsReconnect: false } satisfies GmailAccountMeta);
    return tokens;
  }

  async status(): Promise<GmailAuthStatus> {
    const stored = await this.store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY);
    const meta = (stored?.meta ?? {}) as GmailAccountMeta;
    return { configured: this.isConfigured(), connected: Boolean(stored), email: stored?.secret.email ?? meta.email ?? null, needsReconnect: Boolean(meta.needsReconnect), lastError: meta.lastError ?? null, expiresAt: stored?.secret.expiresAt ?? null };
  }

  async disconnect(): Promise<void> {
    const stored = await this.store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY);
    if (stored && this.config) {
      await this.fetchImpl(`${this.config.revokeUrl ?? 'https://oauth2.googleapis.com/revoke'}?token=${encodeURIComponent(stored.secret.refreshToken)}`, { method: 'POST' }).catch(() => undefined);
    }
    await this.store.clear(GMAIL_CREDENTIAL_KEY);
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    const response = await this.fetchImpl(this.config?.tokenUrl ?? 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    const json = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok && !json.error) json.error = `http_${response.status}`;
    return json;
  }

  private async lookupEmail(accessToken: string): Promise<string | null> {
    const response = await this.fetchImpl(`${(this.config?.apiBaseUrl ?? 'https://gmail.googleapis.com/gmail/v1/users/me').replace(/\/$/, '')}/profile`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    const json = (await response.json()) as { emailAddress?: string };
    return json.emailAddress?.toLowerCase() ?? null;
  }

  private expiry(expiresIn: number | undefined): string {
    return new Date(this.now().getTime() + Math.max(60, expiresIn ?? 3600) * 1000).toISOString();
  }
}
