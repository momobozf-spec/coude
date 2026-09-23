import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  currentPrices,
  importJobs,
  priceObservations,
  promotionConditions,
  promotionProducts,
  promotions,
  providerErrors,
  providerSyncs,
  retailerProducts,
  retailers,
  storeLocations,
  type Database,
} from '@superrette/database';
import type { DataOrigin, SyncKind, SyncStatus } from '@superrette/domain';
import { DEFAULT_MATCHING_POLICY, ProductMatchingEngine, type NormalizedProduct, type ProductNormalizer } from '@superrette/product-matching';
import {
  providerPriceSchema,
  providerProductSchema,
  providerPromotionSchema,
  type ProviderRegistry,
  type StoreProvider,
  type ValidProviderPrice,
  type ValidProviderProduct,
} from '@superrette/store-providers';
import {
  createCanonical,
  findCandidates,
  linkRetailerProduct,
  mappingMemory,
  recordMatch,
} from './catalog-writer.js';

export type IngestStage = 'FETCH' | 'VALIDATION' | 'NORMALIZATION' | 'MATCHING' | 'PERSIST' | 'ALERTS';

export interface PipelineLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const silentLogger: PipelineLogger = { info: () => {}, warn: () => {}, error: () => {} };

export interface PipelineHooks {
  /** Called after persistence with every variant whose price or promotion changed. */
  onVariantsChanged?(variantIds: string[], context: { syncId: string; providerKey: string }): Promise<void>;
}

export interface SyncReport {
  syncId: string;
  providerKey: string;
  kind: SyncKind;
  status: SyncStatus;
  read: number;
  created: number;
  updated: number;
  failed: number;
  changedVariantIds: string[];
  errorSummary: string | null;
}

interface Counters {
  read: number;
  created: number;
  updated: number;
  failed: number;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

class RecordError extends Error {
  constructor(
    readonly stage: IngestStage,
    message: string,
  ) {
    super(message);
  }
}

/**
 * IngestionPipeline:
 *   Provider → raw → validation → normalisation → canonical matching →
 *   promotion processing → PriceObservation → database → cache invalidation
 *   (hook) → PriceAlert evaluation (hook).
 *
 * Failure isolation: a bad record is logged as a ProviderError and skipped;
 * a failing provider marks only its own ProviderSync as FAILED.
 */
export class IngestionPipeline {
  private readonly matcher: ProductMatchingEngine;
  private retailerIds = new Map<string, string>();

  constructor(
    private readonly deps: {
      db: Database;
      registry: ProviderRegistry;
      normalizer: ProductNormalizer;
      logger?: PipelineLogger;
      hooks?: PipelineHooks;
      matcher?: ProductMatchingEngine;
    },
  ) {
    this.matcher = deps.matcher ?? new ProductMatchingEngine(DEFAULT_MATCHING_POLICY);
  }

  private get db(): Database {
    return this.deps.db;
  }

  private get log(): PipelineLogger {
    return this.deps.logger ?? silentLogger;
  }

  /** Create a QUEUED sync record (used when the API enqueues a job). */
  async createSync(providerKey: string, kind: SyncKind, triggeredBy: string): Promise<string> {
    const [row] = await this.db.insert(providerSyncs).values({ providerKey, kind, triggeredBy, status: 'QUEUED' }).returning({ id: providerSyncs.id });
    return row!.id;
  }

  async runSync(
    providerKey: string,
    kind: SyncKind,
    options: { triggeredBy?: string; syncId?: string; since?: Date; jobId?: string } = {},
  ): Promise<SyncReport> {
    const syncId = options.syncId ?? (await this.createSync(providerKey, kind, options.triggeredBy ?? 'manual'));
    const counters: Counters = { read: 0, created: 0, updated: 0, failed: 0 };
    const changed = new Set<string>();
    await this.db.update(providerSyncs).set({ status: 'RUNNING', startedAt: new Date() }).where(eq(providerSyncs.id, syncId));
    if (options.jobId) {
      await this.db.insert(importJobs).values({ syncId, queue: 'provider-sync', jobName: kind, externalJobId: options.jobId, status: 'RUNNING', attempts: 1, payload: { providerKey, kind } });
    }

    let fatal: string | null = null;
    const provider = this.deps.registry.get(providerKey);
    try {
      if (!provider) throw new Error(`Unknown provider "${providerKey}"`);
      if (provider.info.supportStatus === 'UNSUPPORTED') {
        throw new Error(`Provider "${providerKey}" is UNSUPPORTED: ${provider.info.reason ?? ''}`);
      }
      await this.loadRetailers();
      // A FULL sync runs the stages the provider declares; an explicit kind must be supported.
      const can = (c: 'listCatalog' | 'getPrices' | 'getPromotions'): boolean => kind !== 'FULL' || provider.info.capabilities.includes(c);
      if ((kind === 'CATALOG' || kind === 'FULL') && can('listCatalog')) await this.syncCatalog(provider, syncId, counters);
      if ((kind === 'PRICES' || kind === 'FULL') && can('getPrices')) await this.syncPrices(provider, syncId, counters, changed, options.since);
      if ((kind === 'PROMOTIONS' || kind === 'FULL') && can('getPromotions')) await this.syncPromotions(provider, syncId, counters, changed);
    } catch (error) {
      fatal = error instanceof Error ? error.message : String(error);
      this.log.error('provider sync failed', { providerKey, syncId, error: fatal });
      await this.recordError(syncId, providerKey, 'FETCH', null, fatal, null);
    }

    const written = counters.created + counters.updated;
    const status: SyncStatus = fatal
      ? written > 0
        ? 'PARTIAL'
        : 'FAILED'
      : counters.failed > 0
        ? written > 0
          ? 'PARTIAL'
          : 'FAILED'
        : 'SUCCESS';
    const errorSummary = fatal ?? (counters.failed > 0 ? `${counters.failed} record(s) failed; see provider errors` : null);

    await this.db
      .update(providerSyncs)
      .set({
        status,
        finishedAt: new Date(),
        readCount: counters.read,
        createdCount: counters.created,
        updatedCount: counters.updated,
        failedCount: counters.failed,
        errorSummary,
      })
      .where(eq(providerSyncs.id, syncId));
    if (options.jobId) {
      await this.db
        .update(importJobs)
        .set({ status, finishedAt: new Date(), error: errorSummary })
        .where(and(eq(importJobs.syncId, syncId), eq(importJobs.externalJobId, options.jobId)));
    }

    const changedVariantIds = [...changed];
    if (changedVariantIds.length > 0 && this.deps.hooks?.onVariantsChanged) {
      try {
        await this.deps.hooks.onVariantsChanged(changedVariantIds, { syncId, providerKey });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.recordError(syncId, providerKey, 'ALERTS', null, message, null);
      }
    }
    this.log.info('provider sync finished', { providerKey, syncId, status, ...counters });
    return { syncId, providerKey, kind, status, ...counters, changedVariantIds, errorSummary };
  }

  private async loadRetailers(): Promise<void> {
    const rows = await this.db.select({ id: retailers.id, slug: retailers.slug }).from(retailers);
    this.retailerIds = new Map(rows.map((r) => [r.slug, r.id]));
  }

  private retailerId(slug: string): string {
    const id = this.retailerIds.get(slug);
    if (!id) throw new RecordError('VALIDATION', `Unknown retailer slug "${slug}"`);
    return id;
  }

  private async recordError(syncId: string, providerKey: string, stage: IngestStage, externalId: string | null, message: string, raw: unknown): Promise<void> {
    await this.db.insert(providerErrors).values({
      syncId,
      providerKey,
      stage,
      externalId,
      message: message.slice(0, 2000),
      raw: raw === undefined ? null : JSON.parse(JSON.stringify(raw ?? null)),
    });
  }

  private async guard(syncId: string, provider: StoreProvider, externalId: string | null, raw: unknown, counters: Counters, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      counters.failed++;
      const stage = error instanceof RecordError ? error.stage : 'PERSIST';
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn('record failed', { provider: provider.info.key, externalId, stage, message });
      await this.recordError(syncId, provider.info.key, stage, externalId, message, raw);
    }
  }

  // ── Catalog ────────────────────────────────────────────────────────────

  private async syncCatalog(provider: StoreProvider, syncId: string, counters: Counters): Promise<void> {
    for await (const raw of provider.listCatalog()) {
      counters.read++;
      const parsed = providerProductSchema.safeParse(raw);
      const externalId = typeof raw?.externalId === 'string' ? raw.externalId : null;
      await this.guard(syncId, provider, externalId, raw, counters, async () => {
        if (!parsed.success) throw new RecordError('VALIDATION', parsed.error.message);
        const outcome = await this.upsertRetailerProduct(parsed.data, provider.info.key, provider.info.dataOrigin);
        if (outcome.created) counters.created++;
        else counters.updated++;
      });
    }
  }

  /** Upsert a retailer product, normalise it and (re)match it to a canonical variant. */
  async upsertRetailerProduct(
    product: ValidProviderProduct,
    providerKey: string,
    dataOrigin: DataOrigin,
  ): Promise<{ retailerProductId: string; variantId: string | null; created: boolean }> {
    const retailerId = this.retailerIds.size > 0 ? this.retailerId(product.retailerSlug) : (await this.loadRetailers(), this.retailerId(product.retailerSlug));
    let normalized;
    try {
      normalized = this.deps.normalizer.normalize({
        title: product.title,
        brand: product.brand ?? null,
        quantityText: product.quantityText ?? null,
        gtins: product.gtins,
        categoryText: product.categoryText ?? null,
      });
    } catch (error) {
      throw new RecordError('NORMALIZATION', error instanceof Error ? error.message : String(error));
    }

    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [existing] = await tx
        .select({ id: retailerProducts.id, variantId: retailerProducts.variantId, title: retailerProducts.title })
        .from(retailerProducts)
        .where(and(eq(retailerProducts.retailerId, retailerId), eq(retailerProducts.retailerSku, product.externalId)));

      const values = {
        title: product.title,
        brandText: product.brand ?? null,
        quantityText: product.quantityText ?? null,
        categoryText: product.categoryText ?? null,
        gtins: normalized.gtins,
        imageUrl: product.imageUrl ?? null,
        productUrl: product.productUrl ?? null,
        isAvailable: product.isAvailable,
        normalized: normalized as unknown as Record<string, unknown>,
        dataOrigin,
        sourceProvider: providerKey,
        lastSeenAt: now,
        updatedAt: now,
      };

      let retailerProductId: string;
      if (existing) {
        await tx.update(retailerProducts).set(values).where(eq(retailerProducts.id, existing.id));
        retailerProductId = existing.id;
        // Already linked and unchanged: keep the link (confirmed links persist forever).
        if (existing.variantId && existing.title === product.title) {
          return { retailerProductId, variantId: existing.variantId, created: false };
        }
      } else {
        const [row] = await tx
          .insert(retailerProducts)
          .values({ retailerId, retailerSku: product.externalId, firstSeenAt: now, ...values })
          .returning({ id: retailerProducts.id });
        retailerProductId = row!.id;
      }

      const variantId = await this.matchAndLink(tx, {
        retailerProductId,
        normalized,
        title: product.title,
        imageUrl: product.imageUrl ?? null,
        dataOrigin,
        providerKey,
      });
      return { retailerProductId, variantId, created: !existing };
    });
  }

  /**
   * Match a normalised retailer product against canonical variants and link
   * it according to the matching policy (EXACT/HIGH auto, MEDIUM/LOW review,
   * UNMATCHED creates a canonical product). Human decisions always win.
   */
  async matchAndLink(
    tx: Tx,
    input: { retailerProductId: string; normalized: NormalizedProduct; title: string; imageUrl: string | null; dataOrigin: DataOrigin; providerKey: string },
  ): Promise<string | null> {
    const { retailerProductId, normalized } = input;
    const memory = await mappingMemory(tx, retailerProductId);
    const candidates = await findCandidates(tx, normalized);
    const result = this.matcher.match(normalized, candidates, memory);

    let variantId: string | null = null;
    if (result.status === 'CREATE_CANONICAL') {
      variantId = await createCanonical(tx, {
        title: input.title,
        normalized,
        quantitySource: normalized.quantitySource,
        dataOrigin: input.dataOrigin,
        sourceProvider: input.providerKey,
        imageUrl: input.imageUrl,
      });
      await recordMatch(tx, {
        retailerProductId,
        variantId,
        confidence: 'EXACT',
        method: 'ATTRIBUTES',
        score: 1,
        status: 'AUTO_ACCEPTED',
        reasons: ['canonical:created-from-retailer-product'],
        alternatives: [],
      });
    } else if (result.productId && result.method) {
      await recordMatch(tx, {
        retailerProductId,
        variantId: result.productId,
        confidence: result.confidence,
        method: result.method,
        score: result.score,
        status: result.status,
        reasons: result.reasons,
        alternatives: result.alternatives.map((a) => ({ variantId: a.productId, score: a.score, confidence: a.confidence })),
      });
      // Only EXACT/HIGH (auto-accepted) and human-confirmed matches link prices to a canonical product.
      if (result.status === 'AUTO_ACCEPTED' || result.status === 'CONFIRMED') variantId = result.productId;
    }
    await linkRetailerProduct(tx, retailerProductId, variantId);
    return variantId;
  }

  /** Re-run matching for a stored retailer product (e.g. after an admin rejected a proposal). */
  async rematch(retailerProductId: string): Promise<string | null> {
    const [rp] = await this.db
      .select({
        id: retailerProducts.id,
        title: retailerProducts.title,
        normalized: retailerProducts.normalized,
        imageUrl: retailerProducts.imageUrl,
        dataOrigin: retailerProducts.dataOrigin,
        sourceProvider: retailerProducts.sourceProvider,
      })
      .from(retailerProducts)
      .where(eq(retailerProducts.id, retailerProductId));
    if (!rp || !rp.normalized) throw new Error(`Retailer product ${retailerProductId} not found`);
    return this.db.transaction((tx) =>
      this.matchAndLink(tx, {
        retailerProductId: rp.id,
        normalized: rp.normalized as unknown as NormalizedProduct,
        title: rp.title,
        imageUrl: rp.imageUrl,
        dataOrigin: rp.dataOrigin,
        providerKey: rp.sourceProvider,
      }),
    );
  }

  // ── Prices ─────────────────────────────────────────────────────────────

  private async syncPrices(provider: StoreProvider, syncId: string, counters: Counters, changed: Set<string>, since?: Date): Promise<void> {
    const request = await this.priceRequestFor(provider, since);
    for await (const raw of provider.getPrices(request)) {
      counters.read++;
      const parsed = providerPriceSchema.safeParse(raw);
      await this.guard(syncId, provider, typeof raw?.externalId === 'string' ? raw.externalId : null, raw, counters, async () => {
        if (!parsed.success) throw new RecordError('VALIDATION', parsed.error.message);
        const inserted = await this.recordPrice(parsed.data, provider, syncId, changed);
        if (inserted) counters.created++;
        else counters.updated++;
      });
    }
  }

  /** Barcode-keyed sources (Open Prices) are asked about the GTINs we know. */
  private async priceRequestFor(provider: StoreProvider, since?: Date): Promise<{ gtins?: string[]; since?: Date }> {
    if (provider.info.dataOrigin !== 'CROWDSOURCED') return since ? { since } : {};
    const rows = await this.db.execute<{ gtin: string }>(sql`SELECT gtin FROM catalog.product_barcodes`);
    return { gtins: rows.rows.map((r) => r.gtin), ...(since ? { since } : {}) };
  }

  /** Persist one observation. Returns true when a new observation was stored. */
  async recordPrice(price: ValidProviderPrice, provider: StoreProvider, syncId: string | null, changed: Set<string>): Promise<boolean> {
    if (this.retailerIds.size === 0) await this.loadRetailers();
    const retailerId = this.retailerId(price.retailerSlug);
    let rp = await this.findRetailerProduct(retailerId, price.externalId);
    if (!rp && price.product) {
      const created = await this.upsertRetailerProduct(price.product, provider.info.key, provider.info.dataOrigin);
      rp = { id: created.retailerProductId, variantId: created.variantId };
    }
    if (!rp) throw new RecordError('MATCHING', `No retailer product "${price.externalId}" for ${price.retailerSlug}`);

    let storeLocationId: string | null = null;
    if (price.storeOsmId) {
      const [loc] = await this.db.select({ id: storeLocations.id }).from(storeLocations).where(eq(storeLocations.osmId, price.storeOsmId));
      storeLocationId = loc?.id ?? null;
    }

    const inserted = await this.db
      .insert(priceObservations)
      .values({
        retailerProductId: rp.id,
        observedAt: price.observedAt,
        regularPriceCents: price.regularPriceCents,
        promoPriceCents: price.promoPriceCents ?? null,
        currency: price.currency,
        labelledUnitPriceCents: price.labelledUnitPriceCents ?? null,
        storeLocationId,
        dataOrigin: provider.info.dataOrigin,
        sourceProvider: provider.info.key,
        syncId,
      })
      .onConflictDoNothing()
      .returning({ id: priceObservations.id });

    // Maintain the current-price read model: only newer observations replace it.
    const updated = await this.db
      .insert(currentPrices)
      .values({
        retailerProductId: rp.id,
        regularPriceCents: price.regularPriceCents,
        promoPriceCents: price.promoPriceCents ?? null,
        currency: price.currency,
        observedAt: price.observedAt,
        dataOrigin: provider.info.dataOrigin,
        sourceProvider: provider.info.key,
      })
      .onConflictDoUpdate({
        target: currentPrices.retailerProductId,
        set: {
          regularPriceCents: sql`excluded.regular_price_cents`,
          promoPriceCents: sql`excluded.promo_price_cents`,
          observedAt: sql`excluded.observed_at`,
          dataOrigin: sql`excluded.data_origin`,
          sourceProvider: sql`excluded.source_provider`,
        },
        setWhere: sql`${currentPrices.observedAt} <= excluded.observed_at`,
      })
      .returning({ id: currentPrices.retailerProductId });

    if (updated.length > 0 && rp.variantId) changed.add(rp.variantId);
    return inserted.length > 0;
  }

  private async findRetailerProduct(retailerId: string, sku: string): Promise<{ id: string; variantId: string | null } | undefined> {
    const [row] = await this.db
      .select({ id: retailerProducts.id, variantId: retailerProducts.variantId })
      .from(retailerProducts)
      .where(and(eq(retailerProducts.retailerId, retailerId), eq(retailerProducts.retailerSku, sku)));
    return row;
  }

  // ── Promotions ─────────────────────────────────────────────────────────

  private async syncPromotions(provider: StoreProvider, syncId: string, counters: Counters, changed: Set<string>): Promise<void> {
    for await (const raw of provider.getPromotions()) {
      counters.read++;
      const parsed = providerPromotionSchema.safeParse(raw);
      await this.guard(syncId, provider, typeof raw?.externalId === 'string' ? raw.externalId : null, raw, counters, async () => {
        if (!parsed.success) throw new RecordError('VALIDATION', parsed.error.message);
        const promo = parsed.data;
        const retailerId = this.retailerId(promo.retailerSlug);
        const rps = await this.db
          .select({ id: retailerProducts.id, sku: retailerProducts.retailerSku, variantId: retailerProducts.variantId })
          .from(retailerProducts)
          .where(and(eq(retailerProducts.retailerId, retailerId), inArray(retailerProducts.retailerSku, promo.productExternalIds)));
        if (rps.length === 0) throw new RecordError('MATCHING', `Promotion ${promo.externalId} references no known products`);

        const created = await this.db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ id: promotions.id })
            .from(promotions)
            .where(and(eq(promotions.retailerId, retailerId), eq(promotions.externalId, promo.externalId)));
          const values = {
            mechanic: promo.params.mechanic,
            params: promo.params,
            label: promo.label,
            description: promo.description ?? null,
            startsAt: promo.startsAt ?? null,
            endsAt: promo.endsAt ?? null,
            dataOrigin: provider.info.dataOrigin,
            sourceProvider: provider.info.key,
            updatedAt: new Date(),
          };
          let promotionId: string;
          if (existing) {
            await tx.update(promotions).set(values).where(eq(promotions.id, existing.id));
            promotionId = existing.id;
          } else {
            const [row] = await tx.insert(promotions).values({ retailerId, externalId: promo.externalId, ...values }).returning({ id: promotions.id });
            promotionId = row!.id;
          }
          const c = promo.conditions;
          const conditionValues = {
            loyaltyCardRequired: c.loyaltyCardRequired,
            loyaltyProgram: c.loyaltyProgram ?? null,
            minQuantity: c.minQuantity ?? null,
            maxQuantityPerCustomer: c.maxQuantityPerCustomer ?? null,
            onlineOnly: c.onlineOnly,
            regionCodes: c.regionCodes,
          };
          await tx
            .insert(promotionConditions)
            .values({ promotionId, ...conditionValues })
            .onConflictDoUpdate({ target: promotionConditions.promotionId, set: conditionValues });
          await tx.delete(promotionProducts).where(eq(promotionProducts.promotionId, promotionId));
          await tx.insert(promotionProducts).values(rps.map((rp) => ({ promotionId, retailerProductId: rp.id })));
          return !existing;
        });
        for (const rp of rps) if (rp.variantId) changed.add(rp.variantId);
        const missing = promo.productExternalIds.filter((sku) => !rps.some((r) => r.sku === sku));
        if (missing.length > 0) {
          await this.recordError(syncId, provider.info.key, 'MATCHING', promo.externalId, `Unknown products in promotion: ${missing.join(', ')}`, null);
        }
        if (created) counters.created++;
        else counters.updated++;
      });
    }
  }
}
