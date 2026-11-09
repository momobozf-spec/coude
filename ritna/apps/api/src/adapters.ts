import { randomUUID } from 'node:crypto';
import { haversineMeters, type LatLng, type TripEstimate } from '@ritna/core';
import type { Queryable } from './db.js';

// ---------------------------------------------------------------------------
// Betalingen
// ---------------------------------------------------------------------------
/**
 * Contract met de marktplaats-betaalprovider. Vooraf autoriseren, capturen bij
 * voltooiing, terugbetalen bij annulering. De echte provider (Stripe Connect of
 * Mollie Connect) komt achter deze interface.
 */
export interface PaymentProvider {
  readonly name: string;
  authorize(input: { amountCents: number; rideId: string; customerId: string }): Promise<{ ref: string }>;
  capture(ref: string, amountCents: number): Promise<void>;
  void(ref: string): Promise<void>;
  refund(ref: string, amountCents: number): Promise<void>;
  payout(input: { operatorAccountRef: string; amountCents: number; payoutId: string }): Promise<{ ref: string }>;
}

interface FakeAuth {
  authorized: number;
  captured: number;
  refunded: number;
  voided: boolean;
}

/** Provider voor ontwikkeling en tests. Controleert dezelfde regels als een echte provider. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private auths = new Map<string, FakeAuth>();
  public failNextAuthorize = false;

  async authorize({ amountCents }: { amountCents: number }) {
    if (this.failNextAuthorize) {
      this.failNextAuthorize = false;
      throw new PaymentError('betaling geweigerd');
    }
    const ref = `fake_pi_${randomUUID()}`;
    this.auths.set(ref, { authorized: amountCents, captured: 0, refunded: 0, voided: false });
    return { ref };
  }
  async capture(ref: string, amountCents: number) {
    const a = this.get(ref);
    if (a.voided) throw new PaymentError('autorisatie al vrijgegeven');
    if (a.captured > 0) throw new PaymentError('al gecaptured');
    if (amountCents > a.authorized) throw new PaymentError('capture hoger dan autorisatie');
    a.captured = amountCents;
  }
  async void(ref: string) {
    const a = this.get(ref);
    if (a.captured > 0) throw new PaymentError('al gecaptured');
    a.voided = true;
  }
  async refund(ref: string, amountCents: number) {
    const a = this.get(ref);
    if (a.refunded + amountCents > a.captured) throw new PaymentError('terugbetaling hoger dan betaald');
    a.refunded += amountCents;
  }
  async payout({ amountCents }: { amountCents: number }) {
    if (amountCents <= 0) throw new PaymentError('uitbetaling moet positief zijn');
    return { ref: `fake_po_${randomUUID()}` };
  }
  private get(ref: string): FakeAuth {
    const a = this.auths.get(ref);
    if (!a) throw new PaymentError(`onbekende betaling ${ref}`);
    return a;
  }
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ---------------------------------------------------------------------------
// Routering (afstand en duur)
// ---------------------------------------------------------------------------
export interface RoutingProvider {
  estimate(from: LatLng, to: LatLng): Promise<TripEstimate>;
}

/**
 * ALLEEN VOOR ONTWIKKELING: hemelsbrede afstand × 1,35 en 30 km/u gemiddeld.
 * Vóór lancering vervangen door een echte routeringsdienst, want de vaste
 * prijs hangt hiervan af.
 */
export class StraightLineRouting implements RoutingProvider {
  async estimate(from: LatLng, to: LatLng): Promise<TripEstimate> {
    const distanceMeters = Math.round(haversineMeters(from, to) * 1.35);
    const durationSeconds = Math.round(distanceMeters / (30_000 / 3600));
    return { distanceMeters, durationSeconds };
  }
}

// ---------------------------------------------------------------------------
// Notificaties
// ---------------------------------------------------------------------------
export interface Notifier {
  send(q: Queryable, userId: string, template: string, payload: Record<string, unknown>): Promise<void>;
}

/** Schrijft naar de notifications-tabel; push/SMS/e-mail-adapters lezen daaruit. */
export class DbNotifier implements Notifier {
  async send(q: Queryable, userId: string, template: string, payload: Record<string, unknown>) {
    await q.query('insert into notifications (user_id, channel, template, payload) values ($1, $2, $3, $4)', [
      userId,
      'inbox',
      template,
      JSON.stringify(payload),
    ]);
  }
}
