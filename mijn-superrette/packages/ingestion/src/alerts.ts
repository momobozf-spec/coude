import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  loadOffers,
  notifications,
  priceAlerts,
  priceAlertTriggers,
  productVariants,
  pushTokens,
  userRetailerPreferences,
  users,
  type Database,
} from '@superrette/database';
import { PriceAlertEngine, type AlertOffer, type PriceAlertState } from '@superrette/alert-engine';
import type { DataOrigin, Locale } from '@superrette/domain';
import { createTranslator, formatPrice, resolveLocale } from '@superrette/i18n';
import { PricingEngine } from '@superrette/pricing-engine';
import type { PushSender } from './push.js';

export interface AlertEvaluationOptions {
  now?: Date;
  origins: readonly DataOrigin[];
  push?: PushSender | null;
  cooldownMs?: number;
}

export interface AlertEvaluationReport {
  evaluated: number;
  triggered: number;
  rearmed: number;
  notificationIds: string[];
}

/**
 * Evaluate every enabled price alert on the given variants and deliver
 * notifications. Idempotent: the unique dedupe key on price_alert_triggers
 * guarantees an alert never notifies twice for the same offer and price, even
 * if two workers process the same import concurrently.
 */
export async function evaluatePriceAlerts(db: Database, variantIds: readonly string[], options: AlertEvaluationOptions): Promise<AlertEvaluationReport> {
  const report: AlertEvaluationReport = { evaluated: 0, triggered: 0, rearmed: 0, notificationIds: [] };
  if (variantIds.length === 0) return report;
  const now = options.now ?? new Date();

  const alerts = await db
    .select({
      alert: priceAlerts,
      locale: users.locale,
      countryCode: users.countryCode,
      productName: productVariants.displayName,
    })
    .from(priceAlerts)
    .innerJoin(users, eq(users.id, priceAlerts.userId))
    .innerJoin(productVariants, eq(productVariants.id, priceAlerts.variantId))
    .where(and(inArray(priceAlerts.variantId, [...variantIds]), eq(priceAlerts.enabled, true)));
  if (alerts.length === 0) return report;

  const offers = await loadOffers(db, { variantIds: [...new Set(alerts.map((a) => a.alert.variantId))], at: now, origins: options.origins });
  const userIds = [...new Set(alerts.map((a) => a.alert.userId))];
  const prefs = await db.select().from(userRetailerPreferences).where(inArray(userRetailerPreferences.userId, userIds));

  for (const { alert, locale, countryCode, productName } of alerts) {
    report.evaluated++;
    const myPrefs = prefs.filter((p) => p.userId === alert.userId);
    const followed = new Set(myPrefs.map((p) => p.retailerId));
    const loyaltyPrograms = offers
      .filter((o) => myPrefs.some((p) => p.retailerId === o.retailer.id && p.hasLoyaltyCard) && o.retailer.loyaltyProgram)
      .map((o) => o.retailer.loyaltyProgram!);

    const alertOffers: AlertOffer[] = offers
      .filter((o) => o.variantId === alert.variantId && o.retailerProduct.isAvailable)
      .filter((o) => alert.retailerId != null || followed.size === 0 || followed.has(o.retailer.id))
      .map((o) => {
        const price = PricingEngine.calculateEffectivePrice(o.offer, 1, { at: now, loyaltyPrograms });
        return {
          retailerId: o.retailer.id,
          retailerName: o.retailer.name,
          retailerProductId: o.retailerProduct.id,
          price,
          isPromotion: price.appliedPromotion !== null,
        };
      });

    const state: PriceAlertState = {
      id: alert.id,
      productId: alert.variantId,
      retailerId: alert.retailerId,
      targetPriceCents: alert.targetPriceCents,
      promotionOnly: alert.promotionOnly,
      enabled: alert.enabled,
      armed: alert.armed,
      lastTriggeredAt: alert.lastTriggeredAt,
      lastTriggeredPriceCents: alert.lastTriggeredPriceCents,
    };
    const decision = PriceAlertEngine.evaluate(state, alertOffers, { now, ...(options.cooldownMs != null ? { cooldownMs: options.cooldownMs } : {}) });

    if (decision.action === 'REARM') {
      await db.update(priceAlerts).set({ armed: true, updatedAt: now }).where(eq(priceAlerts.id, alert.id));
      report.rearmed++;
      continue;
    }
    if (decision.action !== 'TRIGGER') continue;

    const userLocale: Locale = resolveLocale(locale);
    const t = createTranslator(userLocale);
    const price = formatPrice(decision.priceCents, { locale: userLocale, country: countryCode });
    const title = t('alerts.notificationTitle');
    const body =
      decision.reason === 'PROMOTION'
        ? t('alerts.notificationPromoBody', { product: productName, price, retailer: decision.offer.retailerName })
        : t('alerts.notificationBody', { product: productName, price, retailer: decision.offer.retailerName });

    const notificationId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(priceAlertTriggers)
        .values({ alertId: alert.id, dedupeKey: decision.dedupeKey, retailerProductId: decision.offer.retailerProductId, priceCents: decision.priceCents, reason: decision.reason })
        .onConflictDoNothing()
        .returning({ id: priceAlertTriggers.id });
      if (inserted.length === 0) return null; // already delivered by another run
      const [n] = await tx
        .insert(notifications)
        .values({
          userId: alert.userId,
          type: 'PRICE_ALERT',
          title,
          body,
          data: { alertId: alert.id, variantId: alert.variantId, retailerId: decision.offer.retailerId, priceCents: decision.priceCents },
        })
        .returning({ id: notifications.id });
      await tx.update(priceAlertTriggers).set({ notificationId: n!.id }).where(eq(priceAlertTriggers.id, inserted[0]!.id));
      const next = PriceAlertEngine.nextState(state, decision, now);
      await tx
        .update(priceAlerts)
        .set({ armed: next.armed, lastTriggeredAt: next.lastTriggeredAt, lastTriggeredPriceCents: next.lastTriggeredPriceCents, updatedAt: now })
        .where(eq(priceAlerts.id, alert.id));
      return n!.id;
    });
    if (!notificationId) continue;
    report.triggered++;
    report.notificationIds.push(notificationId);

    if (options.push) {
      const tokens = await db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(and(eq(pushTokens.userId, alert.userId), isNull(pushTokens.disabledAt)));
      if (tokens.length > 0) {
        const result = await options.push.send(
          tokens.map((tk) => ({ to: tk.token, title, body, data: { type: 'PRICE_ALERT', notificationId, variantId: alert.variantId } })),
        );
        if (result.invalidTokens.length > 0) {
          await db.update(pushTokens).set({ disabledAt: now }).where(inArray(pushTokens.token, result.invalidTokens));
        }
        await db.update(notifications).set({ pushedAt: now }).where(eq(notifications.id, notificationId));
      }
    }
  }
  return report;
}
