import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  currentPrices,
  priceObservations,
  productBarcodes,
  productEquivalences,
  productMatches,
  productVariants,
  products,
  promotions,
  providerErrors,
  providerSyncs,
  retailerProducts,
  retailers,
  users,
  type Database,
} from '@superrette/database';
import type { SyncKind } from '@superrette/domain';
import { attachBarcodes, linkRetailerProduct, recordMatch } from '@superrette/ingestion';
import type { ProviderRegistry } from '@superrette/store-providers';
import {
  adminListQuerySchema,
  equivalenceDecisionSchema,
  matchDecisionSchema,
  triggerSyncSchema,
  type AdminEquivalenceDto,
  type AdminMatchDto,
  type AdminProviderDto,
  type AdminProviderErrorDto,
  type AdminStatsDto,
  type AdminSyncDto,
  type MatchDecision,
  type Paginated,
} from '@superrette/validation';
import type { AppConfig } from '../config/config.js';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { CacheService } from '../common/cache.service.js';
import { NormalizerService } from '../common/core.services.js';
import { notFound } from '../common/errors.js';
import { JobsService } from '../common/jobs.service.js';
import { CACHE, CONFIG, DB, PROVIDERS } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

type AdminListQuery = z.infer<typeof adminListQuerySchema>;
type SyncRow = typeof providerSyncs.$inferSelect;

const syncDto = (s: SyncRow): AdminSyncDto => ({
  id: s.id,
  providerKey: s.providerKey,
  kind: s.kind,
  status: s.status,
  startedAt: s.startedAt?.toISOString() ?? null,
  finishedAt: s.finishedAt?.toISOString() ?? null,
  readCount: s.readCount,
  createdCount: s.createdCount,
  updatedCount: s.updatedCount,
  failedCount: s.failedCount,
  errorSummary: s.errorSummary,
});

const devObservationSchema = z.object({
  retailerProductId: z.uuid(),
  regularPriceCents: z.number().int().positive(),
  promoPriceCents: z.number().int().positive().nullable().default(null),
});

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PROVIDERS) private readonly registry: ProviderRegistry,
    @Inject(CACHE) private readonly cache: CacheService,
    private readonly jobs: JobsService,
    private readonly normalizers: NormalizerService,
  ) {}

  async stats(): Promise<AdminStatsDto> {
    const now = new Date();
    const one = async (q: Promise<{ value: number }[]>): Promise<number> => (await q)[0]?.value ?? 0;
    const [r, p, v, rp, obs, promo, pending, eqs, errs, u] = await Promise.all([
      one(this.db.select({ value: count() }).from(retailers)),
      one(this.db.select({ value: count() }).from(products)),
      one(this.db.select({ value: count() }).from(productVariants)),
      one(this.db.select({ value: count() }).from(retailerProducts)),
      one(this.db.select({ value: count() }).from(priceObservations)),
      one(
        this.db
          .select({ value: count() })
          .from(promotions)
          .where(
            and(
              or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
              or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
            ),
          ),
      ),
      one(this.db.select({ value: count() }).from(productMatches).where(eq(productMatches.status, 'PENDING_REVIEW'))),
      one(
        this.db.select({ value: count() }).from(productEquivalences).where(eq(productEquivalences.status, 'SUGGESTED')),
      ),
      one(this.db.select({ value: count() }).from(providerErrors).where(isNull(providerErrors.resolvedAt))),
      one(this.db.select({ value: count() }).from(users)),
    ]);
    return {
      retailers: r,
      products: p,
      variants: v,
      retailerProducts: rp,
      priceObservations: obs,
      activePromotions: promo,
      pendingMatches: pending,
      suggestedEquivalences: eqs,
      openErrors: errs,
      users: u,
    };
  }

  // ── Product match review ───────────────────────────────────────────────

  async matches(q: AdminListQuery): Promise<Paginated<AdminMatchDto>> {
    const status = (q.status ?? 'PENDING_REVIEW') as 'PENDING_REVIEW' | 'AUTO_ACCEPTED' | 'CONFIRMED' | 'REJECTED';
    const where = and(eq(productMatches.status, status), q.q ? ilike(retailerProducts.title, `%${q.q}%`) : undefined);
    const rows = await this.db
      .select({
        m: productMatches,
        rp: retailerProducts,
        retailerName: retailers.name,
        variantName: productVariants.displayName,
      })
      .from(productMatches)
      .innerJoin(retailerProducts, eq(retailerProducts.id, productMatches.retailerProductId))
      .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
      .innerJoin(productVariants, eq(productVariants.id, productMatches.variantId))
      .where(where)
      .orderBy(desc(productMatches.score))
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(productMatches)
      .innerJoin(retailerProducts, eq(retailerProducts.id, productMatches.retailerProductId))
      .where(where);
    const variantIds = [...new Set(rows.flatMap((r) => [r.m.variantId, ...r.m.alternatives.map((a) => a.variantId)]))];
    const names = variantIds.length
      ? await this.db
          .select({ id: productVariants.id, name: productVariants.displayName })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : [];
    const gtins = variantIds.length
      ? await this.db.select().from(productBarcodes).where(inArray(productBarcodes.variantId, variantIds))
      : [];
    const nameOf = new Map(names.map((n) => [n.id, n.name]));
    return {
      total,
      items: rows.map(({ m, rp, retailerName, variantName }) => ({
        id: m.id,
        retailerProduct: { id: rp.id, title: rp.title, retailerName, gtins: rp.gtins, quantityText: rp.quantityText },
        proposed: {
          variantId: m.variantId,
          name: variantName,
          gtins: gtins.filter((g) => g.variantId === m.variantId).map((g) => g.gtin),
        },
        confidence: m.confidence,
        score: m.score,
        status: m.status,
        reasons: m.reasons,
        alternatives: m.alternatives.map((a) => ({ ...a, name: nameOf.get(a.variantId) ?? '?' })),
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Human decisions persist: CONFIRMED/REJECTED rows are honoured by every
   * future import (the pipeline reads them as mapping memory).
   */
  async decideMatch(matchId: string, decision: MatchDecision, admin: AuthUser): Promise<AdminMatchDto | null> {
    const [match] = await this.db.select().from(productMatches).where(eq(productMatches.id, matchId));
    if (!match) throw notFound('Match');
    const now = new Date();
    const pipeline = await this.jobs.pipeline();
    await this.db.transaction(async (tx) => {
      if (decision.decision === 'approve') {
        await tx
          .update(productMatches)
          .set({ status: 'CONFIRMED', reviewedBy: admin.id, reviewedAt: now, updatedAt: now })
          .where(eq(productMatches.id, matchId));
        // Other open proposals for the same retailer product are superseded.
        await tx
          .update(productMatches)
          .set({ status: 'REJECTED', reviewedBy: admin.id, reviewedAt: now })
          .where(
            and(
              eq(productMatches.retailerProductId, match.retailerProductId),
              ne(productMatches.id, matchId),
              eq(productMatches.status, 'PENDING_REVIEW'),
            ),
          );
        await linkRetailerProduct(tx, match.retailerProductId, match.variantId);
        const [rp] = await tx
          .select({ gtins: retailerProducts.gtins })
          .from(retailerProducts)
          .where(eq(retailerProducts.id, match.retailerProductId));
        await attachBarcodes(tx, match.variantId, rp?.gtins ?? [], 'admin-review');
      } else if (decision.decision === 'reassign') {
        const [target] = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.id, decision.variantId));
        if (!target) throw notFound('Product');
        if (decision.variantId !== match.variantId) {
          await tx
            .update(productMatches)
            .set({ status: 'REJECTED', reviewedBy: admin.id, reviewedAt: now })
            .where(eq(productMatches.id, matchId));
        }
        await recordMatch(tx, {
          retailerProductId: match.retailerProductId,
          variantId: decision.variantId,
          confidence: 'EXACT',
          method: 'MANUAL',
          score: 1,
          status: 'CONFIRMED',
          reasons: ['admin:reassigned'],
          alternatives: [],
        });
        await tx
          .update(productMatches)
          .set({ status: 'CONFIRMED', reviewedBy: admin.id, reviewedAt: now })
          .where(
            and(
              eq(productMatches.retailerProductId, match.retailerProductId),
              eq(productMatches.variantId, decision.variantId),
            ),
          );
        await linkRetailerProduct(tx, match.retailerProductId, decision.variantId);
      } else {
        await tx
          .update(productMatches)
          .set({ status: 'REJECTED', reviewedBy: admin.id, reviewedAt: now, updatedAt: now })
          .where(eq(productMatches.id, matchId));
        const [rp] = await tx
          .select({ variantId: retailerProducts.variantId })
          .from(retailerProducts)
          .where(eq(retailerProducts.id, match.retailerProductId));
        if (rp?.variantId === match.variantId) await linkRetailerProduct(tx, match.retailerProductId, null);
      }
    });
    // After a rejection, look for the next-best match (or create a canonical product).
    if (decision.decision === 'reject') await pipeline.rematch(match.retailerProductId);
    await this.cache.invalidateCatalog();
    this.normalizers.invalidate();
    const [updated] = (await this.matches({ status: undefined, limit: 200, offset: 0 })).items.filter(
      (m) => m.id === matchId,
    );
    return updated ?? null;
  }

  // ── Equivalences ───────────────────────────────────────────────────────

  async equivalences(q: AdminListQuery): Promise<Paginated<AdminEquivalenceDto>> {
    const status = (q.status ?? 'SUGGESTED') as 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
    const rows = await this.db.execute<{
      id: string;
      source_id: string;
      source_name: string;
      target_id: string;
      target_name: string;
      confidence: string;
      status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
      reasons: string[];
    }>(sql`
      SELECT e.id, s.id AS source_id, s.display_name AS source_name, t.id AS target_id, t.display_name AS target_name, e.confidence, e.status, e.reasons
      FROM catalog.product_equivalences e
      JOIN catalog.product_variants s ON s.id = e.source_variant_id
      JOIN catalog.product_variants t ON t.id = e.target_variant_id
      WHERE e.status = ${status} ${q.q ? sql`AND (s.display_name ILIKE ${`%${q.q}%`} OR t.display_name ILIKE ${`%${q.q}%`})` : sql``}
      ORDER BY e.confidence DESC, s.display_name
      LIMIT ${q.limit} OFFSET ${q.offset}
    `);
    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(productEquivalences)
      .where(eq(productEquivalences.status, status));
    return {
      total,
      items: rows.rows.map((r) => ({
        id: r.id,
        source: { variantId: r.source_id, name: r.source_name },
        target: { variantId: r.target_id, name: r.target_name },
        confidence: Number(r.confidence),
        status: r.status,
        reasons: r.reasons,
      })),
    };
  }

  async decideEquivalence(id: string, decision: 'confirm' | 'reject', admin: AuthUser): Promise<void> {
    const status = decision === 'confirm' ? 'CONFIRMED' : 'REJECTED';
    const [row] = await this.db
      .update(productEquivalences)
      .set({ status, reviewedBy: admin.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(productEquivalences.id, id))
      .returning();
    if (!row) throw notFound('Equivalence');
    // Apply the same decision to the reverse pair so both directions agree.
    await this.db
      .update(productEquivalences)
      .set({ status, reviewedBy: admin.id, reviewedAt: new Date() })
      .where(
        and(
          eq(productEquivalences.sourceVariantId, row.targetVariantId),
          eq(productEquivalences.targetVariantId, row.sourceVariantId),
        ),
      );
    await this.cache.invalidateCatalog();
  }

  // ── Providers, syncs, errors ───────────────────────────────────────────

  async providers(): Promise<AdminProviderDto[]> {
    const syncs = await this.db.execute<SyncRow & Record<string, unknown>>(sql`
      SELECT DISTINCT ON (provider_key) * FROM ingest.provider_syncs ORDER BY provider_key, created_at DESC
    `);
    const last = new Map<string, AdminSyncDto>();
    for (const s of syncs.rows) {
      last.set(String(s.provider_key), {
        id: String(s.id),
        providerKey: String(s.provider_key),
        kind: String(s.kind),
        status: s.status as AdminSyncDto['status'],
        startedAt: s.started_at ? new Date(String(s.started_at)).toISOString() : null,
        finishedAt: s.finished_at ? new Date(String(s.finished_at)).toISOString() : null,
        readCount: Number(s.read_count),
        createdCount: Number(s.created_count),
        updatedCount: Number(s.updated_count),
        failedCount: Number(s.failed_count),
        errorSummary: (s.error_summary as string | null) ?? null,
      });
    }
    return this.registry.list().map((p) => ({
      key: p.info.key,
      displayName: p.info.displayName,
      supportStatus: p.info.supportStatus,
      reason: p.info.reason,
      dataOrigin: p.info.dataOrigin,
      retailerSlugs: p.info.retailerSlugs,
      enabled: p.info.supportStatus !== 'UNSUPPORTED',
      lastSync: last.get(p.info.key) ?? null,
    }));
  }

  async triggerSync(providerKey: string, kind: SyncKind, admin: AuthUser): Promise<AdminSyncDto> {
    const provider = this.registry.get(providerKey);
    if (!provider) throw notFound('Provider');
    if (provider.info.supportStatus === 'UNSUPPORTED') {
      throw new BadRequestException({
        code: 'PROVIDER_UNSUPPORTED',
        message: provider.info.reason ?? 'Provider is unsupported',
      });
    }
    const syncId = await this.jobs.enqueueSync(providerKey, kind, `admin:${admin.id}`);
    const [row] = await this.db.select().from(providerSyncs).where(eq(providerSyncs.id, syncId));
    return syncDto(row!);
  }

  async syncs(q: AdminListQuery): Promise<Paginated<AdminSyncDto>> {
    const where = q.status ? eq(providerSyncs.status, q.status as SyncRow['status']) : undefined;
    const rows = await this.db
      .select()
      .from(providerSyncs)
      .where(where)
      .orderBy(desc(providerSyncs.createdAt))
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db.select({ value: count() }).from(providerSyncs).where(where);
    return { total, items: rows.map(syncDto) };
  }

  async errors(q: AdminListQuery): Promise<Paginated<AdminProviderErrorDto>> {
    const where =
      q.status === 'resolved' ? sql`${providerErrors.resolvedAt} IS NOT NULL` : isNull(providerErrors.resolvedAt);
    const rows = await this.db
      .select()
      .from(providerErrors)
      .where(where)
      .orderBy(desc(providerErrors.createdAt))
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(providerErrors)
      .where(where);
    return {
      total,
      items: rows.map((e) => ({
        id: e.id,
        syncId: e.syncId,
        providerKey: e.providerKey,
        stage: e.stage,
        externalId: e.externalId,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  async resolveError(id: string): Promise<void> {
    await this.db.update(providerErrors).set({ resolvedAt: new Date() }).where(eq(providerErrors.id, id));
  }

  // ── Catalogue browsing ─────────────────────────────────────────────────

  async variants(q: AdminListQuery): Promise<Paginated<Record<string, unknown>>> {
    const where = and(
      q.q ? ilike(productVariants.searchText, `%${q.q.toLowerCase()}%`) : undefined,
      q.status === 'needs_review' ? eq(productVariants.needsReview, true) : undefined,
    );
    const rows = await this.db
      .select({
        id: productVariants.id,
        name: productVariants.displayName,
        sizeLabel: productVariants.sizeLabel,
        needsReview: productVariants.needsReview,
        dataOrigin: productVariants.dataOrigin,
        listings: sql<number>`(SELECT count(*)::int FROM catalog.retailer_products rp WHERE rp.variant_id = ${productVariants.id})`,
        gtins: sql<
          string[]
        >`(SELECT coalesce(array_agg(b.gtin), '{}') FROM catalog.product_barcodes b WHERE b.variant_id = ${productVariants.id})`,
      })
      .from(productVariants)
      .where(where)
      .orderBy(productVariants.displayName)
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(productVariants)
      .where(where);
    return { total, items: rows };
  }

  async variant(id: string): Promise<Record<string, unknown>> {
    const [v] = await this.db.select().from(productVariants).where(eq(productVariants.id, id));
    if (!v) throw notFound('Product');
    const listings = await this.db
      .select({ rp: retailerProducts, retailerName: retailers.name, price: currentPrices })
      .from(retailerProducts)
      .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
      .leftJoin(currentPrices, eq(currentPrices.retailerProductId, retailerProducts.id))
      .where(eq(retailerProducts.variantId, id));
    const gtins = await this.db.select().from(productBarcodes).where(eq(productBarcodes.variantId, id));
    return { variant: v, listings, gtins };
  }

  async updateVariant(id: string, input: { displayName?: string; needsReview?: boolean }): Promise<void> {
    const [row] = await this.db
      .update(productVariants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(productVariants.id, id))
      .returning({ id: productVariants.id });
    if (!row) throw notFound('Product');
    await this.cache.invalidateCatalog();
  }

  async retailerProductsList(q: AdminListQuery): Promise<Paginated<Record<string, unknown>>> {
    const where = and(
      q.q ? ilike(retailerProducts.title, `%${q.q}%`) : undefined,
      q.status === 'unlinked' ? isNull(retailerProducts.variantId) : undefined,
    );
    const rows = await this.db
      .select({
        id: retailerProducts.id,
        title: retailerProducts.title,
        sku: retailerProducts.retailerSku,
        retailerName: retailers.name,
        variantId: retailerProducts.variantId,
        dataOrigin: retailerProducts.dataOrigin,
        lastSeenAt: retailerProducts.lastSeenAt,
        price: currentPrices.regularPriceCents,
        promo: currentPrices.promoPriceCents,
      })
      .from(retailerProducts)
      .innerJoin(retailers, eq(retailers.id, retailerProducts.retailerId))
      .leftJoin(currentPrices, eq(currentPrices.retailerProductId, retailerProducts.id))
      .where(where)
      .orderBy(retailerProducts.title)
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(retailerProducts)
      .where(where);
    return { total, items: rows };
  }

  async prices(retailerProductId: string): Promise<Record<string, unknown>[]> {
    return this.db
      .select()
      .from(priceObservations)
      .where(eq(priceObservations.retailerProductId, retailerProductId))
      .orderBy(desc(priceObservations.observedAt))
      .limit(200);
  }

  async promotionsList(q: AdminListQuery): Promise<Paginated<Record<string, unknown>>> {
    const rows = await this.db
      .select({
        id: promotions.id,
        label: promotions.label,
        mechanic: promotions.mechanic,
        params: promotions.params,
        retailerName: retailers.name,
        startsAt: promotions.startsAt,
        endsAt: promotions.endsAt,
        dataOrigin: promotions.dataOrigin,
      })
      .from(promotions)
      .innerJoin(retailers, eq(retailers.id, promotions.retailerId))
      .orderBy(desc(promotions.startsAt))
      .limit(q.limit)
      .offset(q.offset);
    const [{ value: total } = { value: 0 }] = await this.db.select({ value: count() }).from(promotions);
    return { total, items: rows };
  }

  async retailersList(): Promise<Record<string, unknown>[]> {
    const rows = await this.db.select().from(retailers).orderBy(retailers.name);
    return rows.map((r) => ({ ...r, dataSupport: this.registry.supportFor(r.slug) }));
  }

  async setRetailerActive(id: string, isActive: boolean): Promise<void> {
    await this.db.update(retailers).set({ isActive, updatedAt: new Date() }).where(eq(retailers.id, id));
    await this.cache.invalidateCatalog();
  }
}

@Roles('ADMIN')
@Controller('v1/admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jobs: JobsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }

  @Get('matches')
  matches(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<AdminMatchDto>> {
    return this.admin.matches(q);
  }

  @Post('matches/:id/decision')
  @HttpCode(200)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(matchDecisionSchema)) body: MatchDecision,
    @CurrentUser() user: AuthUser,
  ): Promise<AdminMatchDto | null> {
    return this.admin.decideMatch(id, body, user);
  }

  @Get('equivalences')
  equivalences(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<AdminEquivalenceDto>> {
    return this.admin.equivalences(q);
  }

  @Post('equivalences/:id/decision')
  @HttpCode(204)
  async decideEquivalence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(equivalenceDecisionSchema)) body: { decision: 'confirm' | 'reject' },
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.admin.decideEquivalence(id, body.decision, user);
  }

  @Get('providers')
  providers(): Promise<AdminProviderDto[]> {
    return this.admin.providers();
  }

  @Post('providers/:key/sync')
  @HttpCode(202)
  sync(
    @Param('key') key: string,
    @Body(new ZodPipe(triggerSyncSchema)) body: { kind: SyncKind },
    @CurrentUser() user: AuthUser,
  ): Promise<AdminSyncDto> {
    return this.admin.triggerSync(key, body.kind, user);
  }

  @Get('syncs')
  syncs(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<AdminSyncDto>> {
    return this.admin.syncs(q);
  }

  @Get('errors')
  errors(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<AdminProviderErrorDto>> {
    return this.admin.errors(q);
  }

  @Post('errors/:id/resolve')
  @HttpCode(204)
  async resolve(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.admin.resolveError(id);
  }

  @Get('retailers')
  retailers(): Promise<Record<string, unknown>[]> {
    return this.admin.retailersList();
  }

  @Patch('retailers/:id')
  @HttpCode(204)
  async retailer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ isActive: z.boolean() }))) body: { isActive: boolean },
  ): Promise<void> {
    await this.admin.setRetailerActive(id, body.isActive);
  }

  @Get('products')
  variants(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<Record<string, unknown>>> {
    return this.admin.variants(q);
  }

  @Get('products/:id')
  variant(@Param('id', ParseUUIDPipe) id: string): Promise<Record<string, unknown>> {
    return this.admin.variant(id);
  }

  @Patch('products/:id')
  @HttpCode(204)
  async updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodPipe(
        z.object({ displayName: z.string().min(1).max(200).optional(), needsReview: z.boolean().optional() }),
      ),
    )
    body: { displayName?: string; needsReview?: boolean },
  ): Promise<void> {
    await this.admin.updateVariant(id, body);
  }

  @Get('retailer-products')
  retailerProducts(
    @Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery,
  ): Promise<Paginated<Record<string, unknown>>> {
    return this.admin.retailerProductsList(q);
  }

  @Get('retailer-products/:id/prices')
  prices(@Param('id', ParseUUIDPipe) id: string): Promise<Record<string, unknown>[]> {
    return this.admin.prices(id);
  }

  @Get('promotions')
  promotions(@Query(new ZodPipe(adminListQuerySchema)) q: AdminListQuery): Promise<Paginated<Record<string, unknown>>> {
    return this.admin.promotionsList(q);
  }

  /** Development only: import a price observation through the pipeline (vertical slice 3). */
  @Post('dev/price-observations')
  @HttpCode(201)
  async devObservation(
    @Body(new ZodPipe(devObservationSchema)) body: z.infer<typeof devObservationSchema>,
  ): Promise<Record<string, unknown>> {
    if (this.config.isProduction || !this.config.allowDevelopmentData) {
      throw new BadRequestException({
        code: 'DISABLED',
        message: 'Development tooling is disabled in this environment',
      });
    }
    return this.jobs.importDevelopmentObservation(body);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
