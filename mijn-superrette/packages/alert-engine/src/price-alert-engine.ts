import { DAY_MS, type Cents } from '@superrette/shared';
import type { EffectivePrice } from '@superrette/pricing-engine';

export interface PriceAlertState {
  id: string;
  productId: string;
  /** null = any retailer the user follows. */
  retailerId: string | null;
  targetPriceCents: Cents | null;
  promotionOnly: boolean;
  enabled: boolean;
  /** Armed alerts fire on the next satisfying price. Firing disarms; an unsatisfied price re-arms. */
  armed: boolean;
  lastTriggeredAt: Date | null;
  lastTriggeredPriceCents: Cents | null;
}

/** Current price of the alert's product at one retailer (quantity 1). */
export interface AlertOffer {
  retailerId: string;
  retailerName: string;
  retailerProductId: string;
  price: EffectivePrice;
  /** A promotion is active for this offer (shelf promo or mechanic). */
  isPromotion: boolean;
}

export type AlertDecision =
  | {
      action: 'TRIGGER';
      offer: AlertOffer;
      priceCents: Cents;
      /** Idempotency key: the same alert never fires twice for the same offer+price. */
      dedupeKey: string;
      reason: 'TARGET_PRICE' | 'PROMOTION' | 'TARGET_PRICE_AND_PROMOTION' | 'FURTHER_DROP';
    }
  | { action: 'REARM' }
  | { action: 'NONE'; reason: 'DISABLED' | 'NOT_SATISFIED' | 'ALREADY_NOTIFIED' | 'COOLDOWN' | 'NO_OFFERS' };

export interface AlertEngineOptions {
  now: Date;
  /** Minimum time between two notifications of the same alert. */
  cooldownMs?: number;
  /** While disarmed, notify again only when the price drops by at least this much. */
  furtherDropCents?: Cents;
}

/** The price a shopper pays for one unit right now. */
const unitPriceOf = (o: AlertOffer): Cents => Math.round(o.price.perItemCents);

/**
 * PriceAlertEngine decides whether a price alert should notify the user.
 * Pure and deterministic; persistence and delivery live in the API/worker.
 *
 * Duplicate protection:
 *  - an alert fires once when its condition becomes true, then disarms;
 *  - it re-arms only after the condition has been false again;
 *  - while disarmed it may fire again only for a meaningful further drop
 *    and never within the cooldown window;
 *  - every trigger carries a dedupe key stored with a unique constraint.
 */
export const PriceAlertEngine = {
  isSatisfied(alert: PriceAlertState, offer: AlertOffer): boolean {
    const priceOk = alert.targetPriceCents == null || unitPriceOf(offer) <= alert.targetPriceCents;
    const promoOk = !alert.promotionOnly || offer.isPromotion;
    return priceOk && promoOk;
  },

  evaluate(alert: PriceAlertState, offers: readonly AlertOffer[], options: AlertEngineOptions): AlertDecision {
    if (!alert.enabled) return { action: 'NONE', reason: 'DISABLED' };
    const relevant = offers.filter((o) => alert.retailerId == null || o.retailerId === alert.retailerId);
    if (relevant.length === 0) return { action: 'NONE', reason: 'NO_OFFERS' };

    const satisfying = relevant
      .filter((o) => this.isSatisfied(alert, o))
      .sort((a, b) => unitPriceOf(a) - unitPriceOf(b) || a.retailerId.localeCompare(b.retailerId));
    const best = satisfying[0];

    if (!best) {
      return alert.armed ? { action: 'NONE', reason: 'NOT_SATISFIED' } : { action: 'REARM' };
    }

    const priceCents = unitPriceOf(best);
    const dedupeKey = `${alert.id}:${best.retailerProductId}:${priceCents}:${best.isPromotion ? 'promo' : 'regular'}`;
    const cooldown = options.cooldownMs ?? DAY_MS;
    const inCooldown =
      alert.lastTriggeredAt != null && options.now.getTime() - alert.lastTriggeredAt.getTime() < cooldown;

    const baseReason =
      alert.targetPriceCents != null && alert.promotionOnly
        ? 'TARGET_PRICE_AND_PROMOTION'
        : alert.targetPriceCents != null
          ? 'TARGET_PRICE'
          : 'PROMOTION';

    if (alert.armed) {
      if (inCooldown) return { action: 'NONE', reason: 'COOLDOWN' };
      return { action: 'TRIGGER', offer: best, priceCents, dedupeKey, reason: baseReason };
    }

    const furtherDrop = options.furtherDropCents ?? 10;
    if (alert.lastTriggeredPriceCents != null && priceCents <= alert.lastTriggeredPriceCents - furtherDrop) {
      if (inCooldown) return { action: 'NONE', reason: 'COOLDOWN' };
      return { action: 'TRIGGER', offer: best, priceCents, dedupeKey, reason: 'FURTHER_DROP' };
    }
    return { action: 'NONE', reason: 'ALREADY_NOTIFIED' };
  },

  /** State after a decision has been persisted. */
  nextState(alert: PriceAlertState, decision: AlertDecision, now: Date): PriceAlertState {
    if (decision.action === 'TRIGGER') {
      return { ...alert, armed: false, lastTriggeredAt: now, lastTriggeredPriceCents: decision.priceCents };
    }
    if (decision.action === 'REARM') return { ...alert, armed: true };
    return alert;
  },
};
