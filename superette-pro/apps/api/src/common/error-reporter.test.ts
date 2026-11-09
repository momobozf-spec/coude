import { describe, expect, it, vi } from 'vitest';
import { buildEvent, ErrorReporter, framesFromStack, parseDsn } from './error-reporter';

const options = { service: 'superette-api', environment: 'test', version: '1.2.3' };

describe('parseDsn', () => {
  it('leidt het envelope-endpoint en de sleutel af', () => {
    expect(parseDsn('https://abc123@o1.ingest.sentry.io/4509')).toEqual({ endpoint: 'https://o1.ingest.sentry.io/api/4509/envelope/', publicKey: 'abc123', projectId: '4509' });
    expect(parseDsn('http://key@127.0.0.1:9999/sub/pad/7').endpoint).toBe('http://127.0.0.1:9999/sub/pad/api/7/envelope/');
  });

  it('weigert een DSN zonder sleutel of project', () => {
    expect(() => parseDsn('https://sentry.io/1')).toThrow(/ongeldig/);
    expect(() => parseDsn('https://key@sentry.io/')).toThrow(/ongeldig/);
  });
});

describe('framesFromStack', () => {
  it('zet een Node-stack om in frames, oudste eerst', () => {
    const frames = framesFromStack('Error: kapot\n    at doe (C:\\app\\dist\\x.js:10:5)\n    at C:\\app\\dist\\main.js:3:1');
    expect(frames).toEqual([
      { function: '<anonymous>', filename: 'C:\\app\\dist\\main.js', lineno: 3, colno: 1 },
      { function: 'doe', filename: 'C:\\app\\dist\\x.js', lineno: 10, colno: 5 },
    ]);
  });
});

describe('buildEvent', () => {
  it('bevat type, waarde, omgeving, release en request-id — zonder geheimen', () => {
    const event = buildEvent(
      { level: 'error', message: 'PrismaClientKnownRequestError: postgresql://superette:geheim@db/x kapot requestId=req-1', stack: 'Error\n    at f (a.js:1:1) token=abc', context: 'HTTP', requestId: 'req-1' },
      options,
    ) as { exception: { values: Array<{ type: string; value: string }> }; tags: Record<string, string>; release: string };
    expect(event.exception.values[0]?.type).toBe('PrismaClientKnownRequestError');
    expect(event.exception.values[0]?.value).toContain('[redacted]@db/x');
    expect(event.tags['requestId']).toBe('req-1');
    expect(event.release).toBe('superette-api@1.2.3');
    expect(JSON.stringify(event)).not.toContain('geheim');
    expect(JSON.stringify(event)).not.toContain('token=abc');
  });
});

describe('ErrorReporter', () => {
  it('verstuurt een envelope met auth-header en stopt boven de limiet', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response('', { status: 200 });
    });
    const reporter = new ErrorReporter('https://pubkey@monitor.example/42', { ...options, fetchImpl: fetchImpl as unknown as typeof fetch, maxPerMinute: 2 });
    reporter.report({ level: 'error', message: 'Error: een', context: 'T' });
    reporter.report({ level: 'fatal', message: 'Error: twee', context: 'T' });
    reporter.report({ level: 'error', message: 'Error: drie (boven de limiet)', context: 'T' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://monitor.example/api/42/envelope/');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['x-sentry-auth']).toContain('sentry_key=pubkey');
    expect(headers['content-type']).toBe('application/x-sentry-envelope');
    const lines = String(calls[0]?.init.body).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]!)).toEqual({ type: 'event' });
    expect(JSON.parse(lines[2]!).exception.values[0].value).toBe('een');
  });

  it('laat een onbereikbare provider nooit naar de aanroeper lekken', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const reporter = new ErrorReporter('https://k@monitor.example/1', { ...options, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(() => reporter.report({ level: 'error', message: 'Error: x' })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
