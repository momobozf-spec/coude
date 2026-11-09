import { base64UrlDecode, base64UrlEncode, type GmailMessage } from '../GmailMime';

/**
 * In-memory stand-in for Google's OAuth token endpoint and the Gmail REST API, shaped like
 * the real responses (`format=full` payload trees, base64url bodies, list/get/send/labels).
 * Used by the provider unit tests and the end-to-end triage test.
 */
export interface FakeGmailOptions {
  accountEmail?: string;
  /** Tokens the fake accepts as valid access tokens. */
  validAccessTokens?: string[];
  /** When set, refresh requests fail with this OAuth error (e.g. invalid_grant). */
  refreshError?: string | null;
  /** Rotate the refresh token on refresh. */
  rotateRefreshToken?: boolean;
}

export interface SentRecord {
  raw: string;
  decoded: string;
  threadId: string | null;
  id: string;
}

export class FakeGmail {
  readonly messages = new Map<string, GmailMessage>();
  readonly sent: SentRecord[] = [];
  readonly drafts: { id: string; raw: string }[] = [];
  readonly labels: { id: string; name: string }[] = [{ id: 'INBOX', name: 'INBOX' }, { id: 'UNREAD', name: 'UNREAD' }, { id: 'SENT', name: 'SENT' }];
  readonly modified: { id: string; addLabelIds: string[]; removeLabelIds: string[] }[] = [];
  readonly tokenRequests: Record<string, string>[] = [];
  readonly calls: { method: string; url: string }[] = [];
  accessTokens: Set<string>;
  refreshCounter = 0;
  private seq = 1;

  constructor(readonly options: FakeGmailOptions = {}) {
    this.accessTokens = new Set(options.validAccessTokens ?? ['access-1']);
  }

  /** Adds an inbox message shaped like `users.messages.get?format=full`. Returns its id. */
  addMessage(input: { from: string; to?: string; subject: string; text?: string; html?: string; date?: Date; threadId?: string; labelIds?: string[]; messageIdHeader?: string; inReplyTo?: string }): string {
    const id = `m${String(this.seq++).padStart(4, '0')}`;
    const date = input.date ?? new Date();
    const threadId = input.threadId ?? `t-${id}`;
    const headers = [
      { name: 'From', value: input.from },
      { name: 'To', value: input.to ?? (this.options.accountEmail ?? 'me@example.com') },
      { name: 'Subject', value: input.subject },
      { name: 'Date', value: date.toUTCString() },
      { name: 'Message-ID', value: input.messageIdHeader ?? `<${id}@mail.example>` },
      ...(input.inReplyTo ? [{ name: 'In-Reply-To', value: input.inReplyTo }] : []),
    ];
    const parts = [];
    if (input.text !== undefined) parts.push({ partId: '0', mimeType: 'text/plain', body: { size: input.text.length, data: base64UrlEncode(input.text) } });
    if (input.html !== undefined) parts.push({ partId: '1', mimeType: 'text/html', body: { size: input.html.length, data: base64UrlEncode(input.html) } });
    const message: GmailMessage = {
      id,
      threadId,
      labelIds: input.labelIds ?? ['INBOX', 'UNREAD'],
      snippet: (input.text ?? input.html ?? '').slice(0, 80),
      internalDate: String(date.getTime()),
      payload: parts.length === 1 ? { mimeType: parts[0]!.mimeType, headers, body: parts[0]!.body } : { mimeType: 'multipart/alternative', headers, body: { size: 0 }, parts },
    };
    this.messages.set(id, message);
    return id;
  }

  /** `fetch` implementation to hand to GmailAuth/GmailProvider. */
  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    this.calls.push({ method, url });
    const u = new URL(url);
    if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/token') return this.token(init);
    if (u.hostname === 'oauth2.googleapis.com' && u.pathname === '/revoke') return json({});
    const auth = (init?.headers as Record<string, string> | undefined)?.authorization ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!this.accessTokens.has(token)) return json({ error: { code: 401, message: 'Invalid Credentials' } }, 401);
    const path = u.pathname.replace('/gmail/v1/users/me', '');
    if (path === '/profile') return json({ emailAddress: this.options.accountEmail ?? 'me@example.com', historyId: '1' });
    if (path === '/messages' && method === 'GET') return this.list(u);
    if (path === '/messages/send' && method === 'POST') return this.send(init);
    if (path === '/drafts' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { message: { raw: string } };
      const id = `d${this.drafts.length + 1}`;
      this.drafts.push({ id, raw: body.message.raw });
      return json({ id, message: { id: `${id}-m`, threadId: 't-draft' } });
    }
    if (path === '/labels' && method === 'GET') return json({ labels: this.labels });
    if (path === '/labels' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name: string };
      const label = { id: `Label_${this.labels.length + 1}`, name: body.name };
      this.labels.push(label);
      return json(label);
    }
    const modify = /^\/messages\/([^/]+)\/modify$/.exec(path);
    if (modify && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { addLabelIds?: string[]; removeLabelIds?: string[] };
      this.modified.push({ id: decodeURIComponent(modify[1]!), addLabelIds: body.addLabelIds ?? [], removeLabelIds: body.removeLabelIds ?? [] });
      return json(this.messages.get(decodeURIComponent(modify[1]!)) ?? {});
    }
    const get = /^\/messages\/([^/]+)$/.exec(path);
    if (get && method === 'GET') {
      const message = this.messages.get(decodeURIComponent(get[1]!));
      return message ? json(message) : json({ error: { code: 404, message: 'Not Found' } }, 404);
    }
    const thread = /^\/threads\/([^/]+)$/.exec(path);
    if (thread && method === 'GET') {
      const id = decodeURIComponent(thread[1]!);
      return json({ id, messages: [...this.messages.values()].filter((m) => m.threadId === id) });
    }
    return json({ error: { code: 404, message: `no route ${method} ${path}` } }, 404);
  };

  private async token(init?: RequestInit): Promise<Response> {
    const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')).entries());
    this.tokenRequests.push(params);
    if (params.grant_type === 'authorization_code') {
      if (params.code !== 'good-code') return json({ error: 'invalid_grant', error_description: 'Bad code' }, 400);
      this.accessTokens.add('access-from-code');
      return json({ access_token: 'access-from-code', refresh_token: 'refresh-1', expires_in: 3600, scope: 'gmail.modify', token_type: 'Bearer' });
    }
    if (params.grant_type === 'refresh_token') {
      if (this.options.refreshError) return json({ error: this.options.refreshError, error_description: 'Token has been expired or revoked.' }, 400);
      this.refreshCounter++;
      const token = `access-refreshed-${this.refreshCounter}`;
      this.accessTokens.add(token);
      return json({ access_token: token, expires_in: 3600, scope: 'gmail.modify', token_type: 'Bearer', ...(this.options.rotateRefreshToken ? { refresh_token: `refresh-rotated-${this.refreshCounter}` } : {}) });
    }
    return json({ error: 'unsupported_grant_type' }, 400);
  }

  private list(u: URL): Response {
    const q = u.searchParams.get('q') ?? '';
    const max = Number(u.searchParams.get('maxResults') ?? 100);
    const after = /after:(\d+)/.exec(q);
    const afterSeconds = after ? Number(after[1]) : null;
    const inInbox = /\bin:inbox\b/.test(q);
    const needle = q
      .replace(/after:\d+/g, '')
      .replace(/in:\w+/g, '')
      .trim()
      .toLowerCase();
    const matches = [...this.messages.values()]
      .filter((m) => !inInbox || (m.labelIds ?? []).includes('INBOX'))
      .filter((m) => afterSeconds === null || Math.floor(Number(m.internalDate) / 1000) >= afterSeconds)
      .filter((m) => !needle || JSON.stringify(m).toLowerCase().includes(needle))
      .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))
      .slice(0, max);
    return json({ messages: matches.map((m) => ({ id: m.id, threadId: m.threadId })), resultSizeEstimate: matches.length });
  }

  private send(init?: RequestInit): Response {
    const body = JSON.parse(String(init?.body ?? '{}')) as { raw: string; threadId?: string };
    const id = `sent-${this.sent.length + 1}`;
    this.sent.push({ raw: body.raw, decoded: base64UrlDecode(body.raw), threadId: body.threadId ?? null, id });
    return json({ id, threadId: body.threadId ?? `t-${id}`, labelIds: ['SENT'] });
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
