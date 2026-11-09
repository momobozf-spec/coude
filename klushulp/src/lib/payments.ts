import "server-only";
import { env } from "./env";

/**
 * Integratiegrens voor marktplaatsbetalingen.
 * Nu: platformkosten worden per bevestigde boeking geregistreerd en (gesimuleerd) als verschuldigd gemarkeerd.
 * Later: Stripe Connect (Express-accounts voor dienstverleners, platformkosten via application fee of aparte incasso).
 * Nooit eigen geldbewaring; geen fictieve escrow.
 */
export type FeeCharge = { status: "simulated" | "pending" | "paid" | "failed"; provider: "simulated" | "stripe_test" | "stripe"; reference: string | null };

export interface PaymentProvider {
  readonly name: string;
  readonly isReal: boolean;
  chargePlatformFee(input: { bookingId: string; providerId: string; amountCents: number }): Promise<FeeCharge>;
}

class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly isReal = false;
  async chargePlatformFee(input: { bookingId: string; amountCents: number }): Promise<FeeCharge> {
    return { status: "simulated", provider: "simulated", reference: `sim_${input.bookingId.slice(0, 8)}_${input.amountCents}` };
  }
}

class StripeConnectProvider implements PaymentProvider {
  readonly name = "stripe";
  readonly isReal = true;
  async chargePlatformFee(): Promise<FeeCharge> {
    // Activering vereist: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, Connect-onboarding per dienstverlener (account id op provider),
    // webhook-route /api/stripe/webhook en een incassoflow (Billing of PaymentIntent met application fee). Zie README.
    throw new Error("Stripe Connect is nog niet geïmplementeerd; verwijder STRIPE_SECRET_KEY of voltooi de integratie.");
  }
}

export function getPaymentProvider(): PaymentProvider {
  return env.stripeConfigured ? new StripeConnectProvider() : new SimulatedPaymentProvider();
}
