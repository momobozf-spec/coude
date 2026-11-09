import type { EmailAddress, EmailDraft } from '../../domain/admin';
import type { EmailMessageInput } from '../EmailAdapter';

/**
 * Gmail message payloads ↔ BrainVoice messages. Parsing works on the `format=full`
 * shape (headers + MIME part tree with base64url bodies); building produces an RFC 2822
 * message encoded base64url for `messages.send` / `drafts.create`.
 */

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
  sizeEstimate?: number;
}

export function base64UrlDecode(data: string): string {
  const normalised = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

export function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function header(part: GmailPart | undefined, name: string): string | null {
  const found = part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

export function parseAddress(raw: string): EmailAddress {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(raw);
  if (match) return { name: match[1]?.trim() || null, email: match[2]!.trim().toLowerCase() };
  return { name: null, email: raw.trim().replace(/^<|>$/g, '').toLowerCase() };
}

export function parseAddressList(raw: string | null): EmailAddress[] {
  if (!raw) return [];
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAddress);
}

function findPart(part: GmailPart | undefined, mimeType: string): GmailPart | null {
  if (!part) return null;
  if ((part.mimeType ?? '').toLowerCase() === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function bodyText(message: GmailMessage): string {
  const plain = findPart(message.payload, 'text/plain');
  if (plain?.body?.data) return base64UrlDecode(plain.body.data);
  const html = findPart(message.payload, 'text/html');
  if (html?.body?.data) return stripHtml(base64UrlDecode(html.body.data));
  return message.snippet ?? '';
}

/** Converts a Gmail message into the provider-neutral input the EmailService imports. */
export function gmailMessageToInput(message: GmailMessage, myAddress: string | null): EmailMessageInput & { messageIdHeader: string | null } {
  const from = parseAddress(header(message.payload, 'From') ?? '');
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : (header(message.payload, 'Date') ? new Date(header(message.payload, 'Date')!).toISOString() : new Date().toISOString());
  return {
    externalId: message.id,
    threadId: message.threadId,
    account: myAddress,
    from,
    to: parseAddressList(header(message.payload, 'To')),
    cc: parseAddressList(header(message.payload, 'Cc')),
    subject: header(message.payload, 'Subject') ?? '',
    bodyText: bodyText(message),
    receivedAt,
    isFromMe: Boolean(myAddress && from.email === myAddress.toLowerCase()) || Boolean(message.labelIds?.includes('SENT')),
    isRead: !(message.labelIds ?? []).includes('UNREAD'),
    providerId: 'gmail',
    messageIdHeader: header(message.payload, 'Message-ID') ?? header(message.payload, 'Message-Id'),
  };
}

function encodeHeaderValue(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(value)))}?=`;
}

function formatAddress(a: EmailAddress): string {
  return a.name ? `${encodeHeaderValue(a.name)} <${a.email}>` : a.email;
}

export interface RawMessageOptions {
  from: EmailAddress;
  inReplyTo?: string | null;
  references?: string | null;
  date?: Date;
}

/** RFC 2822 message (base64 body, UTF-8) encoded base64url for the Gmail API. */
export function buildRawMessage(draft: Pick<EmailDraft, 'to' | 'subject' | 'body'>, options: RawMessageOptions): string {
  const lines = [
    `From: ${formatAddress(options.from)}`,
    `To: ${draft.to.map(formatAddress).join(', ')}`,
    `Subject: ${encodeHeaderValue(draft.subject)}`,
    `Date: ${(options.date ?? new Date()).toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];
  if (options.inReplyTo) {
    lines.push(`In-Reply-To: ${options.inReplyTo}`);
    lines.push(`References: ${options.references ? `${options.references} ${options.inReplyTo}` : options.inReplyTo}`);
  }
  const body = btoa(String.fromCharCode(...new TextEncoder().encode(draft.body))).replace(/(.{76})/g, '$1\r\n');
  return base64UrlEncode(`${lines.join('\r\n')}\r\n\r\n${body}`);
}
