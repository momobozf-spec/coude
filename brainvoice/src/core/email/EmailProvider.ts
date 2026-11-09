import type { EmailMessageInput } from './EmailAdapter';
import type { EmailDraft } from '../domain/admin';
import { DomainError } from '../types/common';

/**
 * EmailProvider (§160) – the mailbox abstraction the monitoring pipeline polls every 15
 * minutes. The local store (paste / share sheet) is one provider; Gmail and Microsoft
 * Graph are seams with the exact capability flags they would need. Nothing here claims
 * that a remote mailbox works until credentials and a verified OAuth flow exist.
 */

export interface EmailProviderCapabilities {
  /** Can list messages that arrived since a cursor (true monitoring). */
  canList: boolean;
  canSearch: boolean;
  canCreateDraft: boolean;
  canSend: boolean;
}

export interface EmailProviderStatus {
  state: 'ready' | 'not_configured' | 'error';
  detail: string | null;
}

export interface EmailListResult {
  messages: EmailMessageInput[];
  /** Opaque cursor to pass next time; null when the provider cannot page. */
  cursor: string | null;
}

export interface EmailProvider {
  readonly id: string;
  readonly displayName: string;
  capabilities(): EmailProviderCapabilities;
  status(): Promise<EmailProviderStatus>;
  listNewMessages(cursor: string | null, limit?: number): Promise<EmailListResult>;
  getMessage(externalId: string): Promise<EmailMessageInput | null>;
  getThread(threadId: string): Promise<EmailMessageInput[]>;
  search(query: string, limit?: number): Promise<EmailMessageInput[]>;
  createDraft(draft: EmailDraft): Promise<{ externalId: string | null }>;
  /** Only called with an APPROVED approval; the caller records the audit entry. */
  send(draft: EmailDraft, options: { inReplyToExternalId: string | null }): Promise<{ externalId: string | null }>;
  markProcessed(externalId: string): Promise<void>;
}

/**
 * Messages reach the local store through the share sheet, paste and manual entry; they
 * are already in the database, so polling returns nothing and the triage worker picks
 * up untriaged rows directly. Sending is delegated to the system composer by the tools.
 */
export class LocalEmailProvider implements EmailProvider {
  readonly id = 'local';
  readonly displayName = 'Local store (paste / share)';

  capabilities(): EmailProviderCapabilities {
    return { canList: false, canSearch: false, canCreateDraft: false, canSend: false };
  }

  async status(): Promise<EmailProviderStatus> {
    return { state: 'ready', detail: 'Messages arrive by paste or share; no mailbox is monitored.' };
  }

  async listNewMessages(cursor: string | null): Promise<EmailListResult> {
    return { messages: [], cursor };
  }

  async getMessage(): Promise<EmailMessageInput | null> {
    return null;
  }

  async getThread(): Promise<EmailMessageInput[]> {
    return [];
  }

  async search(): Promise<EmailMessageInput[]> {
    return [];
  }

  async createDraft(): Promise<{ externalId: string | null }> {
    throw new DomainError('EMAIL_UNAVAILABLE', 'The local provider cannot create drafts in a mailbox');
  }

  async send(): Promise<{ externalId: string | null }> {
    throw new DomainError('EMAIL_UNAVAILABLE', 'The local provider cannot send; use the system composer');
  }

  async markProcessed(): Promise<void> {
    // nothing to do: processed_at lives on the local row
  }
}

export interface OAuthCredentialSource {
  /** Returns a valid access token or null when the account is not connected. */
  accessToken(): Promise<string | null>;
}

/**
 * Seam for Gmail (REQUIRES PROVIDER CREDENTIALS). Endpoints the implementation needs:
 *  GET  https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:<epoch>
 *  GET  https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=full
 *  GET  https://gmail.googleapis.com/gmail/v1/users/me/threads/{id}
 *  POST https://gmail.googleapis.com/gmail/v1/users/me/drafts
 *  POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 * plus the OAuth consent flow with the gmail.modify scope. Not implemented: every call
 * reports EMAIL_UNAVAILABLE so nothing can pretend to monitor a mailbox.
 */
export class GmailProvider implements EmailProvider {
  readonly id = 'gmail';
  readonly displayName = 'Gmail (not connected)';

  constructor(private readonly credentials: OAuthCredentialSource | null = null) {}

  capabilities(): EmailProviderCapabilities {
    return { canList: true, canSearch: true, canCreateDraft: true, canSend: true };
  }

  async status(): Promise<EmailProviderStatus> {
    const token = this.credentials ? await this.credentials.accessToken() : null;
    return token ? { state: 'error', detail: 'Gmail API client not implemented yet (credentials present).' } : { state: 'not_configured', detail: 'REQUIRES PROVIDER CREDENTIALS: Google OAuth client + refresh token.' };
  }

  async listNewMessages(): Promise<EmailListResult> {
    throw unavailable('Gmail');
  }
  async getMessage(): Promise<EmailMessageInput | null> {
    throw unavailable('Gmail');
  }
  async getThread(): Promise<EmailMessageInput[]> {
    throw unavailable('Gmail');
  }
  async search(): Promise<EmailMessageInput[]> {
    throw unavailable('Gmail');
  }
  async createDraft(): Promise<{ externalId: string | null }> {
    throw unavailable('Gmail');
  }
  async send(): Promise<{ externalId: string | null }> {
    throw unavailable('Gmail');
  }
  async markProcessed(): Promise<void> {
    throw unavailable('Gmail');
  }
}

/**
 * Seam for Microsoft Graph (Outlook / Microsoft 365). Endpoints:
 *  GET  https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta
 *  GET  https://graph.microsoft.com/v1.0/me/messages/{id}
 *  POST https://graph.microsoft.com/v1.0/me/messages            (draft)
 *  POST https://graph.microsoft.com/v1.0/me/sendMail
 * Scopes Mail.ReadWrite + Mail.Send through MSAL. Not implemented (see GmailProvider).
 */
export class MicrosoftGraphEmailProvider implements EmailProvider {
  readonly id = 'microsoft-graph';
  readonly displayName = 'Microsoft 365 (not connected)';

  constructor(private readonly credentials: OAuthCredentialSource | null = null) {}

  capabilities(): EmailProviderCapabilities {
    return { canList: true, canSearch: true, canCreateDraft: true, canSend: true };
  }

  async status(): Promise<EmailProviderStatus> {
    const token = this.credentials ? await this.credentials.accessToken() : null;
    return token ? { state: 'error', detail: 'Graph API client not implemented yet (credentials present).' } : { state: 'not_configured', detail: 'REQUIRES PROVIDER CREDENTIALS: Azure app registration + MSAL token.' };
  }

  async listNewMessages(): Promise<EmailListResult> {
    throw unavailable('Microsoft Graph');
  }
  async getMessage(): Promise<EmailMessageInput | null> {
    throw unavailable('Microsoft Graph');
  }
  async getThread(): Promise<EmailMessageInput[]> {
    throw unavailable('Microsoft Graph');
  }
  async search(): Promise<EmailMessageInput[]> {
    throw unavailable('Microsoft Graph');
  }
  async createDraft(): Promise<{ externalId: string | null }> {
    throw unavailable('Microsoft Graph');
  }
  async send(): Promise<{ externalId: string | null }> {
    throw unavailable('Microsoft Graph');
  }
  async markProcessed(): Promise<void> {
    throw unavailable('Microsoft Graph');
  }
}

/** In-memory provider for tests and demos: messages pushed into it appear on the next poll. */
export class InMemoryEmailProvider implements EmailProvider {
  readonly id: string;
  readonly displayName: string;
  private readonly inbox: EmailMessageInput[] = [];
  readonly sent: { draft: EmailDraft; inReplyToExternalId: string | null }[] = [];
  readonly processed: string[] = [];
  private readonly canSend: boolean;

  constructor(options: { id?: string; canSend?: boolean } = {}) {
    this.id = options.id ?? 'memory';
    this.displayName = 'In-memory mailbox';
    this.canSend = options.canSend ?? false;
  }

  push(message: EmailMessageInput): void {
    this.inbox.push({ ...message, providerId: this.id });
  }

  capabilities(): EmailProviderCapabilities {
    return { canList: true, canSearch: true, canCreateDraft: false, canSend: this.canSend };
  }

  async status(): Promise<EmailProviderStatus> {
    return { state: 'ready', detail: null };
  }

  async listNewMessages(cursor: string | null, limit = 50): Promise<EmailListResult> {
    const start = cursor ? Number(cursor) : 0;
    const messages = this.inbox.slice(start, start + limit);
    return { messages, cursor: String(start + messages.length) };
  }

  async getMessage(externalId: string): Promise<EmailMessageInput | null> {
    return this.inbox.find((m) => m.externalId === externalId) ?? null;
  }

  async getThread(threadId: string): Promise<EmailMessageInput[]> {
    return this.inbox.filter((m) => m.threadId === threadId);
  }

  async search(query: string, limit = 20): Promise<EmailMessageInput[]> {
    const needle = query.toLowerCase();
    return this.inbox.filter((m) => `${m.subject} ${m.bodyText}`.toLowerCase().includes(needle)).slice(0, limit);
  }

  async createDraft(): Promise<{ externalId: string | null }> {
    throw new DomainError('EMAIL_UNAVAILABLE', 'In-memory provider has no drafts');
  }

  async send(draft: EmailDraft, options: { inReplyToExternalId: string | null }): Promise<{ externalId: string | null }> {
    if (!this.canSend) throw new DomainError('EMAIL_UNAVAILABLE', 'Sending is disabled on this provider');
    this.sent.push({ draft, inReplyToExternalId: options.inReplyToExternalId });
    return { externalId: `sent-${this.sent.length}` };
  }

  async markProcessed(externalId: string): Promise<void> {
    this.processed.push(externalId);
  }
}

function unavailable(name: string): DomainError {
  return new DomainError('EMAIL_UNAVAILABLE', `${name} is not connected (provider seam only; requires credentials and an implementation)`);
}
