/**
 * Importeert een `AdapterSnapshot` in de database. Idempotent: dezelfde
 * snapshot twee keer importeren geeft geen tweede rij, geen tweede
 * historiepunt en geen tweede match.
 *
 * ## Volgorde per keten
 *
 *  1. keten en filialen bijwerken;
 *  2. categorieën aanmaken die de feed noemt;
 *  3. winkelproducten koppelen aan een canoniek product
 *     (barcode → matchsleutel → nieuw, met deterministische matching);
 *  4. aanbiedingen upserten op `(keten, sourceReference)`, eenheidsprijs
 *     berekenen, niet-geziene aanbiedingen deactiveren;
 *  5. prijsgeschiedenis aanvullen bij een gewijzigde prijs;
 *  6. de `ImportRun` afsluiten met tellers en fouten.
 *
 * Fouten per product of aanbieding breken de run niet af: ze landen in
 * `ImportRun.errors` en de run eindigt als `PARTIAL`.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type ImportRunStatus, type StoreChain } from '@prisma/client';
import { assertPromotionRule, computeUnitPrice, normalizePackage, type PromotionRule } from '@superette/pricing';
import { PrismaService } from '../../prisma/prisma.service';
import { SUPERMARKET_ADAPTERS } from '../adapters/adapter-registry';
import type { AdapterContext, AdapterSnapshot, NormalizedStoreProduct, SupermarketAdapter } from '../adapters/supermarket-adapter';
import { CompareConfig } from '../compare-config';
import { DEMO_CATEGORIES } from '../demo/demo-catalog';
import {
  buildMatchKey,
  detectBrandType,
  evaluateMatch,
  normalizeBrand,
  normalizeProductName,
  stripQuantityTokens,
  type MatchCandidate,
} from '../matching/product-matcher';

export interface ImportRunSummary {
  readonly adapterKey: string;
  readonly runId: string;
  readonly status: ImportRunStatus;
  readonly source: string;
  readonly productsSeen: number;
  readonly offersUpserted: number;
  readonly offersDeactivated: number;
  readonly historyAppended: number;
  readonly matchesCreated: number;
  readonly errors: string[];
  readonly note: string | null;
  readonly durationMs: number;
}

interface Counters {
  productsSeen: number;
  offersUpserted: number;
  offersDeactivated: number;
  historyAppended: number;
  matchesCreated: number;
}

interface ProductSpec {
  readonly packageQuantity: number | null;
  readonly packageUnit: NormalizedStoreProduct['packageUnit'] | null;
  readonly packCount: number;
  readonly normalizedQuantity: number | null;
  readonly normalizedUnit: 'KG' | 'L' | 'PIECE' | null;
}

/** Foutmelding zonder stacktrace, paden of geheimen. */
function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[A-Za-z]:\\[^\s]+/g, '<pad>').slice(0, 300);
}

const MATCH_POOL_LIMIT = 2000;

/** Boven dit aandeel mislukte regels wordt niets gedeactiveerd: de bron is dan niet te vertrouwen. */
export const MAX_FAILURE_RATIO = 0.2;

/** Hoogste betrouwbaarheid voor prijzen uit een bron met `termsReviewed: false` (→ status UNVERIFIED). */
export const UNREVIEWED_SOURCE_CONFIDENCE = 0.5;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CompareConfig,
    @Inject(SUPERMARKET_ADAPTERS) private readonly adapters: readonly SupermarketAdapter[],
  ) {}

  get registeredAdapters(): readonly SupermarketAdapter[] {
    return this.adapters;
  }

  /** Draait alle (of de gevraagde) adapters, na elkaar. Na elkaar: zo respecteren we rate limits per bron. */
  async runAll(keys: readonly string[] = [], now: Date = new Date()): Promise<ImportRunSummary[]> {
    const selected = keys.length > 0 ? this.adapters.filter((adapter) => keys.includes(adapter.key)) : this.adapters;
    const summaries: ImportRunSummary[] = [];

    for (const adapter of selected) {
      summaries.push(await this.runAdapter(adapter, now));
    }

    return summaries;
  }

  async runAdapter(adapter: SupermarketAdapter, now: Date = new Date()): Promise<ImportRunSummary> {
    const startedAt = Date.now();
    const run = await this.prisma.importRun.create({
      data: { adapterKey: adapter.key, source: adapter.source.kind, status: 'RUNNING', startedAt: now },
    });

    const errors: string[] = [];
    const counters: Counters = { productsSeen: 0, offersUpserted: 0, offersDeactivated: 0, historyAppended: 0, matchesCreated: 0 };
    let status: ImportRunStatus = 'FAILED';
    let note: string | null = null;
    let chainId: string | null = null;
    let source = adapter.source.kind;
    let termsReviewed = false;

    try {
      const context: AdapterContext = {
        logger: { log: (m) => this.logger.log(m), warn: (m) => this.logger.warn(m) },
        feedDir: this.config.feedDir,
        allowDemo: this.config.allowDemo,
        now,
      };

      const snapshot = await this.fetchSnapshotWithRetry(adapter, context);

      if (!snapshot) {
        note = 'Geen databron beschikbaar (geen importbestand, demo uitgeschakeld of bron onbereikbaar)';
      } else {
        source = snapshot.source.kind;
        termsReviewed = snapshot.source.termsReviewed;
        const chain = await this.upsertChain(adapter, snapshot);
        chainId = chain.id;

        const locationIds = await this.upsertLocations(chain.id, snapshot);
        const categoryIds = await this.ensureCategories(snapshot);
        const { products, seenProducts } = await this.upsertProducts(chain, snapshot, categoryIds, errors, counters, now);
        const seenOffers = await this.upsertOffers(chain, snapshot, products, locationIds, errors, counters, now);
        const deactivation = await this.deactivateUnseen(chain, snapshot, seenProducts, seenOffers, errors, counters);

        status = errors.length > 0 ? 'PARTIAL' : 'SUCCEEDED';
        note = deactivation.skipped ? `${snapshot.source.label} · deactivering overgeslagen: ${deactivation.reason}` : snapshot.source.label;
      }
    } catch (error) {
      errors.push(safeMessage(error));
      status = 'FAILED';
      this.logger.error(`[${adapter.key}] import mislukt: ${safeMessage(error)}`);
    }

    await this.prisma.importRun.update({
      where: { id: run.id },
      data: {
        status,
        source,
        termsReviewed,
        storeChainId: chainId,
        finishedAt: new Date(),
        ...counters,
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
        note,
      },
    });

    const summary: ImportRunSummary = {
      adapterKey: adapter.key,
      runId: run.id,
      status,
      source,
      ...counters,
      errors,
      note,
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `[${adapter.key}] ${status} · ${counters.productsSeen} producten · ${counters.offersUpserted} aanbiedingen · ${counters.historyAppended} historiepunten · ${counters.matchesCreated} matches · ${errors.length} fouten · ${summary.durationMs} ms`,
    );

    return summary;
  }

  // ── Stappen ──────────────────────────────────────────────────────────────

  private async upsertChain(adapter: SupermarketAdapter, snapshot: AdapterSnapshot): Promise<StoreChain> {
    const info = { ...adapter.chain, ...snapshot.chain };
    const data = {
      name: info.name,
      logoUrl: info.logoUrl ?? null,
      websiteUrl: info.websiteUrl ?? null,
      loyaltyCardName: info.loyaltyCardName ?? null,
      sortOrder: info.sortOrder ?? 0,
    };

    return this.prisma.storeChain.upsert({
      where: { adapterKey: adapter.key },
      update: data,
      create: { ...data, slug: adapter.chain.slug, adapterKey: adapter.key },
    });
  }

  private async upsertLocations(storeChainId: string, snapshot: AdapterSnapshot): Promise<Map<string, string>> {
    const ids = new Map<string, string>();

    for (const location of snapshot.locations) {
      const row = await this.prisma.storeLocation.upsert({
        where: { storeChainId_externalId: { storeChainId, externalId: location.externalId } },
        update: {
          name: location.name,
          address: location.address,
          postalCode: location.postalCode,
          city: location.city,
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
          serviceArea: location.serviceArea ?? null,
          active: location.active ?? true,
        },
        create: {
          storeChainId,
          externalId: location.externalId,
          name: location.name,
          address: location.address,
          postalCode: location.postalCode,
          city: location.city,
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
          serviceArea: location.serviceArea ?? null,
          active: location.active ?? true,
        },
        select: { id: true },
      });
      ids.set(location.externalId, row.id);
    }

    return ids;
  }

  private async ensureCategories(snapshot: AdapterSnapshot): Promise<Map<string, string>> {
    const slugs = new Set<string>();
    for (const product of snapshot.products) {
      if (product.categorySlug) slugs.add(product.categorySlug);
    }

    const ids = new Map<string, string>();
    for (const slug of slugs) {
      const known = DEMO_CATEGORIES.find((category) => category.slug === slug);
      const humanized = slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
      const row = await this.prisma.catalogCategory.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          nameNl: known?.nameNl ?? humanized,
          nameFr: known?.nameFr ?? humanized,
          sortOrder: known?.sortOrder ?? 100,
        },
        select: { id: true },
      });
      ids.set(slug, row.id);
    }

    return ids;
  }

  private specOf(product: NormalizedStoreProduct): ProductSpec {
    const normalized = normalizePackage(
      product.packageQuantity != null && product.packageUnit
        ? { quantity: product.packageQuantity, unit: product.packageUnit, packCount: product.packCount ?? 1 }
        : null,
    );

    if (!normalized.ok) {
      return {
        packageQuantity: null,
        packageUnit: null,
        packCount: product.packCount ?? 1,
        normalizedQuantity: null,
        normalizedUnit: null,
      };
    }

    return {
      packageQuantity: product.packageQuantity ?? null,
      packageUnit: product.packageUnit ?? null,
      packCount: normalized.packCount,
      normalizedQuantity: normalized.total.amount,
      normalizedUnit: normalized.total.unit,
    };
  }

  private async upsertProducts(
    chain: StoreChain,
    snapshot: AdapterSnapshot,
    categoryIds: Map<string, string>,
    errors: string[],
    counters: Counters,
    now: Date,
  ): Promise<{ products: Map<string, { storeProductId: string; spec: ProductSpec }>; seenProducts: Set<string> }> {
    const existing = new Map(
      (
        await this.prisma.storeProduct.findMany({
          where: { storeChainId: chain.id },
          select: { id: true, externalId: true, catalogProductId: true },
        })
      ).map((row) => [row.externalId, row]),
    );

    const result = new Map<string, { storeProductId: string; spec: ProductSpec }>();
    const seen = new Set<string>();

    for (const product of snapshot.products) {
      counters.productsSeen++;
      try {
        const spec = this.specOf(product);
        const brandType = product.brandType ?? detectBrandType(product.brand, chain.slug);
        const categoryId = product.categorySlug ? (categoryIds.get(product.categorySlug) ?? null) : null;

        const prior = existing.get(product.externalId);
        const catalogProductId =
          prior?.catalogProductId ?? (await this.resolveCatalogProduct(product, spec, brandType, categoryId, counters));

        const data = {
          name: product.name,
          brand: product.brand ?? null,
          imageUrl: product.imageUrl ?? null,
          productUrl: product.productUrl ?? null,
          barcode: product.barcode ?? null,
          categoryPath: product.categoryPath ?? null,
          packageQuantity: spec.packageQuantity,
          packageUnit: spec.packageUnit,
          packCount: spec.packCount,
          active: product.active ?? true,
          lastSeenAt: now,
          catalogProductId,
        };

        const row = await this.prisma.storeProduct.upsert({
          where: { storeChainId_externalId: { storeChainId: chain.id, externalId: product.externalId } },
          update: data,
          create: { ...data, storeChainId: chain.id, externalId: product.externalId },
          select: { id: true },
        });

        seen.add(product.externalId);
        result.set(product.externalId, { storeProductId: row.id, spec });
      } catch (error) {
        errors.push(`product ${product.externalId}: ${safeMessage(error)}`);
      }
    }

    return { products: result, seenProducts: seen };
  }

  /**
   * Zoekt het canonieke product voor een winkelproduct, of maakt het aan.
   *
   *  1. barcode   — dezelfde EAN is hetzelfde product, punt;
   *  2. matchKey  — zelfde merk, naam en inhoud zonder barcode;
   *  3. nieuw     — en meteen matchen tegen de bestaande catalogus.
   */
  private async resolveCatalogProduct(
    product: NormalizedStoreProduct,
    spec: ProductSpec,
    brandType: ReturnType<typeof detectBrandType>,
    categoryId: string | null,
    counters: Counters,
  ): Promise<string> {
    const normalizedBrand = normalizeBrand(product.brand);
    const normalizedName = normalizeProductName(product.name, product.brand, brandType);
    const matchKey = buildMatchKey({
      normalizedBrand,
      normalizedName,
      normalizedQuantity: spec.normalizedQuantity,
      normalizedUnit: spec.normalizedUnit,
      packCount: spec.packCount,
    });

    if (product.barcode) {
      const byBarcode = await this.prisma.catalogProduct.findUnique({ where: { barcode: product.barcode }, select: { id: true } });
      if (byBarcode) return byBarcode.id;
    }

    const byKey = await this.prisma.catalogProduct.findFirst({ where: { matchKey }, select: { id: true, barcode: true } });
    if (byKey) {
      if (product.barcode && !byKey.barcode) {
        // Een tweede keten levert wél een barcode voor een product dat we al kenden. Bewaren.
        await this.prisma.catalogProduct.update({ where: { id: byKey.id }, data: { barcode: product.barcode } }).catch(() => undefined);
      }
      return byKey.id;
    }

    const displayName = stripQuantityTokens(product.name).trim() || product.name;
    const created = await this.prisma.catalogProduct.create({
      data: {
        name: displayName,
        normalizedName,
        brand: product.brand ?? null,
        normalizedBrand,
        brandType,
        categoryId,
        imageUrl: product.imageUrl ?? null,
        description: product.description ?? null,
        barcode: product.barcode ?? null,
        packageQuantity: spec.packageQuantity,
        packageUnit: spec.packageUnit,
        packCount: spec.packCount,
        normalizedQuantity: spec.normalizedQuantity,
        normalizedUnit: spec.normalizedUnit,
        matchKey,
      },
    });

    counters.matchesCreated += await this.linkMatches({
      id: created.id,
      normalizedName,
      normalizedBrand,
      brandType,
      barcode: created.barcode,
      normalizedQuantity: spec.normalizedQuantity,
      normalizedUnit: spec.normalizedUnit,
      packCount: spec.packCount,
      categoryId,
      matchKey,
    });

    return created.id;
  }

  /**
   * Matcht een nieuw canoniek product tegen de bestaande catalogus en bewaart
   * EQUIVALENT / ALTERNATIVE / UNCERTAIN in beide richtingen. Bestaande rijen
   * (ook door een mens bevestigde of afgewezen) worden nooit overschreven.
   */
  private async linkMatches(candidate: MatchCandidate): Promise<number> {
    const pool = await this.prisma.catalogProduct.findMany({
      where: {
        active: true,
        id: { not: candidate.id },
        ...(candidate.categoryId ? { categoryId: candidate.categoryId } : {}),
        ...(candidate.normalizedUnit ? { normalizedUnit: candidate.normalizedUnit } : {}),
      },
      select: {
        id: true,
        normalizedName: true,
        normalizedBrand: true,
        brandType: true,
        barcode: true,
        normalizedQuantity: true,
        normalizedUnit: true,
        packCount: true,
        categoryId: true,
        matchKey: true,
      },
      take: MATCH_POOL_LIMIT,
    });

    let created = 0;
    for (const other of pool) {
      const decision = evaluateMatch(candidate, other);
      if (!decision || decision.matchType === 'EXACT') continue;

      for (const [productId, relatedProductId] of [
        [candidate.id, other.id],
        [other.id, candidate.id],
      ] as const) {
        try {
          await this.prisma.productMatch.create({
            data: { productId, relatedProductId, matchType: decision.matchType, confidence: decision.confidence, reason: decision.reason },
          });
          created++;
        } catch (error) {
          // P2002: dit paar bestaat al (mogelijk bevestigd of afgewezen door een mens). Laten staan.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        }
      }
    }

    return created;
  }

  private async upsertOffers(
    chain: StoreChain,
    snapshot: AdapterSnapshot,
    products: Map<string, { storeProductId: string; spec: ProductSpec }>,
    locationIds: Map<string, string>,
    errors: string[],
    counters: Counters,
    now: Date,
  ): Promise<Set<string>> {
    const seen = new Set<string>();

    for (const offer of snapshot.offers) {
      try {
        const product = products.get(offer.productExternalId);
        if (!product) throw new Error(`onbekend product ${offer.productExternalId}`);

        let storeLocationId: string | null = null;
        if (offer.locationExternalId) {
          storeLocationId = locationIds.get(offer.locationExternalId) ?? null;
          if (!storeLocationId) throw new Error(`onbekend filiaal ${offer.locationExternalId}`);
        }

        const rule = offer.promotionRule ?? null;
        if (rule && rule.kind !== 'NONE') assertPromotionRule(rule as PromotionRule);

        const unit =
          product.spec.normalizedQuantity !== null && product.spec.normalizedUnit !== null && product.spec.packageUnit !== null
            ? computeUnitPrice(offer.priceCents, {
                quantity: product.spec.packageQuantity ?? 0,
                unit: product.spec.packageUnit,
                packCount: product.spec.packCount,
              })
            : null;

        const data = {
          storeProductId: product.storeProductId,
          storeLocationId,
          priceCents: offer.priceCents,
          originalPriceCents: offer.originalPriceCents ?? null,
          unitPriceCents: unit && unit.ok ? unit.unitPriceCents : null,
          unitType: unit && unit.ok ? unit.unit : null,
          promotionType: offer.promotionType ?? 'NONE',
          promotionText: offer.promotionText ?? null,
          promotionRule: rule && rule.kind !== 'NONE' ? (rule as Prisma.InputJsonValue) : Prisma.JsonNull,
          conditions: offer.conditions ?? null,
          requiresLoyaltyCard: offer.requiresLoyaltyCard ?? false,
          isPersonalized: offer.isPersonalized ?? false,
          channel: offer.channel ?? 'BOTH',
          minimumQuantity: offer.minimumQuantity ?? 1,
          depositCents: offer.depositCents ?? null,
          availability: offer.availability ?? 'UNKNOWN',
          startsAt: offer.startsAt ?? null,
          endsAt: offer.endsAt ?? null,
          observedAt: offer.observedAt ?? snapshot.observedAt,
          source: snapshot.source.kind,
          sourceLabel: snapshot.source.label,
          // Bron waarvan de voorwaarden nog niet nagekeken zijn (`termsReviewed: false`):
          // betrouwbaarheid hoogstens 0,5, zodat elke prijs in de app "Niet geverifieerd"
          // toont (priceStatusFor: < 0,6 → UNVERIFIED) en niet "Actueel".
          confidence: snapshot.source.termsReviewed
            ? (offer.confidence ?? 1)
            : Math.min(offer.confidence ?? 1, UNREVIEWED_SOURCE_CONFIDENCE),
          active: true,
        };

        await this.prisma.productOffer.upsert({
          where: { storeChainId_sourceReference: { storeChainId: chain.id, sourceReference: offer.sourceReference } },
          update: data,
          create: { ...data, storeChainId: chain.id, sourceReference: offer.sourceReference },
          select: { id: true },
        });

        counters.offersUpserted++;
        seen.add(offer.sourceReference);

        // Geschiedenis volgt de winkelprijs voor iedereen: niet persoonlijk, niet alleen online.
        if (!data.isPersonalized && data.channel !== 'ONLINE') {
          counters.historyAppended += await this.appendHistory(chain.id, product.storeProductId, storeLocationId, data, now);
        }
      } catch (error) {
        errors.push(`aanbieding ${offer.sourceReference}: ${safeMessage(error)}`);
      }
    }

    return seen;
  }

  /**
   * Wat de bron niet meer noemt, is uit het assortiment: deactiveren, niet
   * wissen (lijsten en alerts verwijzen ernaar, de geschiedenis blijft leesbaar).
   *
   * Maar een bron die deels onleesbaar was, mag geen geldige prijzen wegvagen.
   * Boven `MAX_FAILURE_RATIO` fouten slaan we de deactivering over en blijft de
   * vorige stand staan; de run eindigt als PARTIAL met deze reden.
   */
  private async deactivateUnseen(
    chain: StoreChain,
    snapshot: AdapterSnapshot,
    seenProducts: Set<string>,
    seenOffers: Set<string>,
    errors: string[],
    counters: Counters,
  ): Promise<{ skipped: boolean; reason: string | null }> {
    const total = snapshot.products.length + snapshot.offers.length;
    const ratio = total === 0 ? 1 : errors.length / total;

    if (total === 0 || seenOffers.size === 0) {
      return { skipped: true, reason: 'de bron leverde geen bruikbare aanbiedingen' };
    }
    if (ratio > MAX_FAILURE_RATIO) {
      return { skipped: true, reason: `${Math.round(ratio * 100)} % van de regels faalde (grens ${Math.round(MAX_FAILURE_RATIO * 100)} %)` };
    }

    await this.prisma.storeProduct.updateMany({
      where: { storeChainId: chain.id, active: true, externalId: { notIn: [...seenProducts] } },
      data: { active: false },
    });
    const deactivated = await this.prisma.productOffer.updateMany({
      where: { storeChainId: chain.id, active: true, sourceReference: { notIn: [...seenOffers] } },
      data: { active: false },
    });
    counters.offersDeactivated += deactivated.count;

    return { skipped: false, reason: null };
  }

  /**
   * Eén snapshot ophalen met time-out en één herkansing: een bron die even
   * hapert, kost geen hele run. Een tweede mislukking wordt een gewone fout.
   */
  private async fetchSnapshotWithRetry(adapter: SupermarketAdapter, context: AdapterContext): Promise<AdapterSnapshot | null> {
    const timeoutMs = this.config.adapterTimeoutMs;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await withTimeout(adapter.fetchSnapshot(context), timeoutMs, `[${adapter.key}] bron antwoordde niet binnen ${timeoutMs} ms`);
      } catch (error) {
        lastError = error;
        this.logger.warn(`[${adapter.key}] poging ${attempt} mislukt: ${safeMessage(error)}`);
        if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }

    throw lastError;
  }

  /** Append-only: alleen een nieuw punt als de prijs of promotie verschilt van de laatste meting. */
  private async appendHistory(
    storeChainId: string,
    storeProductId: string,
    storeLocationId: string | null,
    data: {
      priceCents: number;
      originalPriceCents: number | null;
      unitPriceCents: number | null;
      promotionType: Prisma.PriceHistoryCreateInput['promotionType'];
      observedAt: Date;
      source: Prisma.PriceHistoryCreateInput['source'];
    },
    now: Date,
  ): Promise<number> {
    const last = await this.prisma.priceHistory.findFirst({
      where: { storeProductId, storeLocationId },
      orderBy: { observedAt: 'desc' },
      select: { priceCents: true, originalPriceCents: true, promotionType: true, observedAt: true },
    });

    const unchanged =
      last !== null &&
      last.priceCents === data.priceCents &&
      last.originalPriceCents === data.originalPriceCents &&
      last.promotionType === data.promotionType;

    if (unchanged) return 0;
    if (last && last.observedAt.getTime() >= data.observedAt.getTime()) {
      // Een oudere of gelijktijdige meting dan wat we al hebben: niets nieuws te registreren.
      return 0;
    }

    await this.prisma.priceHistory.create({
      data: {
        storeProductId,
        storeChainId,
        storeLocationId,
        priceCents: data.priceCents,
        originalPriceCents: data.originalPriceCents,
        unitPriceCents: data.unitPriceCents,
        promotionType: data.promotionType,
        observedAt: data.observedAt > now ? now : data.observedAt,
        source: data.source,
      },
    });

    return 1;
  }

  /** Deactiveert aanbiedingen waarvan de geldigheid voorbij is. Idempotent. */
  async expireOffers(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.productOffer.updateMany({
      where: { active: true, endsAt: { lt: now } },
      data: { active: false },
    });
    return result.count;
  }
}
