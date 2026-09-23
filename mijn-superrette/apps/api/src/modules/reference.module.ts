import { Controller, Get, Inject, Module, Query } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { countries, retailerCountries, retailers, type Database } from '@superrette/database';
import type { Locale } from '@superrette/domain';
import type { ProviderRegistry } from '@superrette/store-providers';
import type { CountryDto, RetailerDto } from '@superrette/validation';
import { Public } from '../common/auth.js';
import { DB, PROVIDERS } from '../common/tokens.js';

@Controller('v1')
export class ReferenceController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PROVIDERS) private readonly registry: ProviderRegistry,
  ) {}

  @Public()
  @Get('countries')
  async countries(): Promise<CountryDto[]> {
    const rows = await this.db
      .select()
      .from(countries)
      .where(eq(countries.isActive, true))
      .orderBy(asc(countries.code));
    return rows.map((c) => ({
      code: c.code,
      name: c.name,
      currency: c.currency,
      languages: c.languages as Locale[],
      defaultLocale: c.defaultLocale as Locale,
    }));
  }

  /** Retailers are data-driven: the apps never hard-code supermarkets. */
  @Public()
  @Get('retailers')
  async retailers(@Query('country') country?: string): Promise<RetailerDto[]> {
    const rows = await this.db
      .select({ r: retailers, country: retailerCountries.countryCode })
      .from(retailers)
      .innerJoin(retailerCountries, eq(retailerCountries.retailerId, retailers.id))
      .where(eq(retailers.isActive, true))
      .orderBy(asc(retailers.name));
    const byId = new Map<string, RetailerDto>();
    for (const { r, country: code } of rows) {
      const existing = byId.get(r.id);
      if (existing) {
        existing.countries.push(code);
        continue;
      }
      byId.set(r.id, {
        id: r.id,
        slug: r.slug,
        name: r.name,
        type: r.type,
        brandColor: r.brandColor,
        loyaltyProgram: r.loyaltyProgram,
        loyaltyProgramName: r.loyaltyProgramName,
        countries: [code],
        dataSupport: this.registry.supportFor(r.slug),
      });
    }
    const list = [...byId.values()];
    return country ? list.filter((r) => r.countries.includes(country.toUpperCase())) : list;
  }
}

@Module({ controllers: [ReferenceController] })
export class ReferenceModule {}
