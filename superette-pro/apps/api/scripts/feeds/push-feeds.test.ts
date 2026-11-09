import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { pushFeed, resolveTarget, selectFeeds, validateLocally } from './push-feeds';

const KEY = 'geheime-jobsleutel-Qm4tZ8vR2xK7pL9wN3abc';
const validFeed = JSON.stringify({
  version: 1,
  chain: { slug: 'delhaize', name: 'Delhaize' },
  source: { kind: 'IMPORT_FILE', label: 'Test', termsReviewed: false },
  observedAt: '2026-10-24T08:00:00+02:00',
  products: [{ externalId: 'p1', name: 'Melk' }],
  offers: [{ productExternalId: 'p1', sourceReference: 'p1:regular', priceCents: 99 }],
});

describe('resolveTarget', () => {
  it('eist https (http alleen voor localhost) en /api/v1', () => {
    expect(resolveTarget({ PUSH_API_URL: 'https://api.example.be/api/v1/', PUSH_JOB_KEY: KEY })).toEqual({ apiUrl: 'https://api.example.be/api/v1', jobKey: KEY });
    expect(resolveTarget({ PUSH_API_URL: 'http://localhost:4000/api/v1', COMPARE_JOB_KEY: KEY }).jobKey).toBe(KEY);
    expect(() => resolveTarget({ PUSH_API_URL: 'http://api.example.be/api/v1', PUSH_JOB_KEY: KEY })).toThrow(/https/);
    expect(() => resolveTarget({ PUSH_API_URL: 'https://api.example.be', PUSH_JOB_KEY: KEY })).toThrow(/api\/v1/);
    expect(() => resolveTarget({ PUSH_JOB_KEY: KEY })).toThrow(/PUSH_API_URL/);
    expect(() => resolveTarget({ PUSH_API_URL: 'https://api.example.be/api/v1' })).toThrow(/PUSH_JOB_KEY/);
  });
});

describe('selectFeeds', () => {
  it('neemt alleen geregistreerde adapters en meldt de rest', () => {
    const files = ['README.md', 'example.json', 'delhaize.json', 'aldi.json', 'dd', 'oud.json', 'lidl.csv'];
    expect(selectFeeds(files, ['delhaize', 'aldi', 'lidl'])).toEqual({ selected: ['aldi', 'delhaize'], skipped: ['oud.json'] });
    expect(selectFeeds(files, ['delhaize', 'aldi'], ['aldi', 'spar'])).toEqual({ selected: ['aldi'], skipped: ['oud.json', 'spar.json (niet gevonden of geen geregistreerde adapter)'] });
  });
});

describe('validateLocally', () => {
  it('gebruikt hetzelfde schema als de server', () => {
    expect(validateLocally({ adapterKey: 'delhaize', path: 'delhaize.json', raw: validFeed })).toEqual({ ok: true });
    const bad = validateLocally({ adapterKey: 'delhaize', path: 'delhaize.json', raw: JSON.stringify({ version: 1 }) });
    expect(bad.ok).toBe(false);
    expect(validateLocally({ adapterKey: 'x', path: 'x.json', raw: '{nope' })).toEqual({ ok: false, error: 'x.json: geen geldige JSON' });
  });
});

describe('pushFeed', () => {
  const target = { apiUrl: 'https://api.example.be/api/v1', jobKey: KEY };
  const candidate = { adapterKey: 'delhaize', path: 'delhaize.json', raw: validFeed };

  it('stuurt gzip met x-job-key naar het juiste pad', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 202, ok: true, text: async () => JSON.stringify({ changed: true, offers: 1, sync: 'STARTED' }) }));
    const outcome = await pushFeed(target, candidate, fetchImpl);
    expect(outcome).toEqual({ adapterKey: 'delhaize', ok: true, status: 202, changed: true, offers: 1, sync: 'STARTED' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: Uint8Array }];
    expect(url).toBe('https://api.example.be/api/v1/compare/internal/feeds/delhaize');
    expect(init.headers).toMatchObject({ 'x-job-key': KEY, 'content-encoding': 'gzip', 'content-type': 'application/json' });
    expect(gunzipSync(Buffer.from(init.body)).toString('utf8')).toBe(validFeed);
  });

  it('vat serverfouten samen en lekt de sleutel nooit', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 400,
      ok: false,
      text: async () => JSON.stringify({ code: 'CHAIN_MISMATCH', message: `fout met ${KEY}`, issues: [{ path: 'chain.slug', message: 'x' }] }),
    }));
    const outcome = await pushFeed(target, candidate, fetchImpl);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.error).toContain('CHAIN_MISMATCH');
      expect(outcome.error).not.toContain(KEY);
    }

    const network = await pushFeed(target, candidate, async () => {
      throw new Error(`ECONNREFUSED ${KEY}`);
    });
    expect(network.ok).toBe(false);
    if (!network.ok) expect(network.error).not.toContain(KEY);
  });
});
