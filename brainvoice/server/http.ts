import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

import type { GmailAccountManager } from './accounts';
import type { ReadyReport } from './runtime';
import { dispatchOpsCall, type OpsClient } from '../src/core/ops/client';
import type { Logger } from '../src/core/logging/logger';
import { DomainError } from '../src/core/types/common';

export interface HttpServerOptions {
  client: OpsClient;
  /** Bearer token; when null and `allowAnonymous` is false every API call is refused. */
  token: string | null;
  allowAnonymous: boolean;
  logger?: Logger;
  maxBodyBytes?: number;
  version: string;
  /** Readiness probe (database + heartbeats). */
  ready?: () => Promise<ReadyReport>;
  /** Gmail OAuth flow (connected mailbox); null when the provider is not Gmail. */
  accounts?: GmailAccountManager | null;
  /** Requests per minute per client address (RPC); authentication failures are limited separately. */
  rateLimitPerMinute?: number;
  /** Use X-Forwarded-For when behind a reverse proxy. */
  trustProxy?: boolean;
  /** TLS material; when given the server speaks HTTPS itself. */
  tls?: { cert: Buffer | string; key: Buffer | string } | null;
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

/**
 * JSON API over node:http (no framework):
 *  GET  /api/health                 – liveness (no auth): { ok, version }
 *  GET  /api/ready                  – readiness (no auth): database + worker/scheduler heartbeats; 503 when the database is down
 *  GET  /api/mission-control        – summary (bearer auth)
 *  POST /api/ops/<method>           – RPC onto the OpsClient (bearer auth), body { args: [...] }
 *  GET  /api/auth/gmail/start       – consent URL for the Gmail account (bearer auth)
 *  GET  /api/auth/gmail/callback    – Google redirects here (state-checked, no bearer)
 * Rate limits: `rateLimitPerMinute` per address for authenticated calls, 20/min for failed auth.
 */
export function createRequestHandler(options: HttpServerOptions): Handler {
  const maxBody = options.maxBodyBytes ?? 1_000_000;
  const limiter = new RateLimiter(options.rateLimitPerMinute ?? 240, 20);
  return async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const address = clientAddress(req, options.trustProxy ?? false);
    const requestId = typeof req.headers['x-request-id'] === 'string' && /^[\w-]{1,64}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID();
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000', 'x-request-id': requestId, ...headers });
      res.end(text);
      options.logger?.info('http', { requestId, method: req.method, path: url.pathname, status, ms: Date.now() - started, address });
    };
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true, version: options.version });
      if (req.method === 'GET' && url.pathname === '/api/ready') {
        const report = options.ready ? await options.ready() : { ok: true, database: 'ok', dialect: 'sqlite', workersAlive: 0, schedulerAlive: false, continuous: false, version: options.version, detail: null };
        return send(report.ok ? 200 : 503, report);
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/gmail/callback') {
        if (!options.accounts) return send(404, page('Gmail is not configured on this server.'));
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        if (error) return send(400, page(`Google refused the connection: ${escapeHtml(error)}.`));
        if (!code || !state) return send(400, page('Missing code or state.'));
        if (!limiter.allow(`auth:${address}`, 'auth')) return send(429, page('Too many attempts. Try again in a minute.'));
        const result = await options.accounts.finishConnect(state, code);
        return send(200, page(`Gmail connected${result.email ? ` as ${escapeHtml(result.email)}` : ''}. You can return to the app.`));
      }
      if (!authorised(req, options)) {
        if (!limiter.allow(`auth:${address}`, 'auth')) return send(429, { error: { code: 'RATE_LIMITED', message: 'Too many failed authentication attempts' } });
        return send(401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid bearer token' } });
      }
      if (!limiter.allow(`api:${address}`, 'api')) return send(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { 'retry-after': '60' });
      if (req.method === 'GET' && url.pathname === '/api/mission-control') return send(200, { result: await options.client.summary() });
      if (req.method === 'GET' && url.pathname === '/api/auth/gmail/start') {
        if (!options.accounts) return send(404, { error: { code: 'NOT_FOUND', message: 'Gmail is not configured on this server (ALFRED_EMAIL_PROVIDER=gmail)' } });
        const consentUrl = await options.accounts.connectUrl();
        if (!consentUrl) return send(409, { error: { code: 'EMAIL_UNAVAILABLE', message: 'REQUIRES PROVIDER CREDENTIALS: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REDIRECT_URI' } });
        return send(200, { result: { url: consentUrl } });
      }
      const rpc = /^\/api\/ops\/([a-zA-Z]+)$/.exec(url.pathname);
      if (req.method === 'POST' && rpc) {
        const body = await readJson(req, maxBody);
        const args = body && typeof body === 'object' && Array.isArray((body as { args?: unknown }).args) ? ((body as { args: unknown[] }).args) : [];
        const result = await dispatchOpsCall(options.client, rpc[1]!, args);
        return send(200, { result: result === undefined ? null : result });
      }
      return send(404, { error: { code: 'NOT_FOUND', message: `No route ${req.method} ${url.pathname}` } });
    } catch (e) {
      const error = DomainError.from(e);
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_ARGUMENTS' || error.code === 'VALIDATION_FAILED' || error.code === 'TICKET_STATE' ? 400 : error.code === 'CONFIRMATION_REQUIRED' || error.code === 'APPROVAL_REQUIRED' ? 403 : error.code === 'EMAIL_UNAVAILABLE' ? 409 : 500;
      options.logger?.warn('http error', { requestId, path: url.pathname, code: error.code, message: error.message });
      if (url.pathname.startsWith('/api/auth/')) return send(status, page(`Error: ${escapeHtml(error.message)}`));
      return send(status, { error: { code: error.code, message: error.message } });
    }
  };
}

export function createHttpServer(options: HttpServerOptions): http.Server | https.Server {
  const handler = createRequestHandler(options);
  const listener = (req: http.IncomingMessage, res: http.ServerResponse) => void handler(req, res);
  return options.tls ? https.createServer({ cert: options.tls.cert, key: options.tls.key }, listener) : http.createServer(listener);
}

/** Fixed-window limiter keyed by address; small and dependency-free (one process). */
class RateLimiter {
  private readonly buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly apiPerMinute: number,
    private readonly authPerMinute: number,
  ) {}

  allow(key: string, kind: 'api' | 'auth', now = Date.now()): boolean {
    const limit = kind === 'auth' ? this.authPerMinute : this.apiPerMinute;
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      this.buckets.set(key, { count: 1, windowStart: now });
      if (this.buckets.size > 10_000) this.buckets.clear();
      return true;
    }
    bucket.count++;
    return bucket.count <= limit;
  }
}

function clientAddress(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    if (first?.trim()) return first.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function authorised(req: http.IncomingMessage, options: HttpServerOptions): boolean {
  if (!options.token) return options.allowAnonymous;
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(match && timingSafeEqual(match[1]!.trim(), options.token));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readJson(req: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new DomainError('INVALID_ARGUMENTS', 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new DomainError('INVALID_ARGUMENTS', 'Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function page(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alfred</title><style>body{font-family:system-ui,sans-serif;background:#0B0B10;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}main{max-width:28rem;padding:2rem;text-align:center}</style></head><body><main><h1>Alfred</h1><p>${message}</p></main></body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
