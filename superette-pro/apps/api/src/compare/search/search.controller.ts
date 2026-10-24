import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  promotionsQuerySchema,
  reportMatchSchema,
  searchQuerySchema,
  slugListSchema,
  type PriceHistorySummary,
  type ProductDetail,
  type PromotionsQuery,
  type ReportMatchInput,
  type SearchQuery,
  type SearchResponse,
  type SessionUser,
} from '@superette/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CompareCatalogService } from '../catalog/compare-catalog.service';
import { SearchService } from './search.service';

const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((value) => value === true || value === 'true' || value === '1');

const productDetailQuerySchema = z.object({
  chains: slugListSchema,
  includePersonalized: booleanQuery,
  includeOnline: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => value === undefined || value === true || value === 'true' || value === '1'),
  loyaltyCard: z.enum(['ANY', 'REQUIRED', 'NOT_REQUIRED']).default('ANY'),
});

const idSchema = z.string().regex(/^[a-z0-9]{10,40}$/i, 'Ongeldig id');

/**
 * Zoeken en prijzen bekijken kan zonder account. Een match melden niet:
 * dat is een gebruikersactie die we aan iemand moeten kunnen toeschrijven.
 */
@Controller('compare')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly catalog: CompareCatalogService,
  ) {}

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  find(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery): Promise<SearchResponse> {
    return this.search.search(query);
  }

  @Get('promotions')
  promotions(@Query(new ZodValidationPipe(promotionsQuerySchema)) query: PromotionsQuery): Promise<SearchResponse> {
    return this.search.promotions(query);
  }

  @Get('products/:id')
  detail(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Query(new ZodValidationPipe(productDetailQuerySchema)) query: z.infer<typeof productDetailQuerySchema>,
  ): Promise<ProductDetail> {
    return this.search.productDetail(id, {
      chainSlugs: query.chains,
      includePersonalized: query.includePersonalized,
      includeOnline: query.includeOnline,
      loyalty: query.loyaltyCard,
    });
  }

  @Get('products/:id/history')
  history(@Param('id', new ZodValidationPipe(idSchema)) id: string): Promise<PriceHistorySummary> {
    return this.catalog.historySummary(id);
  }

  @Post('products/:id/report-match')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reportMatch(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(reportMatchSchema)) input: ReportMatchInput,
  ): Promise<{ reported: true }> {
    return this.search.reportMatch(user.id, id, input);
  }
}
