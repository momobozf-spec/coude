import { Controller, Get, HttpCode, Inject, Module, NotImplementedException, Post } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { planEntitlements, plans, type Database } from '@superrette/database';
import { Public } from '../common/auth.js';
import { DB } from '../common/tokens.js';

/**
 * Plans and entitlements are served from the database (server-configurable).
 *
 * Store purchase verification is NOT implemented yet. The intended flow
 * (see docs/DEPLOYMENT.md#subscriptions):
 *  - Apple: StoreKit 2 transaction id → App Store Server API "Get Transaction
 *    Info" (JWT signed with an App Store Connect key) + App Store Server
 *    Notifications V2 webhook (signed JWS, verified against Apple's chain).
 *  - Google: purchase token → Play Developer API purchases.subscriptionsv2.get,
 *    acknowledge within 3 days, Real-time developer notifications via Pub/Sub.
 * Until then these endpoints answer 501 and no paid entitlement can be granted
 * except through a MANUAL subscription row created by an operator.
 */
@Controller('v1')
export class SubscriptionsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Public()
  @Get('plans')
  async plans(): Promise<{ key: string; name: string; isDefault: boolean; entitlements: { key: string; enabled: boolean; limit: number | null }[] }[]> {
    const rows = await this.db.select().from(plans).orderBy(asc(plans.sortOrder));
    const grants = await this.db.select().from(planEntitlements);
    return rows.map((p) => ({
      key: p.key,
      name: p.name,
      isDefault: p.isDefault,
      entitlements: grants.filter((g) => g.planKey === p.key).map((g) => ({ key: g.entitlementKey, enabled: g.enabled, limit: g.limitValue })),
    }));
  }

  @Post('subscriptions/apple/verify')
  @HttpCode(501)
  apple(): never {
    throw new NotImplementedException({ code: 'NOT_IMPLEMENTED', message: 'App Store subscription verification is not implemented yet' });
  }

  @Post('subscriptions/google/verify')
  @HttpCode(501)
  google(): never {
    throw new NotImplementedException({ code: 'NOT_IMPLEMENTED', message: 'Google Play subscription verification is not implemented yet' });
  }
}

@Module({ controllers: [SubscriptionsController] })
export class SubscriptionsModule {}
