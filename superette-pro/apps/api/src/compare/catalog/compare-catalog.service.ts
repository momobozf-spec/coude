/**
 * Gedeelde laad- en vertaallaag van de vergelijker: van Prisma-rijen naar de
 * DTO's uit `@superette/contracts`, met eenheidsprijs, kortingspercentage,
 * promotielabel en herkomst erbij.
 *
 * Alles wat een prijs toont, gaat hier doorheen. Daardoor staat bij élke prijs
 * dezelfde bron- en actualiteitsinformatie, in de zoekresultaten én in een
 * alertmelding.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CatalogProductSummary,
  Coverage,
  PriceHistorySummary,
  ProductOffer,
  PromotionRuleInput,
  RelatedProduct,
} from '@superette/contracts';
import { promotionRuleSchema } from '@superette/contracts';
import {
  bestEffectiveUnitPrice,
  describePromotion,
  discountPercentage,
  formatBaseQuantity,
  unitPrice,
  type PromotionRule,
} from '@superette/pricing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompareConfig } from '../compare-config';
import { isConditionalRule, priceStatusFor, sourceKindLabel } from '../pricing/offer-pricing';

export type ProductRow = Prisma.CatalogProductGetPayload<{ include: { category: true } }>;

export const OFFER_INCLUDE = {
  storeChain: true,
  storeLocation: true,
  storeProduct: { include: { catalogProduct: { include: { category: true } } } },
} as const satisfies Prisma.ProductOfferInclude;

export type OfferRow = Prisma.ProductOfferGetPayload<{ include: typeof OFFER_INCLUDE }>;

export interface OfferFilter {
  /** Leeg = alle actieve ketens. */
  readonly chainSlugs: readonly string[];
  readonly includePersonalized: boolean;
  readonly includeOnline: boolean;
  readonly loyalty: 'ANY' | 'REQUIRED' | 'NOT_REQUIRED';
  readonly onlyPromotions?: boolean;
  readonly availability?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly maxPriceCents?: number;
  /** Alleen prijzen die keten-breed gelden of in deze filialen. */
  readonly locationIds?: readonly string[];
}

export const DEFAULT_OFFER_FILTER: OfferFilter = Object.freeze({
  chainSlugs: [],
  includePersonalized: false,
  includeOnline: true,
  loyalty: 'ANY',
});

export const HISTORY_DISCLAIMER =
  'Historische prijzen zijn gebaseerd op geregistreerde meetmomenten en vertegenwoordigen niet noodzakelijk elke kassaprijs.';

@Injectable()
export class CompareCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CompareConfig,
  ) {}

  // ── Vertalen ─────────────────────────────────────────────────────────────

  productSummary(row: ProductRow): CatalogProductSummary {
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      brandType: row.brandType,
      categoryId: row.categoryId,
      categorySlug: row.category?.slug ?? null,
      categoryName: row.category?.nameNl ?? null,
      imageUrl: row.imageUrl,
      barcode: row.barcode,
      packageLabel: packageLabelOf(row),
      normalizedQuantity: row.normalizedQuantity,
      normalizedUnit: row.normalizedUnit,
      packCount: row.packCount,
    };
  }

  offerDto(row: OfferRow, now: Date = new Date()): ProductOffer {
    const rule = parseRule(row.promotionRule);
    const product = row.storeProduct.catalogProduct;

    const unit =
      row.unitPriceCents !== null && row.unitType !== null ? { cents: row.unitPriceCents, unit: row.unitType } : null;

    let effective: ProductOffer['effectivePrice'] = null;
    if (rule && isConditionalRule(rule)) {
      const best = bestEffectiveUnitPrice(row.priceCents, rule as PromotionRule);
      const effectiveUnit =
        product.normalizedQuantity !== null && product.normalizedUnit !== null
          ? unitPrice(best.unitCents, { amount: product.normalizedQuantity, unit: product.normalizedUnit })
          : null;
      effective = {
        unitCents: best.unitCents,
        atQuantity: best.atQuantity,
        conditional: best.conditional,
        unitPrice: effectiveUnit && effectiveUnit.ok ? { cents: effectiveUnit.unitPriceCents, unit: effectiveUnit.unit } : null,
      };
    }

    const status = priceStatusFor({
      sourceKind: row.source,
      observedAt: row.observedAt,
      endsAt: row.endsAt,
      confidence: row.confidence,
      now,
      freshHours: this.config.freshHours,
    });

    return {
      id: row.id,
      storeChain: { id: row.storeChain.id, slug: row.storeChain.slug, name: row.storeChain.name, logoUrl: row.storeChain.logoUrl },
      storeLocation: row.storeLocation
        ? { id: row.storeLocation.id, name: row.storeLocation.name, city: row.storeLocation.city, postalCode: row.storeLocation.postalCode }
        : null,
      storeProductName: row.storeProduct.name,
      productUrl: row.storeProduct.productUrl,
      imageUrl: row.storeProduct.imageUrl ?? product.imageUrl,
      priceCents: row.priceCents,
      originalPriceCents: row.originalPriceCents,
      discountPercentage: row.originalPriceCents !== null ? discountPercentage(row.originalPriceCents, row.priceCents) : null,
      unitPrice: unit,
      unitPriceUnavailableReason: unit ? null : 'Inhoud van de verpakking is onbekend, dus geen prijs per eenheid',
      promotionType: row.promotionType,
      promotionLabel: row.promotionText ?? (rule ? describePromotion(rule as PromotionRule) : null),
      promotionRule: rule,
      conditions: row.conditions,
      requiresLoyaltyCard: row.requiresLoyaltyCard,
      isPersonalized: row.isPersonalized,
      channel: row.channel,
      minimumQuantity: row.minimumQuantity,
      effectivePrice: effective,
      depositCents: row.depositCents,
      availability: row.availability,
      provenance: {
        sourceKind: row.source,
        sourceLabel: row.sourceLabel || sourceKindLabel(row.source),
        sourceReference: row.sourceReference,
        observedAt: row.observedAt.toISOString(),
        validFrom: row.startsAt?.toISOString() ?? null,
        validUntil: row.endsAt?.toISOString() ?? null,
        confidence: row.confidence,
        status,
        isDemo: row.source === 'DEMO',
      },
    };
  }

  // ── Laden ────────────────────────────────────────────────────────────────

  /** Actieve ketens, beperkt tot `slugs` als die gegeven zijn. */
  async chains(slugs: readonly string[] = []) {
    return this.prisma.storeChain.findMany({
      where: { active: true, ...(slugs.length > 0 ? { slug: { in: [...slugs] } } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Actieve, niet-verlopen aanbiedingen per product, gefilterd volgens de
   * voorkeuren van de gebruiker. Verlopen prijzen worden bewust weggelaten:
   * een promotie van vorige week is geen prijs.
   */
  async offersByProduct(productIds: readonly string[], filter: OfferFilter, now: Date = new Date()): Promise<Map<string, ProductOffer[]>> {
    const result = new Map<string, ProductOffer[]>();
    if (productIds.length === 0) return result;

    const rows = await this.prisma.productOffer.findMany({
      where: {
        active: true,
        storeProduct: { active: true, catalogProductId: { in: [...productIds] } },
        storeChain: { active: true, ...(filter.chainSlugs.length > 0 ? { slug: { in: [...filter.chainSlugs] } } : {}) },
        // Elke voorwaarde apart in AND: twee `OR`-sleutels in één object
        // overschrijven elkaar (dan kwamen verlopen prijzen terug zodra er
        // filialen gefilterd werden).
        AND: [
          // Nog niet verlopen…
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          // …en al begonnen: een weekendactie van zaterdag is op dinsdag geen prijs.
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          ...(filter.locationIds
            ? [{ OR: [{ storeLocationId: null }, { storeLocationId: { in: [...filter.locationIds] } }] }]
            : []),
        ],
        ...(filter.includePersonalized ? {} : { isPersonalized: false }),
        ...(filter.includeOnline ? {} : { channel: { not: 'ONLINE' } }),
        ...(filter.loyalty === 'REQUIRED' ? { requiresLoyaltyCard: true } : filter.loyalty === 'NOT_REQUIRED' ? { requiresLoyaltyCard: false } : {}),
        ...(filter.onlyPromotions ? { promotionType: { not: 'NONE' } } : {}),
        ...(filter.availability ? { availability: filter.availability } : {}),
        ...(filter.maxPriceCents !== undefined ? { priceCents: { lte: filter.maxPriceCents } } : {}),
      },
      include: OFFER_INCLUDE,
      orderBy: [{ priceCents: 'asc' }],
    });

    for (const row of rows) {
      const productId = row.storeProduct.catalogProductId;
      const list = result.get(productId) ?? [];
      list.push(this.offerDto(row, now));
      result.set(productId, list);
    }

    return result;
  }

  /** Gerelateerde producten (equivalent, alternatief) en het aantal onzekere matches. */
  async related(productId: string): Promise<{ related: Array<Omit<RelatedProduct, 'offers'>>; uncertainCount: number }> {
    const matches = await this.prisma.productMatch.findMany({
      where: { productId, status: { not: 'REJECTED' }, related: { active: true } },
      include: { related: { include: { category: true } } },
      orderBy: [{ confidence: 'desc' }],
    });

    const related: Array<Omit<RelatedProduct, 'offers'>> = [];
    let uncertainCount = 0;

    for (const match of matches) {
      if (match.matchType === 'UNCERTAIN' && match.status !== 'CONFIRMED') {
        uncertainCount++;
        continue;
      }
      related.push({
        product: this.productSummary(match.related),
        matchType: match.matchType,
        matchConfidence: match.confidence,
        matchStatus: match.status,
        reason: match.reason,
      });
    }

    return { related, uncertainCount };
  }

  /** Dekking: van welke gevraagde ketens hebben we (recente) gegevens? */
  async coverage(slugs: readonly string[]): Promise<Coverage> {
    const chains = await this.chains(slugs);
    const runs = await this.prisma.importRun.findMany({
      where: { status: { in: ['SUCCEEDED', 'PARTIAL'] }, storeChainId: { in: chains.map((c) => c.id) } },
      orderBy: { finishedAt: 'desc' },
      distinct: ['storeChainId'],
      select: { storeChainId: true, finishedAt: true, source: true, offersUpserted: true, termsReviewed: true },
    });
    const runByChain = new Map(runs.map((run) => [run.storeChainId, run]));

    const entries = chains.map((chain) => {
      const run = runByChain.get(chain.id);
      const hasData = !!run && run.offersUpserted > 0;
      return {
        slug: chain.slug,
        name: chain.name,
        hasData,
        lastObservedAt: run?.finishedAt?.toISOString() ?? null,
        sourceKind: run?.source ?? null,
        termsReviewed: run?.termsReviewed ?? false,
      };
    });

    const withData = entries.filter((entry) => entry.hasData).length;
    return {
      chainsRequested: entries.length,
      chainsWithData: withData,
      chains: entries,
      summary:
        entries.length === 0
          ? 'Geen supermarkten geselecteerd.'
          : withData === entries.length
            ? `Prijzen van alle ${entries.length} geselecteerde supermarkten zijn gecontroleerd.`
            : `Prijzen van ${withData} van de ${entries.length} geselecteerde supermarkten zijn gecontroleerd.`,
    };
  }

  /** Prijsgeschiedenis van een canoniek product over `days` dagen, over alle ketens. */
  async historySummary(productId: string, days = 90, now: Date = new Date()): Promise<PriceHistorySummary> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const rows = await this.prisma.priceHistory.findMany({
      where: { storeProduct: { catalogProductId: productId }, observedAt: { gte: since } },
      include: { storeChain: { select: { slug: true } } },
      orderBy: { observedAt: 'asc' },
      take: 2000,
    });

    const points = rows.map((row) => ({
      observedAt: row.observedAt.toISOString(),
      storeChainSlug: row.storeChain.slug,
      storeLocationId: row.storeLocationId,
      priceCents: row.priceCents,
      originalPriceCents: row.originalPriceCents,
      unitPriceCents: row.unitPriceCents,
      promotionType: row.promotionType,
      sourceKind: row.source,
    }));

    const prices = points.map((p) => p.priceCents);
    const distinctDays = new Set(points.map((p) => p.observedAt.slice(0, 10))).size;
    // Minstens drie metingen op minstens twee dagen; anders is een "laagste prijs" misleidend.
    const sufficient = points.length >= 3 && distinctDays >= 2;

    const promotionPeriods: PriceHistorySummary['promotionPeriods'] = [];
    const openPeriods = new Map<string, { from: string; to: string; promotionType: PriceHistoryRowPromotion; storeChainSlug: string }>();
    for (const point of points) {
      const key = `${point.storeChainSlug}:${point.storeLocationId ?? '-'}`;
      const open = openPeriods.get(key);
      if (point.promotionType !== 'NONE') {
        if (open && open.promotionType === point.promotionType) {
          open.to = point.observedAt;
        } else {
          if (open) promotionPeriods.push(open);
          openPeriods.set(key, { from: point.observedAt, to: point.observedAt, promotionType: point.promotionType, storeChainSlug: point.storeChainSlug });
        }
      } else if (open) {
        promotionPeriods.push(open);
        openPeriods.delete(key);
      }
    }
    promotionPeriods.push(...openPeriods.values());

    const last = points.at(-1) ?? null;
    const previous = points.length >= 2 ? points.at(-2)! : null;

    return {
      sufficient,
      periodDays: days,
      currentCents: last?.priceCents ?? null,
      previousCents: previous?.priceCents ?? null,
      lowestCents: sufficient ? Math.min(...prices) : null,
      highestCents: sufficient ? Math.max(...prices) : null,
      averageCents: sufficient ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : null,
      points,
      promotionPeriods,
      disclaimer: HISTORY_DISCLAIMER,
    };
  }
}

type PriceHistoryRowPromotion = PriceHistorySummary['points'][number]['promotionType'];

/**
 * Volledige productomschrijving voor zinnen en meldingen: "Coca-Cola Zero 1,5 l",
 * "Boni Halfvolle melk 1 l". Het merk komt alleen vooraan als het nog niet in de naam zit.
 */
export function productLabel(product: Pick<CatalogProductSummary, 'name' | 'brand' | 'packageLabel'>): string {
  const brandPrefix = product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : '';
  const label = `${brandPrefix}${product.name}`;
  return product.packageLabel === 'Inhoud onbekend' ? label : `${label} ${product.packageLabel}`;
}

/** Leesbare inhoud: "1,5 l", "6 × 33 cl", "12 stuks" of "Inhoud onbekend". */
export function packageLabelOf(row: Pick<ProductRow, 'packageQuantity' | 'packageUnit' | 'packCount' | 'normalizedQuantity' | 'normalizedUnit'>): string {
  if (row.normalizedQuantity === null || row.normalizedUnit === null) return 'Inhoud onbekend';

  const perPackage = row.packCount > 1 ? Math.round(row.normalizedQuantity / row.packCount) : row.normalizedQuantity;
  const single = formatBaseQuantity({ amount: perPackage, unit: row.normalizedUnit });
  return row.packCount > 1 ? `${row.packCount} × ${single}` : single;
}

/** Valideert de opgeslagen JSON opnieuw: wat in de database staat, is ooit externe invoer geweest. */
export function parseRule(value: Prisma.JsonValue | null): PromotionRuleInput | null {
  if (value === null || value === undefined) return null;
  const parsed = promotionRuleSchema.safeParse(value);
  return parsed.success && parsed.data.kind !== 'NONE' ? parsed.data : null;
}
