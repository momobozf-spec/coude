import type { GmailMessage } from './GmailMime';
import { DomainError } from '../../types/common';

/**
 * Thin client over the Gmail REST API (users/me). Every call carries a fresh access token
 * from `GmailAuth`; a 401 triggers one refresh + retry. Errors become EMAIL_UNAVAILABLE
 * with the Google message so System Health shows the real reason.
 */

export interface GmailApiOptions {
  accessToken: () => Promise<string>;
  /** Called on 401 to force a refresh; returns the new token. */
  refresh?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export class GmailApi {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: GmailApiOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.baseUrl = (options.baseUrl ?? 'https://gmail.googleapis.com/gmail/v1/users/me').replace(/\/$/, '');
  }

  listMessages(params: { q?: string; maxResults?: number; pageToken?: string; labelIds?: string[] } = {}): Promise<GmailListResponse> {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.maxResults) search.set('maxResults', String(params.maxResults));
    if (params.pageToken) search.set('pageToken', params.pageToken);
    for (const label of params.labelIds ?? []) search.append('labelIds', label);
    return this.request<GmailListResponse>('GET', `/messages?${search.toString()}`);
  }

  getMessage(id: string, format: 'full' | 'metadata' | 'minimal' = 'full'): Promise<GmailMessage> {
    return this.request<GmailMessage>('GET', `/messages/${encodeURIComponent(id)}?format=${format}`);
  }

  getThread(id: string): Promise<{ id: string; messages?: GmailMessage[] }> {
    return this.request('GET', `/threads/${encodeURIComponent(id)}?format=full`);
  }

  getProfile(): Promise<{ emailAddress: string; historyId?: string; messagesTotal?: number }> {
    return this.request('GET', '/profile');
  }

  createDraft(raw: string, threadId: string | null): Promise<{ id: string; message?: { id: string; threadId: string } }> {
    return this.request('POST', '/drafts', { message: { raw, ...(threadId ? { threadId } : {}) } });
  }

  sendMessage(raw: string, threadId: string | null): Promise<{ id: string; threadId: string; labelIds?: string[] }> {
    return this.request('POST', '/messages/send', { raw, ...(threadId ? { threadId } : {}) });
  }

  modifyMessage(id: string, changes: { addLabelIds?: string[]; removeLabelIds?: string[] }): Promise<GmailMessage> {
    return this.request('POST', `/messages/${encodeURIComponent(id)}/modify`, changes);
  }

  listLabels(): Promise<{ labels?: { id: string; name: string }[] }> {
    return this.request('GET', '/labels');
  }

  createLabel(name: string): Promise<{ id: string; name: string }> {
    return this.request('POST', '/labels', { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' });
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
    const token = retried && this.options.refresh ? await this.options.refresh() : await this.options.accessToken();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 401 && !retried && this.options.refresh) return this.request<T>(method, path, body, true);
    const json = (await response.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!response.ok) throw new DomainError('EMAIL_UNAVAILABLE', `Gmail API ${response.status}: ${json?.error?.message ?? 'request failed'}`, { details: { status: response.status, path } });
    return (json ?? ({} as T)) as T;
  }
}
