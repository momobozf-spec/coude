/**
 * Integratietest van `POST /api/v1/compare/internal/feeds/:chain` over echte
 * HTTP: Nest-app met de echte controller, `JobKeyGuard`, body-parsers,
 * validatie en foutfilter. Alleen de database (`compareFeed`) en de
 * synchronisatie zijn vervangen door fakes.
 */
import { gzipSync } from 'node:zlib';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureBodyParsers } from '../../common/body-parsers';
import { HttpExceptionFilter } from '../../common/http-exception.filter';
import { PrismaService } from '../../prisma/prisma.service';
import { SUPERMARKET_ADAPTERS, supermarketAdapters } from '../adapters/adapter-registry';
import { CompareConfig } from '../compare-config';
import { JobKeyGuard } from '../jobs/job-key.guard';
import { SyncService } from '../jobs/sync.service';
import { FeedPushController } from './feed-push.controller';
import { FeedPushService } from './feed-push.service';

const CURRENT_KEY = 'huidige-jobsleutel-Qm4tZ8vR2xK7pL9wN3';
const PREVIOUS_KEY = 'vorige-jobsleutel-Hs6yB1cT5eU0aJ8dF2';
const RETIRED_KEY = 'afgedankte-jobsleutel-Wg3nX7mP4qZ9rV1';

function feed(overrides: { slug?: string; kind?: string; products?: number; termsReviewed?: boolean; observedAt?: string } = {}) {
  const count = overrides.products ?? 1;
  const products = Array.from({ length: count }, (_, index) => ({
    externalId: `sku-${index}`,
    name: `Product ${index} met een wat langere naam om de feed groter te maken`,
    brand: 'Merk',
    packageQuantity: 1,
    packageUnit: 'KG',
  }));
  return {
    version: 1,
    chain: { slug: overrides.slug ?? 'delhaize', name: 'Delhaize' },
    source: { kind: overrides.kind ?? 'IMPORT_FILE', label: 'Testfeed', termsReviewed: overrides.termsReviewed ?? false },
    observedAt: overrides.observedAt ?? '2026-10-24T08:00:00+02:00',
    locations: [],
    products,
    offers: products.map((product) => ({ productExternalId: product.externalId, sourceReference: `${product.externalId}:regular`, priceCents: 199 })),
  };
}

describe('POST /api/v1/compare/internal/feeds/:chain', () => {
  let app: INestApplication;
  let baseUrl: string;
  const config = { jobKeys: [CURRENT_KEY, PREVIOUS_KEY] as string[], allowDemo: false, feedPushMaxBytes: 2 * 1024 * 1024 };
  const stored = new Map<string, { sha256: string; payload: unknown }>();
  const prisma = {
    compareFeed: {
      findUnique: vi.fn(async ({ where }: { where: { adapterKey: string } }) => stored.get(where.adapterKey) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { adapterKey: string }; create: { sha256: string; payload: unknown } }) => {
        stored.set(where.adapterKey, { sha256: create.sha256, payload: create.payload });
        return create;
      }),
      findMany: vi.fn(async () => [
        { adapterKey: 'delhaize', sha256: 'abc', sizeBytes: 10, observedAt: new Date('2026-10-24T06:00:00Z'), productCount: 1, offerCount: 1, termsReviewed: false, receivedAt: new Date('2026-10-24T07:00:00Z') },
      ]),
    },
  };
  const sync = { runSync: vi.fn(async () => ({ failedAdapters: [] as string[] })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
      controllers: [FeedPushController],
      providers: [
        FeedPushService,
        JobKeyGuard,
        { provide: CompareConfig, useValue: config },
        { provide: PrismaService, useValue: prisma },
        { provide: SyncService, useValue: sync },
        { provide: SUPERMARKET_ADAPTERS, useValue: supermarketAdapters },
      ],
    }).compile();

    const nest = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureBodyParsers(nest, { jobKeys: () => config.jobKeys, feedPushMaxBytes: config.feedPushMaxBytes });
    nest.setGlobalPrefix('api/v1');
    nest.useGlobalFilters(new HttpExceptionFilter());
    await nest.listen(0, '127.0.0.1');
    app = nest;
    const address = nest.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/compare/internal/feeds`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    config.jobKeys = [CURRENT_KEY, PREVIOUS_KEY];
    config.allowDemo = false;
    stored.clear();
    vi.clearAllMocks();
  });

  const post = (chain: string, body: unknown, headers: Record<string, string> = { 'x-job-key': CURRENT_KEY }, raw?: Uint8Array) =>
    fetch(`${baseUrl}/${chain}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: raw ? Buffer.from(raw) : JSON.stringify(body),
    });

  describe('authenticatie', () => {
    it('weigert zonder sleutel met 401', async () => {
      const response = await post('delhaize', feed(), {});
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe('JOB_KEY_INVALID');
      expect(prisma.compareFeed.upsert).not.toHaveBeenCalled();
    });

    it('weigert een foute sleutel met 401', async () => {
      const response = await post('delhaize', feed(), { 'x-job-key': 'fout-fout-fout-fout-fout-fout-fout-1' });
      expect(response.status).toBe(401);
      expect(prisma.compareFeed.upsert).not.toHaveBeenCalled();
    });

    it('aanvaardt tijdens een rotatie ook COMPARE_JOB_KEY_PREVIOUS', async () => {
      const response = await post('delhaize', feed(), { 'x-job-key': PREVIOUS_KEY });
      expect(response.status).toBe(202);
    });

    it('weigert een verlopen (uitgeroteerde) sleutel met 401', async () => {
      config.jobKeys = [CURRENT_KEY]; // rotatie klaar: _PREVIOUS is leeggemaakt
      const response = await post('delhaize', feed(), { 'x-job-key': PREVIOUS_KEY });
      expect(response.status).toBe(401);
      const retired = await post('delhaize', feed(), { 'x-job-key': RETIRED_KEY });
      expect(retired.status).toBe(401);
    });

    it('weigert browserverzoeken (Origin) met 403, ook met geldige sleutel', async () => {
      const response = await post('delhaize', feed(), { 'x-job-key': CURRENT_KEY, origin: 'https://evil.example' });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('INTERNAL_ONLY');
    });

    it('bestaat niet (404) zonder geconfigureerde jobsleutel', async () => {
      config.jobKeys = [];
      const response = await post('delhaize', feed());
      expect(response.status).toBe(404);
    });
  });

  describe('validatie en grenzen', () => {
    it('weigert een ongeldige feed met 400 en issues (feedFileSchema)', async () => {
      const invalid = { ...feed(), version: 2, offers: [{ productExternalId: 'sku-0', sourceReference: 'x', priceCents: -5 }] };
      const response = await post('delhaize', invalid);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.issues.map((issue: { path: string }) => issue.path)).toEqual(expect.arrayContaining(['version', 'offers.0.priceCents']));
      expect(prisma.compareFeed.upsert).not.toHaveBeenCalled();
    });

    it('weigert een feed van een andere keten (CHAIN_MISMATCH)', async () => {
      const response = await post('lidl', feed({ slug: 'delhaize' }));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('CHAIN_MISMATCH');
    });

    it('geeft 404 voor een onbekende adapter en 400 voor een ongeldige sleutelnaam', async () => {
      expect((await post('onbekend', feed({ slug: 'onbekend' }))).status).toBe(404);
      expect((await post('Delhaize_X', feed())).status).toBe(400);
    });

    it('weigert demogegevens waar demo uit staat (productie)', async () => {
      const response = await post('delhaize', feed({ kind: 'DEMO' }));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('DEMO_NOT_ALLOWED');
    });

    it('aanvaardt met geldige sleutel een feed boven de algemene grens van 64 kB', async () => {
      const big = feed({ products: 600 });
      expect(JSON.stringify(big).length).toBeGreaterThan(64 * 1024);
      const response = await post('delhaize', big);
      expect(response.status).toBe(202);
      expect((await response.json()).products).toBe(600);
    });

    it('leest zonder geldige sleutel nooit meer dan 64 kB (413 vóór de sleutelcontrole)', async () => {
      const response = await post('delhaize', feed({ products: 600 }), { 'x-job-key': 'fout-fout-fout-fout-fout-fout-fout-1' });
      expect(response.status).toBe(413);
    });

    it('weigert een feed boven COMPARE_FEED_PUSH_MAX_MB met 413', async () => {
      const response = await post('delhaize', feed({ products: 12_000 }));
      expect(response.status).toBe(413);
      expect((await response.json()).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('pakt gzip uit (Content-Encoding: gzip)', async () => {
      const raw = gzipSync(Buffer.from(JSON.stringify(feed({ products: 300 }))));
      const response = await post('delhaize', null, { 'x-job-key': CURRENT_KEY, 'content-encoding': 'gzip' }, raw);
      expect(response.status).toBe(202);
    });
  });

  describe('happy path', () => {
    it('bewaart de feed, start de sync van die keten en behoudt termsReviewed', async () => {
      const response = await post('delhaize', feed({ products: 3 }));
      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body).toMatchObject({ adapterKey: 'delhaize', stored: true, changed: true, products: 3, offers: 3, termsReviewed: false, sync: 'STARTED' });
      expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);

      expect(prisma.compareFeed.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.compareFeed.upsert.mock.calls[0]![0] as { create: { payload: { source: { termsReviewed: boolean } }; termsReviewed: boolean } };
      expect(call.create.termsReviewed).toBe(false);
      expect(call.create.payload.source.termsReviewed).toBe(false);
      expect(sync.runSync).toHaveBeenCalledWith(expect.objectContaining({ keys: ['delhaize'], trigger: 'feed-push' }));
    });

    it('herkent een identieke feed: niets opnieuw opslaan of synchroniseren', async () => {
      await post('delhaize', feed({ products: 2 }));
      vi.clearAllMocks();
      const response = await post('delhaize', feed({ products: 2 }));
      expect(response.status).toBe(202);
      expect(await response.json()).toMatchObject({ changed: false, sync: 'UNCHANGED' });
      expect(prisma.compareFeed.upsert).not.toHaveBeenCalled();
      expect(sync.runSync).not.toHaveBeenCalled();
    });

    it('lijst de opgeslagen feeds zonder inhoud', async () => {
      const response = await fetch(baseUrl, { headers: { 'x-job-key': CURRENT_KEY } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual([expect.objectContaining({ adapterKey: 'delhaize', offers: 1, termsReviewed: false })]);
      expect(body[0]).not.toHaveProperty('payload');
    });
  });
});
