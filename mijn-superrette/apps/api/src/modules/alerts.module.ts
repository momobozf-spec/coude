import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { priceAlerts, productVariants, retailers, type Database } from '@superrette/database';
import { PriceAlertEngine } from '@superrette/alert-engine';
import { createAlertSchema, updateAlertSchema, type CreateAlertInput, type PriceAlertDto } from '@superrette/validation';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { CatalogService, EntitlementsService, ShopperContextService } from '../common/core.services.js';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly shoppers: ShopperContextService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(userId: string): Promise<PriceAlertDto[]> {
    const rows = await this.db
      .select({ a: priceAlerts, productName: productVariants.displayName, retailerName: retailers.name })
      .from(priceAlerts)
      .innerJoin(productVariants, eq(productVariants.id, priceAlerts.variantId))
      .leftJoin(retailers, eq(retailers.id, priceAlerts.retailerId))
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));
    const shopper = await this.shoppers.get(userId);
    const offers = await this.catalog.pricedOffers([...new Set(rows.map((r) => r.a.variantId))], shopper);
    return rows.map(({ a, productName, retailerName }) => {
      const relevant = (offers.get(a.variantId) ?? []).filter((o) => !a.retailerId || o.row.retailer.id === a.retailerId);
      return {
        id: a.id,
        variantId: a.variantId,
        productName,
        retailerId: a.retailerId,
        retailerName,
        targetPriceCents: a.targetPriceCents,
        promotionOnly: a.promotionOnly,
        enabled: a.enabled,
        lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
        lastTriggeredPriceCents: a.lastTriggeredPriceCents,
        currentBestPriceCents: relevant[0] ? Math.round(relevant[0].price.perItemCents) : null,
      };
    });
  }

  /**
   * Create an alert. If the condition is already met right now, the alert
   * starts disarmed (the user can see the current price on screen), so it only
   * notifies on a further drop or after the price has gone back up.
   */
  async create(userId: string, input: CreateAlertInput): Promise<PriceAlertDto> {
    const [{ value: active } = { value: 0 }] = await this.db.select({ value: count() }).from(priceAlerts).where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.enabled, true)));
    await this.entitlements.requireWithinLimit(userId, 'price_alerts', active);
    const [variant] = await this.db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, input.variantId));
    if (!variant) throw notFound('Product');

    const shopper = await this.shoppers.get(userId);
    const offers = (await this.catalog.pricedOffers([input.variantId], shopper)).get(input.variantId) ?? [];
    const state = {
      id: 'new',
      productId: input.variantId,
      retailerId: input.retailerId ?? null,
      targetPriceCents: input.targetPriceCents ?? null,
      promotionOnly: input.promotionOnly,
      enabled: true,
      armed: true,
      lastTriggeredAt: null,
      lastTriggeredPriceCents: null,
    };
    const satisfiedNow = offers
      .filter((o) => !state.retailerId || o.row.retailer.id === state.retailerId)
      .map((o) => ({ retailerId: o.row.retailer.id, retailerName: o.row.retailer.name, retailerProductId: o.row.retailerProduct.id, price: o.price, isPromotion: o.price.appliedPromotion !== null }))
      .filter((o) => PriceAlertEngine.isSatisfied(state, o))
      .sort((a, b) => a.price.perItemCents - b.price.perItemCents)[0];

    const [row] = await this.db
      .insert(priceAlerts)
      .values({
        userId,
        variantId: input.variantId,
        retailerId: input.retailerId ?? null,
        targetPriceCents: input.targetPriceCents ?? null,
        promotionOnly: input.promotionOnly,
        armed: !satisfiedNow,
        lastTriggeredPriceCents: satisfiedNow ? Math.round(satisfiedNow.price.perItemCents) : null,
      })
      .returning({ id: priceAlerts.id });
    return (await this.list(userId)).find((a) => a.id === row!.id)!;
  }

  async update(userId: string, id: string, input: UpdateAlertInput): Promise<PriceAlertDto> {
    const result = await this.db
      .update(priceAlerts)
      .set({
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.targetPriceCents !== undefined ? { targetPriceCents: input.targetPriceCents, armed: true } : {}),
        ...(input.promotionOnly !== undefined ? { promotionOnly: input.promotionOnly } : {}),
        ...(input.retailerId !== undefined ? { retailerId: input.retailerId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });
    if (result.length === 0) throw notFound('Price alert');
    return (await this.list(userId)).find((a) => a.id === id)!;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.delete(priceAlerts).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));
  }
}

@Controller('v1/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PriceAlertDto[]> {
    return this.alerts.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createAlertSchema)) body: CreateAlertInput): Promise<PriceAlertDto> {
    return this.alerts.create(user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateAlertSchema)) body: UpdateAlertInput): Promise<PriceAlertDto> {
    return this.alerts.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.alerts.remove(user.id, id);
  }
}

@Module({ controllers: [AlertsController], providers: [AlertsService] })
export class AlertsModule {}
