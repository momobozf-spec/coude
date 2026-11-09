import http from 'node:http';

import { FakeGmail } from '../../src/core/email/gmail/testing/FakeGmail';

/**
 * Staging stand-in for Google (OAuth + Gmail REST) served over HTTP, so a production-like
 * Alfred deployment can be driven end to end on a machine without Google credentials.
 * It is a MOCK: evidence gathered against it never counts as "real Gmail". Control endpoints:
 *   POST /__control/messages   { from, subject, text, html?, date? }  → { id, threadId }
 *   GET  /__control/sent                                             → messages Alfred sent
 *   GET  /__control/state                                            → counters
 *   POST /__control/fail       { mode: 'network' | 'ok' }            → simulate an outage
 *   GET  /o/oauth2/v2/auth?redirect_uri=…&state=…                    → 302 to the callback with code=good-code
 */
const port = Number(process.env.MOCK_GMAIL_PORT ?? 8790);
const account = process.env.MOCK_GMAIL_ACCOUNT ?? 'mohamed@staging.example';
const fake = new FakeGmail({ accountEmail: account, rotateRefreshToken: true });
let failMode: 'ok' | 'network' = 'ok';

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const body = await readBody(req);
  const log = (status: number, note = '') => process.stdout.write(`${new Date().toISOString()} ${req.method} ${url.pathname} → ${status} ${note}\n`);

  if (url.pathname.startsWith('/__control/')) {
    if (url.pathname === '/__control/messages' && req.method === 'POST') {
      const input = JSON.parse(body || '{}') as { from: string; subject: string; text?: string; html?: string; date?: string };
      const id = fake.addMessage({ from: input.from, to: account, subject: input.subject, text: input.text, html: input.html, date: input.date ? new Date(input.date) : new Date() });
      log(200, `message ${id}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id, threadId: fake.messages.get(id)?.threadId, receivedAt: new Date().toISOString() }));
    }
    if (url.pathname === '/__control/sent') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(fake.sent.map((s) => ({ id: s.id, threadId: s.threadId, headers: s.decoded.split('\r\n\r\n')[0], body: s.decoded.split('\r\n\r\n')[1] ?? '' }))));
    }
    if (url.pathname === '/__control/state') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ messages: fake.messages.size, sent: fake.sent.length, drafts: fake.drafts.length, labels: fake.labels.map((l) => l.name), modified: fake.modified.length, tokenRequests: fake.tokenRequests.length, refreshCount: fake.refreshCounter, calls: fake.calls.length, failMode }));
    }
    if (url.pathname === '/__control/fail' && req.method === 'POST') {
      failMode = (JSON.parse(body || '{}') as { mode?: 'ok' | 'network' }).mode === 'network' ? 'network' : 'ok';
      log(200, `failMode=${failMode}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ failMode }));
    }
    res.writeHead(404);
    return res.end();
  }

  if (failMode === 'network') {
    log(0, 'simulated network failure (socket destroyed)');
    return req.socket.destroy();
  }

  if (url.pathname === '/o/oauth2/v2/auth') {
    // Google's consent screen, auto-approved: redirect to the registered callback.
    const redirect = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const target = `${redirect}?code=good-code&state=${encodeURIComponent(state)}`;
    log(302, `consent → ${redirect}`);
    res.writeHead(302, { location: target });
    return res.end();
  }

  // Translate local paths to the hosts FakeGmail expects.
  const host = url.pathname === '/token' || url.pathname === '/revoke' ? 'https://oauth2.googleapis.com' : 'https://gmail.googleapis.com';
  const headers: Record<string, string> = {};
  if (typeof req.headers.authorization === 'string') headers.authorization = req.headers.authorization;
  if (typeof req.headers['content-type'] === 'string') headers['content-type'] = req.headers['content-type'];
  const response = await fake.fetch(`${host}${url.pathname}${url.search}`, { method: req.method, headers, body: body || undefined });
  const text = await response.text();
  log(response.status);
  res.writeHead(response.status, { 'content-type': 'application/json' });
  res.end(text);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`${new Date().toISOString()} mock gmail listening on http://127.0.0.1:${port} (account ${account}) – MOCK, not Google\n`);
});
