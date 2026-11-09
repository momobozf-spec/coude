import { randomBytes } from 'node:crypto';

import type { Database } from '../src/core/db/Database';
import type { GmailAuth } from '../src/core/email/gmail/GmailAuth';
import type { EmailProvider } from '../src/core/email/EmailProvider';
import type { EmailAccountManager, EmailAccountStatus } from '../src/core/ops/accounts';
import type { Clock } from '../src/core/services/Clock';
import { DomainError } from '../src/core/types/common';

/**
 * Gmail account management on the server: starts the OAuth consent flow (state stored in
 * `oauth_states`, 10-minute validity), finishes it in the callback, reports status and
 * disconnects. The phone only ever receives the consent URL.
 */
export class GmailAccountManager implements EmailAccountManager {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly auth: GmailAuth,
    private readonly provider: () => EmailProvider,
  ) {}

  async status(): Promise<EmailAccountStatus> {
    const provider = this.provider();
    const [providerStatus, auth] = await Promise.all([provider.status().catch((e: unknown) => ({ state: 'error' as const, detail: e instanceof Error ? e.message : String(e) })), this.auth.status()]);
    const caps = provider.capabilities();
    return { providerId: provider.id, displayName: provider.displayName, state: providerStatus.state, connected: auth.connected && !auth.needsReconnect, email: auth.email, detail: providerStatus.detail, canList: caps.canList, canSend: caps.canSend, canConnect: auth.configured };
  }

  async connectUrl(): Promise<string | null> {
    if (!this.auth.isConfigured()) return null;
    const state = randomBytes(24).toString('hex');
    const now = this.clock.now();
    await this.db.driver.run('INSERT INTO oauth_states (state, provider, created_at, expires_at) VALUES (?, ?, ?, ?)', [state, 'gmail', now.toISO() ?? '', now.plus({ minutes: 10 }).toISO() ?? '']);
    return this.auth.authorizationUrl(state);
  }

  /** Called by the OAuth callback route. */
  async finishConnect(state: string, code: string): Promise<{ email: string | null }> {
    const row = await this.db.driver.get<{ state: string; expires_at: string }>('SELECT state, expires_at FROM oauth_states WHERE state = ? AND provider = ?', [state, 'gmail']);
    if (!row) throw new DomainError('INVALID_ARGUMENTS', 'Unknown or already used OAuth state');
    await this.db.driver.run('DELETE FROM oauth_states WHERE state = ?', [state]);
    if (String(row.expires_at) < (this.clock.now().toISO() ?? '')) throw new DomainError('INVALID_ARGUMENTS', 'OAuth state expired; start again from the app');
    const tokens = await this.auth.exchangeCode(code);
    return { email: tokens.email };
  }

  async disconnect(): Promise<void> {
    await this.auth.disconnect();
  }
}
