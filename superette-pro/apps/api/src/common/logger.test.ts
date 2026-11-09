import { describe, expect, it } from 'vitest';
import { redact } from './logger';

describe('redact', () => {
  it('maskeert Bearer-tokens en JWT\'s', () => {
    expect(redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123456789')).toBe('Authorization: Bearer [redacted]');
    expect(redact('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlMTIzNDU2')).toBe('token [jwt-redacted]');
  });

  it('maskeert wachtwoorden, sleutels en cookies in tekst en JSON', () => {
    expect(redact('{"password":"geheim123","email":"a@b.be"}')).toBe('{"password":[redacted],"email":"a@b.be"}');
    expect(redact('x-job-key: abcdefghijklmnop')).toBe('x-job-key: [redacted]');
    expect(redact('cookie=sup_access=abc; sup_refresh=def')).toContain('[redacted]');
    expect(redact('apiKey=sk_live_123')).toBe('apiKey=[redacted]');
  });

  it('maskeert databaseverbindingen', () => {
    expect(redact('postgresql://superette:supergeheim@db.example:5432/superette')).toBe('postgresql://[redacted]@db.example:5432/superette');
  });

  it('laat gewone tekst met rust', () => {
    expect(redact('sync klaar in 1200 ms · 7 adapters')).toBe('sync klaar in 1200 ms · 7 adapters');
  });
});
