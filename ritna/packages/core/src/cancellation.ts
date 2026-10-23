import { applyBps, type Bps, type Cents } from './money.js';
import type { RideStatus } from './ride-status.js';

/**
 * Annuleringsvoorwaarden per vervoerder. Worden vóór bevestiging aan de klant
 * getoond en bij boeking als snapshot op de rit bewaard.
 */
export interface CancellationPolicy {
  /** Gratis annuleren tot zoveel minuten voor ophaaltijd. */
  freeUntilMinutesBefore: number;
  /** Kost bij late annulering, als % van de ritprijs. */
  lateCancelBps: Bps;
  /** Kost bij no-show, als % van de ritprijs. */
  noShowBps: Bps;
  /** Minimale wachttijd van chauffeur na aankomst voor no-show mag. */
  noShowWaitMinutes: number;
}

export interface CancellationOutcome {
  fee: Cents;
  refund: Cents;
  reason: 'free_window' | 'late_cancel' | 'not_confirmed' | 'operator_or_platform' | 'no_show';
}

/** Annulering door klant. */
export function customerCancellation(
  price: Cents,
  status: RideStatus,
  pickupAt: Date,
  now: Date,
  policy: CancellationPolicy,
): CancellationOutcome {
  // Zolang er geen vervoerder akkoord is, nooit kosten.
  if (status === 'requested') return { fee: 0, refund: price, reason: 'not_confirmed' };
  const minutesBefore = (pickupAt.getTime() - now.getTime()) / 60_000;
  if (minutesBefore >= policy.freeUntilMinutesBefore) return { fee: 0, refund: price, reason: 'free_window' };
  const fee = Math.min(price, applyBps(price, policy.lateCancelBps));
  return { fee, refund: price - fee, reason: 'late_cancel' };
}

/** Annulering door vervoerder of platform: klant krijgt altijd alles terug. */
export function operatorOrPlatformCancellation(price: Cents): CancellationOutcome {
  return { fee: 0, refund: price, reason: 'operator_or_platform' };
}

export function noShow(price: Cents, policy: CancellationPolicy): CancellationOutcome {
  const fee = Math.min(price, applyBps(price, policy.noShowBps));
  return { fee, refund: price - fee, reason: 'no_show' };
}

export function noShowAllowed(arrivedAt: Date, now: Date, policy: CancellationPolicy): boolean {
  return now.getTime() - arrivedAt.getTime() >= policy.noShowWaitMinutes * 60_000;
}
