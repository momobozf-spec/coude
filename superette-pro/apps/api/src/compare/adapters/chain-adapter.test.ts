import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertUniqueAdapterKeys, getAdapter, supermarketAdapters } from './adapter-registry';
import { createChainAdapter } from './chain-adapter';
import type { AdapterContext, AdapterSnapshot } from './supermarket-adapter';

const silent = { log: () => undefined, warn: () => undefined };

function context(feedDir: string, allowDemo: boolean): AdapterContext {
  return { logger: silent, feedDir, allowDemo, now: new Date('2026-10-04T08:00:00Z') };
}

const demoSnapshot: AdapterSnapshot = {
  chain: { slug: 'test', name: 'Test' },
  source: { kind: 'DEMO', label: 'demo', termsReviewed: true },
  observedAt: new Date('2026-10-04T08:00:00Z'),
  locations: [],
  products: [],
  offers: [],
};

describe('adapter-registry', () => {
  it('registreert de acht ketens met unieke sleutels', () => {
    expect(supermarketAdapters.map((adapter) => adapter.key)).toEqual(['delhaize', 'lidl', 'colruyt', 'spar', 'albert-heijn', 'jumbo', 'carrefour', 'aldi']);
    expect(() => assertUniqueAdapterKeys(supermarketAdapters)).not.toThrow();
    expect(getAdapter('lidl')?.chain.name).toBe('Lidl');
    expect(getAdapter('aldi')?.chain.name).toBe('ALDI');
    expect(getAdapter('bestaat-niet')).toBeUndefined();
  });

  it('weigert dubbele of ongeldige sleutels', () => {
    const a = createChainAdapter({ key: 'x', chain: { slug: 'x', name: 'X' } });
    expect(() => assertUniqueAdapterKeys([a, a])).toThrow(/twee keer/);
    expect(() => assertUniqueAdapterKeys([createChainAdapter({ key: 'Niet Geldig', chain: { slug: 'x', name: 'X' } })])).toThrow(/slug/);
  });
});

describe('createChainAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'superette-feeds-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('leest een JSON-importbestand en zet datums om', async () => {
    await writeFile(
      join(dir, 'test.json'),
      JSON.stringify({
        version: 1,
        chain: { slug: 'test', name: 'Test' },
        source: { kind: 'IMPORT_FILE', label: 'bestand', termsReviewed: true },
        observedAt: '2026-10-03T10:00:00+02:00',
        products: [{ externalId: 'p1', name: 'Melk 1 l', packageQuantity: 1, packageUnit: 'L' }],
        offers: [{ productExternalId: 'p1', sourceReference: 'p1:regular', priceCents: 99, endsAt: '2026-10-10T00:00:00+02:00' }],
      }),
    );

    const adapter = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' }, demo: () => demoSnapshot });
    const snapshot = await adapter.fetchSnapshot(context(dir, true));

    expect(snapshot?.source.kind).toBe('IMPORT_FILE');
    expect(snapshot?.observedAt).toBeInstanceOf(Date);
    expect(snapshot?.offers[0]?.endsAt).toBeInstanceOf(Date);
    expect(snapshot?.offers[0]?.observedAt?.toISOString()).toBe('2026-10-03T08:00:00.000Z');
  });

  it('weigert een ongeldig JSON-bestand met een leesbare fout', async () => {
    await writeFile(join(dir, 'test.json'), JSON.stringify({ version: 1, chain: { slug: 'test', name: 'Test' }, products: [], offers: [] }));
    const adapter = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' } });
    await expect(adapter.fetchSnapshot(context(dir, true))).rejects.toThrow(/ongeldig/);
  });

  it('leest een CSV-bestand als er geen JSON is', async () => {
    await writeFile(join(dir, 'test.csv'), 'productExternalId,name,sourceReference,priceCents\np1,Melk 1 l,p1:regular,99\n');
    const adapter = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' } });
    const snapshot = await adapter.fetchSnapshot(context(dir, false));
    expect(snapshot?.source.kind).toBe('IMPORT_FILE');
    expect(snapshot?.offers).toHaveLength(1);
  });

  it('valt alleen terug op demo als dat is toegestaan', async () => {
    const adapter = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' }, demo: () => demoSnapshot });
    expect((await adapter.fetchSnapshot(context(dir, true)))?.source.kind).toBe('DEMO');
    expect(await adapter.fetchSnapshot(context(dir, false))).toBeNull();
  });

  it('geeft een live bron voorrang en valt terug bij null', async () => {
    const live: AdapterSnapshot = { ...demoSnapshot, source: { kind: 'OFFICIAL_API', label: 'api', termsReviewed: true } };
    const withLive = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' }, live: async () => live, demo: () => demoSnapshot });
    expect((await withLive.fetchSnapshot(context(dir, true)))?.source.kind).toBe('OFFICIAL_API');

    const liveDown = createChainAdapter({ key: 'test', chain: { slug: 'test', name: 'Test' }, live: async () => null, demo: () => demoSnapshot });
    expect((await liveDown.fetchSnapshot(context(dir, true)))?.source.kind).toBe('DEMO');
  });
});
