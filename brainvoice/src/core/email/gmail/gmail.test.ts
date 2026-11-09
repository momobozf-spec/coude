import { describe, expect, it } from 'vitest';

import { GmailAuth, GMAIL_CREDENTIAL_KEY, type GmailTokens } from './GmailAuth';
import { base64UrlDecode, buildRawMessage, gmailMessageToInput, parseAddressList } from './GmailMime';
import { GmailProvider } from './GmailProvider';
import { FakeGmail } from './testing/FakeGmail';
import { InMemoryCredentialStore } from '../../ops/providers/CredentialStore';

const CONFIG = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://alfred.example/api/auth/gmail/callback' };

function connected(store: InMemoryCredentialStore, overrides: Partial<GmailTokens> = {}): Promise<void> {
  return store.save<GmailTokens>(GMAIL_CREDENTIAL_KEY, { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: new Date(Date.now() + 3600_000).toISOString(), scope: 'gmail.modify', email: 'me@example.com', ...overrides }, { email: 'me@example.com', connectedAt: new Date().toISOString() });
}

describe('Gmail MIME', () => {
  it('parses a multipart message with base64url bodies and stable ids', () => {
    const fake = new FakeGmail({ accountEmail: 'me@example.com' });
    const id = fake.addMessage({ from: '"Lina Peeters" <lina@client.be>', to: 'me@example.com, "Someone" <s@x.be>', subject: 'Révision — proposal', text: 'Could you send me the revised proposal before Friday?\n\nThanks,\nLina', html: '<p>Could you send me the revised proposal before Friday?</p>', date: new Date('2026-10-03T08:15:00Z') });
    const input = gmailMessageToInput(fake.messages.get(id)!, 'me@example.com');
    expect(input.externalId).toBe(id);
    expect(input.threadId).toBe(`t-${id}`);
    expect(input.from).toEqual({ name: 'Lina Peeters', email: 'lina@client.be' });
    expect(input.to).toHaveLength(2);
    expect(input.subject).toBe('Révision — proposal');
    expect(input.bodyText).toContain('revised proposal before Friday');
    expect(input.receivedAt).toBe('2026-10-03T08:15:00.000Z');
    expect(input.isFromMe).toBe(false);
    expect(input.isRead).toBe(false);
    expect(input.messageIdHeader).toBe(`<${id}@mail.example>`);
  });

  it('falls back to stripped HTML and parses address lists with quoted commas', () => {
    const fake = new FakeGmail();
    const id = fake.addMessage({ from: 'noreply@shop.example', subject: 'Deal', html: '<div><h1>Hi</h1><p>Line one<br>Line two &amp; more</p></div>' });
    expect(gmailMessageToInput(fake.messages.get(id)!, null).bodyText).toBe('Hi\nLine one\nLine two & more');
    expect(parseAddressList('"Peeters, Lina" <lina@client.be>, bob@x.be')).toEqual([{ name: 'Peeters, Lina', email: 'lina@client.be' }, { name: null, email: 'bob@x.be' }]);
  });

  it('builds an RFC 2822 reply with In-Reply-To/References and UTF-8 subject', () => {
    const raw = buildRawMessage({ to: [{ name: 'Lina', email: 'lina@client.be' }], subject: 'Re: Révision', body: 'Dag Lina,\n\nIk bezorg het voorstel vrijdag.\n\nMohamed' }, { from: { name: null, email: 'me@example.com' }, inReplyTo: '<m0001@mail.example>', references: null, date: new Date('2026-10-03T09:00:00Z') });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain('From: me@example.com');
    expect(decoded).toContain('To: Lina <lina@client.be>');
    expect(decoded).toContain('Subject: =?UTF-8?B?');
    expect(decoded).toContain('In-Reply-To: <m0001@mail.example>');
    expect(decoded).toContain('References: <m0001@mail.example>');
    expect(decoded).toContain('Content-Transfer-Encoding: base64');
    const body = decoded.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
    expect(new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)))).toContain('Ik bezorg het voorstel vrijdag.');
  });
});

describe('Gmail OAuth (GmailAuth)', () => {
  it('exchanges the consent code, stores tokens server-side and reports status', async () => {
    const fake = new FakeGmail({ accountEmail: 'me@example.com' });
    const store = new InMemoryCredentialStore();
    const auth = new GmailAuth(CONFIG, store, { fetchImpl: fake.fetch });
    expect(auth.authorizationUrl('state-1')).toContain('access_type=offline');
    expect(auth.authorizationUrl('state-1')).toContain('state=state-1');
    expect((await auth.status()).connected).toBe(false);
    const tokens = await auth.exchangeCode('good-code');
    expect(tokens.refreshToken).toBe('refresh-1');
    expect(tokens.email).toBe('me@example.com');
    const status = await auth.status();
    expect(status).toMatchObject({ configured: true, connected: true, email: 'me@example.com', needsReconnect: false });
    await expect(auth.exchangeCode('bad')).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
  });

  it('refreshes an expired access token and keeps a rotated refresh token', async () => {
    const fake = new FakeGmail({ rotateRefreshToken: true });
    const store = new InMemoryCredentialStore();
    await connected(store, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    const auth = new GmailAuth(CONFIG, store, { fetchImpl: fake.fetch });
    const token = await auth.accessToken();
    expect(token).toBe('access-refreshed-1');
    const stored = await store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY);
    expect(stored?.secret.refreshToken).toBe('refresh-rotated-1');
    expect(stored?.meta.lastRefreshAt).toBeTruthy();
    expect(await auth.accessToken()).toBe('access-refreshed-1'); // cached until expiry
    expect(fake.refreshCounter).toBe(1);
  });

  it('marks the account as needing reconnection when the refresh token was revoked', async () => {
    const fake = new FakeGmail({ refreshError: 'invalid_grant' });
    const store = new InMemoryCredentialStore();
    await connected(store, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    const auth = new GmailAuth(CONFIG, store, { fetchImpl: fake.fetch });
    await expect(auth.accessToken()).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
    const status = await auth.status();
    expect(status.needsReconnect).toBe(true);
    expect(status.lastError).toContain('revoked');
    const provider = new GmailProvider(auth, { fetchImpl: fake.fetch });
    expect((await provider.status()).state).toBe('error');
    await auth.disconnect();
    expect((await auth.status()).connected).toBe(false);
  });

  it('reports missing server configuration truthfully', async () => {
    const auth = new GmailAuth(null, new InMemoryCredentialStore());
    expect(auth.isConfigured()).toBe(false);
    expect(() => auth.authorizationUrl('x')).toThrow(/REQUIRES PROVIDER CREDENTIALS/);
    const provider = new GmailProvider(auth);
    expect((await provider.status()).detail).toContain('GMAIL_CLIENT_ID');
  });
});

describe('GmailProvider', () => {
  async function setup(options: ConstructorParameters<typeof FakeGmail>[0] = {}) {
    const fake = new FakeGmail({ accountEmail: 'me@example.com', ...options });
    const store = new InMemoryCredentialStore();
    await connected(store);
    const auth = new GmailAuth(CONFIG, store, { fetchImpl: fake.fetch });
    const provider = new GmailProvider(auth, { fetchImpl: fake.fetch });
    return { fake, store, auth, provider };
  }

  it('lists new inbox messages with a cursor so a second poll returns nothing new', async () => {
    const { fake, provider } = await setup();
    fake.addMessage({ from: 'a@x.be', subject: 'First', text: 'one', date: new Date('2026-10-03T08:00:00Z') });
    fake.addMessage({ from: 'b@x.be', subject: 'Second', text: 'two', date: new Date('2026-10-03T08:05:00Z') });
    fake.addMessage({ from: 'me@example.com', subject: 'Sent by me', text: 'x', labelIds: ['SENT'] });
    const first = await provider.listNewMessages(null, 50);
    expect(first.messages.map((m) => m.subject)).toEqual(['First', 'Second']);
    expect(first.messages.every((m) => m.providerId === 'gmail')).toBe(true);
    const again = await provider.listNewMessages(first.cursor, 50);
    // `after:` is inclusive at second granularity: the newest message may reappear; nothing older does.
    expect(again.messages.every((m) => m.subject === 'Second')).toBe(true);
    fake.addMessage({ from: 'c@x.be', subject: 'Third', text: 'three', date: new Date('2026-10-03T09:00:00Z') });
    const third = await provider.listNewMessages(again.cursor, 50);
    expect(third.messages.map((m) => m.subject)).toContain('Third');
    expect(third.messages.map((m) => m.subject)).not.toContain('First');
  });

  it('recovers from an expired token during a call (401 → refresh → retry)', async () => {
    const { fake, provider, store } = await setup();
    fake.accessTokens.delete('access-1');
    fake.addMessage({ from: 'a@x.be', subject: 'After expiry', text: 'hi' });
    const result = await provider.listNewMessages(null, 10);
    expect(result.messages[0]?.subject).toBe('After expiry');
    expect((await store.load<GmailTokens>(GMAIL_CREDENTIAL_KEY))?.secret.accessToken).toBe('access-refreshed-1');
  });

  it('sends a reply in the original thread with In-Reply-To and labels processed messages', async () => {
    const { fake, provider } = await setup();
    const original = fake.addMessage({ from: 'lina@client.be', subject: 'Proposal', text: 'Could you send it?', messageIdHeader: '<orig-123@client.be>' });
    const result = await provider.send({ id: 'd1', replyToEmailId: null, to: [{ name: 'Lina', email: 'lina@client.be' }], subject: 'Re: Proposal', body: 'Yes, Friday.', style: null, instruction: null, version: 1, status: 'draft', sentAt: null, createdAt: '', updatedAt: '' }, { inReplyToExternalId: original });
    expect(result.externalId).toBe('sent-1');
    expect(fake.sent[0]?.threadId).toBe(`t-${original}`);
    expect(fake.sent[0]?.decoded).toContain('In-Reply-To: <orig-123@client.be>');
    expect(fake.sent[0]?.decoded).toContain('To: Lina <lina@client.be>');
    await provider.markProcessed(original);
    expect(fake.labels.some((l) => l.name === 'Alfred/Processed')).toBe(true);
    expect(fake.modified[0]).toMatchObject({ id: original });
    expect((await provider.getThread(`t-${original}`)).map((m) => m.externalId)).toEqual([original]);
    expect(await provider.getMessage('does-not-exist')).toBeNull();
    expect((await provider.search('proposal')).map((m) => m.externalId)).toEqual([original]);
  });
});
