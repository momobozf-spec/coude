import { Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Query } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { searchHistory, searchStats, type Database } from '@superrette/database';
import { normalizeGtin, normalizeText } from '@superrette/shared';
import {
  autocompleteQuerySchema,
  searchQuerySchema,
  type ProductSummaryDto,
  type SearchQuery,
  type SearchResponse,
} from '@superrette/validation';
import { CurrentUser, OptionalUser, Public, type AuthUser } from '../common/auth.js';
import { CacheService } from '../common/cache.service.js';
import { CatalogService, EntitlementsService, NormalizerService, ShopperContextService, type ShopperContext } from '../common/core.services.js';
import { entitlementRequired } from '../common/errors.js';
import { CACHE, DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

export interface RankedVariant {
  variantId: string;
  /** Share of the query's canonical tokens found on the product (0..1). */
  tokenRatio: number;
  similarity: number;
  score: number;
}

const ADVANCED_FILTERS: (keyof SearchQuery)[] = ['brands', 'dietary', 'minSize', 'maxSize', 'maxPriceCents'];

/**
 * Product search on PostgreSQL:
 *  - canonical tokens (NL/FR/EN synonyms: "lait demi-écrémé" → melk+halfvol)
 *  - pg_trgm similarity for typos ("halvolle melk") and partial words ("kipfil")
 *  - GIN indexes on tokens and search_text keep it fast
 * Pricing, filtering and sorting then use the PricingEngine via CatalogService.
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CACHE) private readonly cache: CacheService,
    private readonly catalog: CatalogService,
    private readonly normalizers: NormalizerService,
  ) {}

  async rank(query: string, limit = 60): Promise<{ tokens: string[]; ranked: RankedVariant[] }> {
    const text = normalizeText(query);
    const gtin = /^\d{8,14}$/.test(text.replace(/\s/g, '')) ? normalizeGtin(text) : null;
    if (gtin) {
      const rows = await this.db.execute<{ variant_id: string }>(sql`SELECT variant_id FROM catalog.product_barcodes WHERE gtin = ${gtin}`);
      return { tokens: [gtin], ranked: rows.rows.map((r) => ({ variantId: r.variant_id, tokenRatio: 1, similarity: 1, score: 10 })) };
    }
    const normalizer = await this.normalizers.get();
    const tokens = normalizer.canonicalizeText(query);
    const origins = this.catalog.origins;
    const tokenArray = tokens.length > 0 ? sql`ARRAY[${sql.join(tokens.map((t) => sql`${t}`), sql`, `)}]::text[]` : sql`ARRAY[]::text[]`;
    const originArray = sql`ARRAY[${sql.join(origins.map((o) => sql`${o}`), sql`, `)}]::catalog.data_origin[]`;
    const prefixes = text.split(' ').filter((w) => w.length >= 3);
    const prefixClause = prefixes.length > 0 ? sql.join(prefixes.map((w) => sql`v.search_text ILIKE ${`%${w}%`}`), sql` AND `) : sql`false`;

    const rows = await this.db.execute<{ id: string; token_hits: number; sim: number; wsim: number }>(sql`
      SELECT v.id,
             cardinality(ARRAY(SELECT unnest(v.tokens) INTERSECT SELECT unnest(${tokenArray}))) AS token_hits,
             similarity(v.search_text, ${text}) AS sim,
             word_similarity(${text}, v.search_text) AS wsim
      FROM catalog.product_variants v
      WHERE v.data_origin = ANY(${originArray})
        AND (v.tokens && ${tokenArray} OR v.search_text % ${text} OR ${text} <% v.search_text OR (${prefixClause}))
      ORDER BY token_hits DESC, wsim DESC, sim DESC
      LIMIT ${limit * 2}
    `);
    const ranked = rows.rows
      .map((r) => {
        const tokenRatio = tokens.length > 0 ? Number(r.token_hits) / tokens.length : 0;
        const similarity = Math.max(Number(r.sim), Number(r.wsim));
        return { variantId: r.id, tokenRatio, similarity, score: 2 * tokenRatio + similarity };
      })
      // Keep results that match the meaning (tokens) or closely resemble the text (typos).
      .filter((r) => r.tokenRatio >= 0.5 || r.similarity >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { tokens, ranked };
  }

  /** "Bedoelde je …?" — closest known vocabulary word per query word. */
  async suggest(query: string): Promise<string | null> {
    const words = normalizeText(query).split(' ').filter((w) => w.length >= 3);
    if (words.length === 0) return null;
    const corrected: string[] = [];
    let changed = false;
    for (const word of words) {
      const r = await this.db.execute<{ word: string; sim: number }>(sql`
        SELECT w AS word, similarity(w, ${word}) AS sim
        FROM (SELECT DISTINCT unnest(regexp_split_to_array(search_text, ' ')) AS w FROM catalog.product_variants) words
        WHERE length(w) >= 3 AND w % ${word}
        ORDER BY sim DESC LIMIT 1
      `);
      const best = r.rows[0];
      if (best && best.word !== word && Number(best.sim) >= 0.4) {
        corrected.push(best.word);
        changed = true;
      } else corrected.push(word);
    }
    return changed ? corrected.join(' ') : null;
  }

  async search(q: SearchQuery, shopper: ShopperContext): Promise<SearchResponse> {
    const key = `search:${JSON.stringify(q)}:${shopper.retailerIds.join(',')}:${shopper.loyaltyPrograms.join(',')}`;
    return this.cache.wrap(key, 60, async () => {
      const { tokens, ranked } = await this.rank(q.q);
      const retailerFilter = q.retailers && q.retailers.length > 0 ? q.retailers : undefined;
      const [basics, offers] = await Promise.all([
        this.catalog.basics(ranked.map((r) => r.variantId)),
        this.catalog.pricedOffers(ranked.map((r) => r.variantId), shopper, retailerFilter ? { retailerIds: retailerFilter } : {}),
      ]);
      let items: (ProductSummaryDto & { _score: number; _discount: number })[] = [];
      for (const r of ranked) {
        const b = basics.get(r.variantId);
        if (!b) continue;
        const o = offers.get(r.variantId) ?? [];
        if (retailerFilter && o.length === 0) continue;
        const summary = this.catalog.summary(b, o);
        const bestDiscount = Math.max(0, ...o.map((x) => x.price.discountPercent));
        items.push({ ...summary, _score: r.score, _discount: bestDiscount });
      }
      if (q.promotionOnly) items = items.filter((i) => i.cheapest?.isPromotion || i._discount > 0);
      if (q.brands?.length) {
        const wanted = new Set(q.brands.map((b) => b.toLowerCase()));
        items = items.filter((i) => i.brand && wanted.has(i.brand.toLowerCase()));
      }
      if (q.categories?.length) items = items.filter((i) => i.categorySlug && q.categories!.includes(i.categorySlug));
      if (q.dietary?.length) items = items.filter((i) => q.dietary!.every((d) => i.dietary.includes(d)));
      if (q.maxPriceCents != null) items = items.filter((i) => i.cheapest && i.cheapest.priceCents <= q.maxPriceCents!);
      if (q.minSize != null || q.maxSize != null) {
        items = items.filter((i) => {
          const b = basics.get(i.variantId);
          if (!b?.netAmount) return false;
          return (q.minSize == null || b.netAmount >= q.minSize) && (q.maxSize == null || b.netAmount <= q.maxSize);
        });
      }
      const priceKey = (i: ProductSummaryDto): number => i.cheapest?.priceCents ?? Number.POSITIVE_INFINITY;
      const unitKey = (i: ProductSummaryDto): number => i.cheapest?.unitPrice?.cents ?? Number.POSITIVE_INFINITY;
      switch (q.sort) {
        case 'lowest_price':
          items.sort((a, b) => priceKey(a) - priceKey(b));
          break;
        case 'lowest_unit_price':
          items.sort((a, b) => unitKey(a) - unitKey(b));
          break;
        case 'highest_discount':
          items.sort((a, b) => b._discount - a._discount);
          break;
        default:
          // Relevance first; products we can price rank above those we cannot.
          items.sort((a, b) => b._score - a._score || Number(b.cheapest != null) - Number(a.cheapest != null) || priceKey(a) - priceKey(b));
      }
      const total = items.length;
      const page = items.slice(q.offset, q.offset + q.limit).map(({ _score: _s, _discount: _d, ...rest }) => rest);
      return {
        query: q.q,
        interpretedTokens: tokens,
        total,
        items: page,
        suggestion: total === 0 ? await this.suggest(q.q) : null,
      };
    });
  }

  async autocomplete(prefix: string): Promise<string[]> {
    const text = normalizeText(prefix);
    const origins = this.catalog.origins;
    const originArray = sql`ARRAY[${sql.join(origins.map((o) => sql`${o}`), sql`, `)}]::catalog.data_origin[]`;
    return this.cache.wrap(`ac:${text}`, 300, async () => {
      const rows = await this.db.execute<{ name: string }>(sql`
        SELECT name FROM (
          SELECT DISTINCT ON (lower(v.display_name)) v.display_name AS name, word_similarity(${text}, v.search_text) AS ws
          FROM catalog.product_variants v
          WHERE v.data_origin = ANY(${originArray}) AND (v.search_text ILIKE ${`%${text}%`} OR ${text} <% v.search_text)
          ORDER BY lower(v.display_name), ws DESC
        ) s ORDER BY ws DESC, name LIMIT 8
      `);
      return rows.rows.map((r) => r.name);
    });
  }

  async record(userId: string | null, query: string): Promise<void> {
    const normalized = normalizeText(query).slice(0, 100);
    if (normalized.length < 2) return;
    // Anonymous aggregate for "populair" — no user id stored.
    await this.db
      .insert(searchStats)
      .values({ query: normalized, count: 1 })
      .onConflictDoUpdate({ target: searchStats.query, set: { count: sql`${searchStats.count} + 1`, lastSearchedAt: new Date() } });
    if (userId) await this.db.insert(searchHistory).values({ userId, query: query.trim().slice(0, 100) });
  }

  async recent(userId: string): Promise<string[]> {
    const rows = await this.db.select({ query: searchHistory.query }).from(searchHistory).where(eq(searchHistory.userId, userId)).orderBy(desc(searchHistory.createdAt)).limit(30);
    return [...new Set(rows.map((r) => r.query))].slice(0, 10);
  }

  async clearRecent(userId: string): Promise<void> {
    await this.db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  async popular(): Promise<string[]> {
    const rows = await this.db.select({ query: searchStats.query }).from(searchStats).orderBy(desc(searchStats.count)).limit(10);
    return rows.map((r) => r.query);
  }
}

@Controller('v1/search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly shoppers: ShopperContextService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Public()
  @Get()
  async find(@Query(new ZodPipe(searchQuerySchema)) query: SearchQuery, @OptionalUser() user: AuthUser | null): Promise<SearchResponse> {
    if (ADVANCED_FILTERS.some((f) => query[f] !== undefined && !(Array.isArray(query[f]) && (query[f] as unknown[]).length === 0))) {
      if (!user) throw entitlementRequired('advanced_filters');
      await this.entitlements.require(user.id, 'advanced_filters');
    }
    const shopper = await this.shoppers.get(user?.id ?? null);
    const result = await this.search.search(query, shopper);
    if (query.offset === 0) void this.search.record(user?.id ?? null, query.q).catch(() => undefined);
    return result;
  }

  @Public()
  @Get('autocomplete')
  autocomplete(@Query(new ZodPipe(autocompleteQuerySchema)) query: { q: string }): Promise<string[]> {
    return this.search.autocomplete(query.q);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.search.recent(user.id);
  }

  @Delete('recent')
  @HttpCode(204)
  async clearRecent(@CurrentUser() user: AuthUser): Promise<void> {
    await this.search.clearRecent(user.id);
  }

  @Public()
  @Get('popular')
  popular(): Promise<string[]> {
    return this.search.popular();
  }
}

@Module({ controllers: [SearchController], providers: [SearchService], exports: [SearchService] })
export class SearchModule {}
