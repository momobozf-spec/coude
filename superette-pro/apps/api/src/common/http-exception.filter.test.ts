import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  let status = 0;
  let body: unknown = null;
  const headers: Record<string, string> = {};
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  };
  const request = { path: '/api/v1/test', headers: {}, requestId: 'req-test-1' };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
  new HttpExceptionFilter().catch(exception, host as never);
  return { status, body: body as Record<string, unknown>, headers };
}

describe('HttpExceptionFilter', () => {
  it('geeft HttpExceptions één vorm met code en requestId', () => {
    const { status, body } = run(new NotFoundException({ message: 'Niet gevonden', code: 'ALERT_NOT_FOUND', existingAlertId: 'a1' }));
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, code: 'ALERT_NOT_FOUND', message: 'Niet gevonden', existingAlertId: 'a1' });
    expect(typeof body['requestId']).toBe('string');
  });

  it('valt terug op een code per status', () => {
    const { body } = run(new BadRequestException('Ongeldig'));
    expect(body['code']).toBe('BAD_REQUEST');
  });

  it('maakt van een throttle-fout een 429 met Retry-After', () => {
    const { status, body, headers } = run(new ThrottlerException());
    expect(status).toBe(429);
    expect(body['code']).toBe('RATE_LIMITED');
    expect(headers['Retry-After']).toBe('60');
  });

  it('vertaalt body-parser-fouten naar 413/400 zonder interne details', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large', expose: true });
    expect(run(tooLarge)).toMatchObject({ status: 413, body: { code: 'PAYLOAD_TOO_LARGE' } });
    const badJson = Object.assign(new Error('Unexpected token'), { status: 400, type: 'entity.parse.failed', expose: true });
    expect(run(badJson)).toMatchObject({ status: 400, body: { code: 'INVALID_JSON' } });
    expect(JSON.stringify(run(badJson).body)).not.toContain('Unexpected token');
  });

  it('lekt niets van onbekende fouten', () => {
    const { status, body } = run(new Error('postgresql://superette:geheim@db/superette kapot'));
    expect(status).toBe(500);
    expect(body['code']).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('geheim');
    expect(JSON.stringify(body)).not.toContain('kapot');
  });
});
