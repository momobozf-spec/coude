import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import type { CatalogCategory, Coverage, SourceStatus, StoreChain, StoreLocation } from '@superette/contracts';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CompareConfig } from '../compare-config';
import { coordinatesForPostalCode } from '../geo/geo';
import { CompareCatalogService } from './compare-catalog.service';

const slugSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Ongeldige slug');
const locationsQuerySchema = z.object({
  postalCode: z.string().regex(/^[1-9]\d{3}$/).optional(),
  city: z.string().trim().max(80).optional(),
});
/** Met een postcode krijgt elke keten de afstand tot haar dichtstbijzijnde filiaal. */
const chainsQuerySchema = z.object({
  postalCode: z.string().regex(/^[1-9]\d{3}$/).optional(),
});

/**
 * De status van een keten bepaalt de API, nooit de app.
 *
 * LIVE vereist alles tegelijk: een geslaagde import, een bron die geen demo
 * is, een bron die haar voorwaarden nagekeken verklaart, en gegevens die
 * binnen de versheidsgrens vallen. Ontbreekt één voorwaarde, dan is de keten
 * dat niet — hoe echt de prijzen er ook uitzien.
 */
export function sourceStatusOf(entry: Coverage['chains'][number], freshHours: number, now: Date): SourceStatus {
  if (!entry.hasData || !entry.lastObservedAt) return 'UNAVAILABLE';
  if (entry.sourceKind === 'DEMO') return 'DEMO';
  const ageHours = (now.getTime() - new Date(entry.lastObservedAt).getTime()) / 3_600_000;
  if (ageHours > freshHours) return 'STALE';
  if (!entry.termsReviewed) return 'UNVERIFIED';
  return 'LIVE';
}

/** Supermarkten, filialen en categorieën. Publiek: je moet kunnen kiezen vóór je inlogt. */
@Controller('compare')
export class ChainsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CompareCatalogService,
    private readonly config: CompareConfig,
  ) {}

  @Get('chains')
  async chains(@Query(new ZodValidationPipe(chainsQuerySchema)) query: z.infer<typeof chainsQuerySchema>): Promise<StoreChain[]> {
    const rows = await this.catalog.chains();
    const coverage = await this.catalog.coverage(rows.map((row) => row.slug));
    const bySlug = new Map(coverage.chains.map((entry) => [entry.slug, entry]));
    const now = new Date();
    const origin = coordinatesForPostalCode(query.postalCode);
    const nearest = origin ? await this.catalog.nearestLocations(origin, rows.map((row) => row.id)) : null;

    return rows.map((row) => {
      const entry = bySlug.get(row.slug);
      const sourceStatus = entry ? sourceStatusOf(entry, this.config.freshHours, now) : 'UNAVAILABLE';
      const near = nearest?.get(row.id) ?? null;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: row.logoUrl,
        websiteUrl: row.websiteUrl,
        loyaltyCardName: row.loyaltyCardName,
        active: row.active,
        sortOrder: row.sortOrder,
        dataSourceKind: entry?.sourceKind ?? null,
        lastImportedAt: entry?.lastObservedAt ?? null,
        sourceStatus,
        isLive: sourceStatus === 'LIVE',
        distanceKm: near?.distanceKm ?? null,
        nearestLocation: near ? { id: near.location.id, name: near.location.name, city: near.location.city, postalCode: near.location.postalCode } : null,
      };
    });
  }

  @Get('chains/:slug/locations')
  async locations(
    @Param('slug', new ZodValidationPipe(slugSchema)) slug: string,
    @Query(new ZodValidationPipe(locationsQuerySchema)) query: z.infer<typeof locationsQuerySchema>,
  ): Promise<StoreLocation[]> {
    const chain = await this.prisma.storeChain.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!chain || !chain.active) throw new NotFoundException('Supermarkt niet gevonden');

    const rows = await this.prisma.storeLocation.findMany({
      where: {
        storeChainId: chain.id,
        active: true,
        ...(query.postalCode ? { postalCode: query.postalCode } : {}),
        ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
      take: 200,
    });

    return rows.map((row) => ({
      id: row.id,
      storeChainId: row.storeChainId,
      name: row.name,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      serviceArea: row.serviceArea,
      active: row.active,
    }));
  }

  @Get('categories')
  async categories(): Promise<CatalogCategory[]> {
    const rows = await this.prisma.catalogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameNl: 'asc' }] });
    return rows.map((row) => ({ id: row.id, slug: row.slug, nameNl: row.nameNl, nameFr: row.nameFr, parentId: row.parentId, sortOrder: row.sortOrder }));
  }
}
