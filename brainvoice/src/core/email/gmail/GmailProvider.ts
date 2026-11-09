import { GmailApi } from './GmailApi';
import type { GmailAuth } from './GmailAuth';
import { buildRawMessage, gmailMessageToInput, type GmailMessage } from './GmailMime';
import type { EmailDraft } from '../../domain/admin';
import { DomainError } from '../../types/common';
import type { EmailMessageInput } from '../EmailAdapter';
import type { EmailListResult, EmailProvider, EmailProviderCapabilities, EmailProviderStatus } from '../EmailProvider';

export interface GmailProviderOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Gmail search applied to every poll (default: inbox only). */
  query?: string;
  /** Label added to messages the triage pipeline finished with. */
  processedLabel?: string;
  /** How many messages one poll fetches at most. */
  pageSize?: number;
}

interface Cursor {
  /** Epoch seconds of the newest message seen; Gmail's `after:` filter is inclusive at second granularity, dedup handles overlap. */
  after: number | null;
}

/**
 * Gmail behind the EmailProvider abstraction (§160, Phase 4). Stable ids: Gmail message
 * id → `externalId`, thread id → `threadId`; the `Message-ID` header is used for
 * `In-Reply-To` when replying. Nothing is sent except through `send`, which the tool
 * registry only calls after an approval.
 */
export class GmailProvider implements EmailProvider {
  readonly id = 'gmail';
  readonly displayName = 'Gmail';
  private readonly api: GmailApi;
  private readonly options: Required<Pick<GmailProviderOptions, 'query' | 'processedLabel' | 'pageSize'>>;
  private processedLabelId: string | null = null;
  private myAddress: string | null = null;

  constructor(
    private readonly auth: GmailAuth,
    options: GmailProviderOptions = {},
  ) {
    this.api = new GmailApi({ accessToken: () => auth.accessToken(), refresh: async () => (await auth.refresh()).accessToken, fetchImpl: options.fetchImpl, baseUrl: options.baseUrl });
    this.options = { query: options.query ?? 'in:inbox', processedLabel: options.processedLabel ?? 'Alfred/Processed', pageSize: options.pageSize ?? 25 };
  }

  capabilities(): EmailProviderCapabilities {
    return { canList: true, canSearch: true, canCreateDraft: true, canSend: true };
  }

  async status(): Promise<EmailProviderStatus> {
    const auth = await this.auth.status();
    if (!auth.configured) return { state: 'not_configured', detail: 'REQUIRES PROVIDER CREDENTIALS: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI on the server.' };
    if (!auth.connected) return { state: 'not_configured', detail: 'Gmail account not connected – use Settings → Alfred → Connect Gmail.' };
    if (auth.needsReconnect) return { state: 'error', detail: `Gmail needs to be reconnected (${auth.lastError ?? 'token revoked'}).` };
    return { state: 'ready', detail: auth.email ? `Connected as ${auth.email}` : 'Connected' };
  }

  private async me(): Promise<string | null> {
    if (this.myAddress) return this.myAddress;
    const auth = await this.auth.status();
    this.myAddress = auth.email ?? (await this.api.getProfile().then((p) => p.emailAddress.toLowerCase()).catch(() => null));
    return this.myAddress;
  }

  async listNewMessages(cursor: string | null, limit = this.options.pageSize): Promise<EmailListResult> {
    const parsed = parseCursor(cursor);
    const q = parsed.after ? `${this.options.query} after:${parsed.after}` : this.options.query;
    const listed = await this.api.listMessages({ q, maxResults: Math.min(limit, 100) });
    const me = await this.me();
    const messages: EmailMessageInput[] = [];
    let newest = parsed.after ?? 0;
    for (const ref of listed.messages ?? []) {
      const full = await this.api.getMessage(ref.id, 'full');
      const input = gmailMessageToInput(full, me);
      messages.push(input);
      const seconds = Math.floor(Number(full.internalDate ?? 0) / 1000);
      if (seconds > newest) newest = seconds;
    }
    // Oldest first so imports keep thread order.
    messages.sort((a, b) => (a.receivedAt ?? '').localeCompare(b.receivedAt ?? ''));
    return { messages, cursor: JSON.stringify({ after: newest || parsed.after } satisfies Cursor) };
  }

  async getMessage(externalId: string): Promise<EmailMessageInput | null> {
    try {
      return gmailMessageToInput(await this.api.getMessage(externalId, 'full'), await this.me());
    } catch (e) {
      if (e instanceof DomainError && e.details?.status === 404) return null;
      throw e;
    }
  }

  async getThread(threadId: string): Promise<EmailMessageInput[]> {
    const thread = await this.api.getThread(threadId);
    const me = await this.me();
    return (thread.messages ?? []).map((m: GmailMessage) => gmailMessageToInput(m, me));
  }

  async search(query: string, limit = 20): Promise<EmailMessageInput[]> {
    const listed = await this.api.listMessages({ q: query, maxResults: Math.min(limit, 50) });
    const me = await this.me();
    const out: EmailMessageInput[] = [];
    for (const ref of listed.messages ?? []) out.push(gmailMessageToInput(await this.api.getMessage(ref.id, 'full'), me));
    return out;
  }

  async createDraft(draft: EmailDraft): Promise<{ externalId: string | null }> {
    const me = await this.me();
    if (!me) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail account address unknown');
    const result = await this.api.createDraft(buildRawMessage(draft, { from: { name: null, email: me } }), null);
    return { externalId: result.id ?? null };
  }

  async send(draft: EmailDraft, options: { inReplyToExternalId: string | null }): Promise<{ externalId: string | null }> {
    const me = await this.me();
    if (!me) throw new DomainError('EMAIL_UNAVAILABLE', 'Gmail account address unknown');
    let threadId: string | null = null;
    let inReplyTo: string | null = null;
    let references: string | null = null;
    if (options.inReplyToExternalId) {
      const original = await this.api.getMessage(options.inReplyToExternalId, 'metadata').catch(() => null);
      if (original) {
        threadId = original.threadId;
        const headers = original.payload?.headers ?? [];
        inReplyTo = headers.find((h) => h.name.toLowerCase() === 'message-id')?.value ?? null;
        references = headers.find((h) => h.name.toLowerCase() === 'references')?.value ?? null;
      }
    }
    const result = await this.api.sendMessage(buildRawMessage(draft, { from: { name: null, email: me }, inReplyTo, references }), threadId);
    return { externalId: result.id ?? null };
  }

  async markProcessed(externalId: string): Promise<void> {
    const labelId = await this.ensureProcessedLabel();
    if (!labelId) return;
    await this.api.modifyMessage(externalId, { addLabelIds: [labelId] }).catch(() => undefined);
  }

  private async ensureProcessedLabel(): Promise<string | null> {
    if (this.processedLabelId) return this.processedLabelId;
    try {
      const labels = await this.api.listLabels();
      const existing = labels.labels?.find((l) => l.name === this.options.processedLabel);
      this.processedLabelId = existing ? existing.id : (await this.api.createLabel(this.options.processedLabel)).id;
    } catch {
      this.processedLabelId = null;
    }
    return this.processedLabelId;
  }
}

function parseCursor(cursor: string | null): Cursor {
  if (!cursor) return { after: null };
  try {
    const parsed = JSON.parse(cursor) as Partial<Cursor>;
    return { after: typeof parsed.after === 'number' && parsed.after > 0 ? parsed.after : null };
  } catch {
    return { after: null };
  }
}
