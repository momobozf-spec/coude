/**
 * Zoeken, productdetail en promotie-overzicht.
 *
 * Zoeken is bewust eenvoudig en deterministisch: woorden uit de zoekterm
 * moeten voorkomen in de genormaliseerde naam of het merk, een hoeveelheid
 * in de zoekterm ("1,5 l") filtert op inhoud per verpakking. Geen AI, geen
 * fuzzy-magie — wat gevonden wordt, is uitlegbaar.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ProductDetail,
  ProductOffer,
  PromotionsQuery,
  RelatedProduct,
  ReportMatchInput,
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  SearchSort,
} from '@superette/contracts';
import { parseQuantityLabel, toBaseQuantity } from '@superette/pricing';
import { PrismaService } from '../../prisma/prisma.service';
import { CompareCatalogService, type OfferFilter } from '../catalog/compare-catalog.service';
import { normalizeBrand, normalizeText, stripQuantityTokens, tokenSimilarity } from '../matching/product-matcher';

/** Woorden die een intentie uitdrukken, geen product: "goedkoopste olijfolie". */
const INTENT_WORDS = new Set(['goedkoopste', 'goedkoop', 'goedkope', 'beste', 'prijs', 'prijzen', 'promo', 'promotie', 'aanbieding', 'moins', 'cher', 'cheap', 'cheapest']);

const CANDIDATE_LIMIT = 300;

function rank(offer: ProductOffer, sort: SearchSort): number {
  switch (sort) {
    case 'UNIT_PRICE':
      return offer.unitPrice?.cents ?? Number.MAX_SAFE_INTEGER;
    case 'PACKAGE_PRICE':
    case 'STORE':
    case 'RELEVANCE':
      return offer.priceCents;
    case 'DISCOUNT':
      return -(offer.discountPercentage ?? 0);
  }
}

/** Het beste aanbod volgens de sortering; bij gelijke stand de laagste verpakkingsprijs. */
export function pickBestOffer(offers: readonly ProductOffer[], sort: SearchSort): ProductOffer | null {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => rank(a, sort) - rank(b, sort) || a.priceCents - b.priceCents)[0]!;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CompareCatalogService,
  ) {}

  async search(query: SearchQuery, now: Date = new Date()): Promise<SearchResponse> {
    const quantity = parseQuantityLabel(query.q);
    const text = normalizeText(stripQuantityTokens(query.q));
    const tokens = text.split(' ').filter((token) => token.length > 0 && !INTENT_WORDS.has(token));

    const where: Prisma.CatalogProductWhereInput = {
      active: true,
      AND: tokens.map((token) => ({
        OR: [{ normalizedName: { contains: token } }, { normalizedBrand: { contains: token } }, { name: { contains: token, mode: 'insensitive' } }],
      })),
      ...(query.brand ? { normalizedBrand: normalizeBrand(query.brand) ?? undefined } : {}),
      ...(query.brandType ? { brandType: query.brandType } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.unit ? { normalizedUnit: query.unit } : {}),
    };

    let rows = await this.prisma.catalogProduct.findMany({ where, include: { category: true }, take: CANDIDATE_LIMIT, orderBy: { name: 'asc' } });

    // "Coca-Cola Zero 1,5 L": alleen verpakkingen van 1,5 l (per enkele verpakking).
    if (quantity) {
      const base = toBaseQuantity(quantity.quantity, quantity.unit);
      if (base) {
        rows = rows.filter(
          (row) =>
            row.normalizedUnit === base.unit &&
            row.normalizedQuantity !== null &&
            Math.round(row.normalizedQuantity / row.packCount) === base.amount &&
            (quantity.packCount === 1 || row.packCount === quantity.packCount),
        );
      }
    }

    const filter: OfferFilter = {
      chainSlugs: query.chains,
      includePersonalized: query.includePersonalized,
      includeOnline: query.includeOnline,
      loyalty: query.loyaltyCard,
      onlyPromotions: query.onlyPromotions,
      ...(query.availability ? { availability: query.availability } : {}),
      ...(query.maxPriceCents !== undefined ? { maxPriceCents: query.maxPriceCents } : {}),
    };
    const offersByProduct = await this.catalog.offersByProduct(
      rows.map((row) => row.id),
      filter,
      now,
    );

    const items: SearchResultItem[] = [];
    for (const row of rows) {
      const offers = offersByProduct.get(row.id) ?? [];
      if (offers.length === 0) continue;

      const summary = this.catalog.productSummary(row);
      items.push({
        product: summary,
        matchType: 'EXACT',
        matchConfidence: 1,
        offers,
        bestOffer: pickBestOffer(offers, query.sort),
        warning: summary.normalizedUnit === null ? 'Geen eenheidsprijs: de inhoud van de verpakking is onbekend' : null,
      });
    }

    const relevance = new Map(items.map((item) => [item.product.id, tokenSimilarity(`${item.product.brand ?? ''} ${item.product.name}`.toLowerCase(), text)]));
    items.sort((a, b) => {
      switch (query.sort) {
        case 'STORE':
          return (a.bestOffer?.storeChain.name ?? '').localeCompare(b.bestOffer?.storeChain.name ?? '') || (a.bestOffer?.priceCents ?? 0) - (b.bestOffer?.priceCents ?? 0);
        case 'RELEVANCE':
          return (relevance.get(b.product.id) ?? 0) - (relevance.get(a.product.id) ?? 0) || (a.bestOffer?.unitPrice?.cents ?? Number.MAX_SAFE_INTEGER) - (b.bestOffer?.unitPrice?.cents ?? Number.MAX_SAFE_INTEGER);
        default:
          return rank(a.bestOffer!, query.sort) - rank(b.bestOffer!, query.sort) || a.bestOffer!.priceCents - b.bestOffer!.priceCents;
      }
    });

    const start = (query.page - 1) * query.pageSize;
    const pageItems = items.slice(start, start + query.pageSize);

    return {
      query: query.q,
      items: pageItems,
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      coverage: await this.catalog.coverage(query.chains),
      containsDemoData: pageItems.some((item) => item.offers.some((offer) => offer.provenance.isDemo)),
    };
  }

  async productDetail(productId: string, filter: OfferFilter, now: Date = new Date()): Promise<ProductDetail> {
    const row = await this.prisma.catalogProduct.findUnique({ where: { id: productId }, include: { category: true } });
    if (!row || !row.active) throw new NotFoundException('Product niet gevonden');

    const { related, uncertainCount } = await this.catalog.related(productId);
    const offersByProduct = await this.catalog.offersByProduct([productId, ...related.map((r) => r.product.id)], filter, now);

    const offers = offersByProduct.get(productId) ?? [];
    const withOffers = (list: Array<Omit<RelatedProduct, 'offers'>>): RelatedProduct[] =>
      list
        .map((entry) => ({ ...entry, offers: offersByProduct.get(entry.product.id) ?? [] }))
        .filter((entry) => entry.offers.length > 0);

    const all = [offers, ...related.map((r) => offersByProduct.get(r.product.id) ?? [])].flat();

    return {
      product: { ...this.catalog.productSummary(row), description: row.description },
      offers,
      bestOffer: pickBestOffer(offers, 'UNIT_PRICE'),
      equivalents: withOffers(related.filter((r) => r.matchType === 'EQUIVALENT')),
      alternatives: withOffers(related.filter((r) => r.matchType === 'ALTERNATIVE' || (r.matchType === 'UNCERTAIN' && r.matchStatus === 'CONFIRMED'))),
      uncertainCount,
      history: await this.catalog.historySummary(productId, 90, now),
      coverage: await this.catalog.coverage(filter.chainSlugs),
      containsDemoData: all.some((offer) => offer.provenance.isDemo),
    };
  }

  /** Actuele aanbiedingen, gegroepeerd per product, goedkoopste korting eerst. */
  async promotions(query: PromotionsQuery, now: Date = new Date()): Promise<SearchResponse> {
    const rows = await this.prisma.productOffer.findMany({
      where: {
        active: true,
        promotionType: { not: 'NONE' },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        storeChain: { active: true, ...(query.chains.length > 0 ? { slug: { in: [...query.chains] } } : {}) },
        ...(query.includePersonalized ? {} : { isPersonalized: false }),
        storeProduct: { active: true, ...(query.category ? { catalogProduct: { category: { slug: query.category } } } : {}) },
      },
      select: { storeProduct: { select: { catalogProductId: true } } },
      distinct: ['storeProductId'],
      take: CANDIDATE_LIMIT,
    });

    const productIds = [...new Set(rows.map((row) => row.storeProduct.catalogProductId))];
    const products = await this.prisma.catalogProduct.findMany({ where: { id: { in: productIds }, active: true }, include: { category: true } });
    const offersByProduct = await this.catalog.offersByProduct(
      productIds,
      { chainSlugs: query.chains, includePersonalized: query.includePersonalized, includeOnline: true, loyalty: 'ANY', onlyPromotions: true },
      now,
    );

    const items: SearchResultItem[] = products
      .map((row) => {
        const offers = offersByProduct.get(row.id) ?? [];
        return {
          product: this.catalog.productSummary(row),
          matchType: 'EXACT' as const,
          matchConfidence: 1,
          offers,
          bestOffer: pickBestOffer(offers, 'DISCOUNT'),
          warning: null,
        };
      })
      .filter((item) => item.offers.length > 0)
      .sort((a, b) => (b.bestOffer?.discountPercentage ?? 0) - (a.bestOffer?.discountPercentage ?? 0) || a.product.name.localeCompare(b.product.name));

    const start = (query.page - 1) * query.pageSize;
    const pageItems = items.slice(start, start + query.pageSize);

    return {
      query: 'promoties',
      items: pageItems,
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
      sort: 'DISCOUNT',
      coverage: await this.catalog.coverage(query.chains),
      containsDemoData: pageItems.some((item) => item.offers.some((offer) => offer.provenance.isDemo)),
    };
  }

  /** Een gebruiker meldt een onjuiste match. Wordt bewaard voor de beheerfase; wijzigt niets automatisch. */
  async reportMatch(userId: string, productId: string, input: ReportMatchInput): Promise<{ reported: true }> {
    const match = await this.prisma.productMatch.findUnique({
      where: { productId_relatedProductId: { productId, relatedProductId: input.relatedProductId } },
      select: { id: true },
    });
    if (!match) throw new NotFoundException('Deze match bestaat niet');

    await this.prisma.productMatchReport.create({ data: { productMatchId: match.id, userId, reason: input.reason } });
    return { reported: true };
  }
}
