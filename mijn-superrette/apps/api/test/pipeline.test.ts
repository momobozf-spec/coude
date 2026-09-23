import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, providerErrors, type DatabaseHandle } from '@superrette/database';
import { createNormalizer, IngestionPipeline } from '@superrette/ingestion';
import {
  BaseStoreProvider,
  ProviderRegistry,
  type ProviderInfo,
  type ProviderPrice,
  type ProviderProduct,
} from '@superrette/store-providers';
import { TEST_DATABASE_URL } from './env.js';

const info = (key: string): ProviderInfo => ({
  key,
  displayName: key,
  retailerSlugs: ['colruyt'],
  supportStatus: 'EXPERIMENTAL',
  reason: 'test provider',
  dataOrigin: 'DEVELOPMENT_SEED',
  capabilities: ['listCatalog', 'getPrices'],
  documentation: 'test',
});

class FlakyProvider extends BaseStoreProvider {
  readonly info = info('test-flaky');
  override async *listCatalog(): AsyncIterable<ProviderProduct> {
    yield { externalId: 'flaky-good', retailerSlug: 'colruyt', title: 'Testmerk Appelsap 1L', brand: 'Testmerk', gtins: [] };
    yield { externalId: '', retailerSlug: 'colruyt', title: '' } as ProviderProduct; // invalid
    yield { externalId: 'flaky-unknown-retailer', retailerSlug: 'nope', title: 'X 1L' };
  }
  override async *getPrices(): AsyncIterable<ProviderPrice> {
    yield { externalId: 'flaky-good', retailerSlug: 'colruyt', observedAt: new Date(), regularPriceCents: 199 };
    yield { externalId: 'flaky-good', retailerSlug: 'colruyt', observedAt: new Date(), regularPriceCents: 100, promoPriceCents: 150 }; // promo > regular
  }
}

class BrokenProvider extends BaseStoreProvider {
  readonly info = info('test-broken');
  // eslint-disable-next-line require-yield
  override async *listCatalog(): AsyncIterable<ProviderProduct> {
    throw new Error('upstream exploded');
  }
}

let handle: DatabaseHandle;
let pipeline: IngestionPipeline;

beforeAll(async () => {
  handle = createDatabase(TEST_DATABASE_URL, { max: 4 });
  const registry = new ProviderRegistry().register(new FlakyProvider()).register(new BrokenProvider());
  pipeline = new IngestionPipeline({ db: handle.db, registry, normalizer: await createNormalizer(handle.db) });
});

afterAll(async () => {
  await handle.close();
});

describe('IngestionPipeline failure isolation', () => {
  it('skips bad records, records ProviderErrors and reports PARTIAL', async () => {
    const report = await pipeline.runSync('test-flaky', 'FULL');
    expect(report.status).toBe('PARTIAL');
    expect(report.read).toBe(5);
    expect(report.failed).toBe(3);
    expect(report.created).toBe(2); // one product, one observation
    const errors = await handle.db.select().from(providerErrors).where(eq(providerErrors.syncId, report.syncId));
    expect(errors.map((e) => e.stage).sort()).toEqual(['VALIDATION', 'VALIDATION', 'VALIDATION']);
  });

  it('marks a crashing provider FAILED without affecting others', async () => {
    const broken = await pipeline.runSync('test-broken', 'CATALOG');
    expect(broken.status).toBe('FAILED');
    expect(broken.errorSummary).toContain('upstream exploded');
    const ok = await pipeline.runSync('test-flaky', 'CATALOG');
    expect(ok.status).toBe('PARTIAL');
  });

  it('refuses unknown and unsupported providers', async () => {
    expect((await pipeline.runSync('does-not-exist', 'FULL')).status).toBe('FAILED');
  });

  it('is idempotent for repeated observations', async () => {
    const first = await pipeline.runSync('test-flaky', 'PRICES');
    const second = await pipeline.runSync('test-flaky', 'PRICES');
    expect(second.created).toBeLessThanOrEqual(first.created);
  });
});
