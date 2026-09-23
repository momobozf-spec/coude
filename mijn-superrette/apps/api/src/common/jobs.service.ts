import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { retailerProducts, retailers, type Database } from '@superrette/database';
import type { SyncKind } from '@superrette/domain';
import {
  EquivalenceIndexer,
  evaluatePriceAlerts,
  IngestionPipeline,
  QUEUES,
  type AlertEvaluationReport,
  type PriceAlertsJob,
  type ProviderSyncJob,
  type PushSender,
  type SyncReport,
} from '@superrette/ingestion';
import { DevelopmentSeedProvider, type ProviderRegistry } from '@superrette/store-providers';
import type { AppConfig } from '../config/config.js';
import { CacheService } from './cache.service.js';
import { NormalizerService } from './core.services.js';
import { CACHE, CONFIG, DB, PROVIDERS, PUSH } from './tokens.js';

/**
 * Background work. With Redis (JOBS_MODE=queue) jobs go to BullMQ and the
 * worker app processes them; without Redis (local dev/tests) they run
 * in-process so a developer can run the whole product with only PostgreSQL.
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private syncQueue: Queue<ProviderSyncJob> | null = null;
  private alertsQueue: Queue<PriceAlertsJob> | null = null;
  private readonly running = new Set<Promise<unknown>>();

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(PROVIDERS) private readonly registry: ProviderRegistry,
    @Inject(CACHE) private readonly cache: CacheService,
    @Inject(PUSH) private readonly push: PushSender,
    private readonly normalizers: NormalizerService,
  ) {
    if (config.jobsMode === 'queue' && config.redisUrl) {
      const connection = { url: config.redisUrl };
      this.syncQueue = new Queue(QUEUES.providerSync, { connection });
      this.alertsQueue = new Queue(QUEUES.priceAlerts, { connection });
    }
  }

  get registryInfo(): ProviderRegistry {
    return this.registry;
  }

  async pipeline(registry: ProviderRegistry = this.registry): Promise<IngestionPipeline> {
    return new IngestionPipeline({
      db: this.db,
      registry,
      normalizer: await this.normalizers.get(),
      logger: {
        info: (m, meta) => this.logger.log(`${m} ${meta ? JSON.stringify(meta) : ''}`),
        warn: (m, meta) => this.logger.warn(`${m} ${meta ? JSON.stringify(meta) : ''}`),
        error: (m, meta) => this.logger.error(`${m} ${meta ? JSON.stringify(meta) : ''}`),
      },
      hooks: { onVariantsChanged: (ids) => this.variantsChanged(ids, 'ingestion').then(() => undefined) },
    });
  }

  /** Cache invalidation + price alert evaluation for changed variants. */
  async variantsChanged(variantIds: string[], reason: string): Promise<AlertEvaluationReport | null> {
    await this.cache.invalidateCatalog();
    if (this.alertsQueue) {
      await this.alertsQueue.add('evaluate', { variantIds, reason }, { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
      return null;
    }
    return evaluatePriceAlerts(this.db, variantIds, { origins: this.config.dataOrigins, push: this.push });
  }

  /** Queue (or run in-process) a provider sync. Returns the ProviderSync id immediately. */
  async enqueueSync(providerKey: string, kind: SyncKind, triggeredBy: string): Promise<string> {
    const pipeline = await this.pipeline();
    const syncId = await pipeline.createSync(providerKey, kind, triggeredBy);
    if (this.syncQueue) {
      await this.syncQueue.add(`${providerKey}:${kind}`, { syncId, providerKey, kind, triggeredBy }, { jobId: syncId, attempts: 2, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 500, removeOnFail: 1000 });
    } else {
      const task = this.runSync(providerKey, kind, triggeredBy, syncId).catch((error: unknown) => this.logger.error(String(error)));
      this.running.add(task);
      void task.finally(() => this.running.delete(task));
    }
    return syncId;
  }

  async runSync(providerKey: string, kind: SyncKind, triggeredBy: string, syncId?: string): Promise<SyncReport> {
    const pipeline = await this.pipeline();
    const report = await pipeline.runSync(providerKey, kind, { triggeredBy, ...(syncId ? { syncId } : {}) });
    if (kind === 'CATALOG' || kind === 'FULL') {
      await new EquivalenceIndexer(this.db).refresh();
      await this.cache.invalidateCatalog();
    }
    return report;
  }

  /** Wait for in-process jobs (tests, graceful shutdown). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.running]);
  }

  /**
   * Development tooling (vertical slice 3): import one observation for an
   * existing retailer product through the real pipeline, tagged
   * DEVELOPMENT_SEED. Disabled in production.
   */
  async importDevelopmentObservation(input: { retailerProductId: string; regularPriceCents: number; promoPriceCents: number | null; observedAt?: Date }): Promise<{ stored: boolean; changedVariantIds: string[]; alerts: AlertEvaluationReport | null }> {
    if (this.config.isProduction || !this.config.allowDevelopmentData) throw new Error('Development observations are disabled in this environment');
    const [rp] = await this.db
      .select({ sku: retailerProducts.retailerSku, slug: retailers.slug })
      .from(retailerProducts)
      .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
      .where(and(eq(retailerProducts.id, input.retailerProductId)));
    if (!rp) throw new Error('Unknown retailer product');
    const provider = new DevelopmentSeedProvider({ environment: this.config.env });
    const pipeline = await this.pipeline();
    const changed = new Set<string>();
    const stored = await pipeline.recordPrice(
      {
        externalId: rp.sku,
        retailerSlug: rp.slug,
        observedAt: input.observedAt ?? new Date(),
        regularPriceCents: input.regularPriceCents,
        promoPriceCents: input.promoPriceCents,
        currency: 'EUR',
      },
      provider,
      null,
      changed,
    );
    const changedVariantIds = [...changed];
    const alerts = changedVariantIds.length > 0 ? await this.variantsChanged(changedVariantIds, 'dev-observation') : null;
    return { stored, changedVariantIds, alerts };
  }

  async onModuleDestroy(): Promise<void> {
    await this.drain();
    await this.syncQueue?.close();
    await this.alertsQueue?.close();
  }
}
