import { describe, expect, it } from 'vitest';
import { expiredCookie, parseCookies, serializeCookie } from './cookies';

describe('parseCookies', () => {
  it('leest meerdere cookies en decodeert waarden', () => {
    expect(parseCookies('a=1; sup_access=abc%2Fdef; b = 2')).toEqual({ a: '1', sup_access: 'abc/def', b: '2' });
  });

  it('is robuust voor lege of kapotte headers', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('=x; novalue; ok=1')).toEqual({ ok: '1' });
    expect(parseCookies('bad=%E0%A4%A')).toEqual({ bad: '%E0%A4%A' });
  });
});

describe('serializeCookie', () => {
  it('zet altijd HttpOnly en de gevraagde attributen', () => {
    const cookie = serializeCookie('sup_access', 'tok/en', { maxAgeSeconds: 900, path: '/api/v1', secure: true, sameSite: 'Lax' });
    expect(cookie).toBe('sup_access=tok%2Fen; Max-Age=900; Path=/api/v1; HttpOnly; SameSite=Lax; Secure');
  });

  it('laat Secure weg buiten productie en voegt een domein toe als gevraagd', () => {
    const cookie = serializeCookie('sup_refresh', 'x', { maxAgeSeconds: 10, path: '/api/v1/auth', secure: false, sameSite: 'Strict', domain: '.superette.be' });
    expect(cookie).toBe('sup_refresh=x; Max-Age=10; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Domain=.superette.be');
  });

  it('wist een cookie met levensduur nul op hetzelfde pad', () => {
    expect(expiredCookie('sup_access', { path: '/api/v1', secure: true, sameSite: 'Lax' })).toBe('sup_access=; Max-Age=0; Path=/api/v1; HttpOnly; SameSite=Lax; Secure');
  });
});
