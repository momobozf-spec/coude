/**
 * De installeerbare app: manifest, iconen en service worker. Leest de echte
 * bestanden uit `public/`, zodat een kapot manifest of een ontbrekend icoon
 * hier faalt in plaats van pas op een telefoon.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const PUBLIC = resolve(import.meta.dirname, '..', '..', 'public');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

const manifest = JSON.parse(readFileSync(resolve(PUBLIC, 'manifest.webmanifest'), 'utf8')) as Record<string, unknown> & { icons: ManifestIcon[] };

/** Breedte en hoogte uit de IHDR-chunk van een PNG. */
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(resolve(PUBLIC, file.replace(/^\//, '')));
  expect(buffer.subarray(1, 4).toString('ascii'), `${file} is geen PNG`).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('manifest', () => {
  it('is volledig voor installatie als standalone app', () => {
    expect(manifest['name']).toMatch(/Superette/);
    expect(manifest['short_name']).toBe('Superette');
    expect(manifest['display']).toBe('standalone');
    expect(manifest['scope']).toBe('/');
    expect(String(manifest['start_url']).startsWith('/')).toBe(true);
    expect(manifest['lang']).toBe('nl-BE');
    expect(manifest['theme_color']).toMatch(/^#[0-9A-F]{6}$/i);
    expect(manifest['background_color']).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('heeft PNG-iconen van 192 en 512 px, gewoon én maskeerbaar, met de juiste afmetingen', () => {
    const png = manifest.icons.filter((icon) => icon.type === 'image/png');
    for (const purpose of ['any', 'maskable']) {
      for (const size of [192, 512]) {
        const icon = png.find((i) => (i.purpose ?? 'any').split(' ').includes(purpose) && i.sizes === `${size}x${size}`);
        expect(icon, `${purpose} ${size}`).toBeDefined();
        expect(pngSize(icon!.src)).toEqual({ width: size, height: size });
      }
    }
  });

  it('heeft een apple-touch-icon van 180 px', () => {
    expect(pngSize('/icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });
});

describe('service worker (public/sw.js)', () => {
  const source = readFileSync(resolve(PUBLIC, 'sw.js'), 'utf8');
  const API = 'https://api.superette.be/api/v1';
  const ORIGIN = 'https://superette.be';
  const self: Record<string, unknown> = {
    location: { href: `${ORIGIN}/sw.js?api=${encodeURIComponent(API)}`, origin: ORIGIN },
    addEventListener: () => undefined,
  };
  runInNewContext(source, { self, URL, Headers, Response, Number, String, Promise });
  const sw = self['__superetteSw'] as {
    classify: (request: { method: string; url: string; mode?: string }, base: string, origin: string) => string;
    isStorable: (response: Response) => boolean;
    isFresh: (cachedAt: string | null, now: number) => boolean;
    API_MAX_AGE_MS: number;
  };
  const get = (url: string, mode = 'cors') => sw.classify({ method: 'GET', url, mode }, API, ORIGIN);

  it('bewaart de app-schil en navigeert via het netwerk', () => {
    expect(get(`${ORIGIN}/_next/static/chunks/app.js`)).toBe('static');
    expect(get(`${ORIGIN}/icons/icon-192.png`)).toBe('static');
    expect(get(`${ORIGIN}/offline.html`)).toBe('static');
    expect(get(`${ORIGIN}/zoeken?q=melk`, 'navigate')).toBe('navigate');
  });

  it('cachet alleen publieke prijsroutes van de API', () => {
    for (const path of ['/compare/chains', '/compare/categories', '/compare/search?q=melk', '/compare/promotions?pageSize=6', '/compare/products/abc', '/compare/products/abc/history']) {
      expect(get(`${API}${path}`), path).toBe('public-api');
    }
  });

  it('laat persoonlijke routes en schrijfacties nooit door de cache gaan', () => {
    for (const path of ['/auth/me', '/auth/login', '/compare/lists', '/compare/lists/l1', '/compare/alerts', '/compare/notifications', '/compare/preferences', '/account/export']) {
      expect(get(`${API}${path}`), path).toBe('bypass');
    }
    expect(sw.classify({ method: 'POST', url: `${API}/compare/search`, mode: 'cors' }, API, ORIGIN)).toBe('bypass');
    expect(sw.classify({ method: 'POST', url: `${API}/compare/lists/l1/compare`, mode: 'cors' }, API, ORIGIN)).toBe('bypass');
    expect(get('https://elders.example/compare/search')).toBe('bypass');
  });

  it('bewaart geen antwoorden met no-store of een fout', () => {
    expect(sw.isStorable(new Response('{}', { status: 200, headers: { 'cache-control': 'private, no-cache' } }))).toBe(true);
    expect(sw.isStorable(new Response('{}', { status: 200, headers: { 'cache-control': 'no-store' } }))).toBe(false);
    expect(sw.isStorable(new Response('{}', { status: 500 }))).toBe(false);
  });

  it('toont offline hooguit tien minuten oude prijzen', () => {
    expect(sw.API_MAX_AGE_MS).toBe(10 * 60 * 1000);
    expect(sw.isFresh('1000', 1000 + sw.API_MAX_AGE_MS)).toBe(true);
    expect(sw.isFresh('1000', 1000 + sw.API_MAX_AGE_MS + 1)).toBe(false);
    expect(sw.isFresh(null, 1000)).toBe(false);
  });
});
