import type { PaymentMethod } from '@superette/contracts';

/** Nest injection token. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** De statussen die wij van een provider willen weten, ontdaan van diens jargon. */
export type ProviderPaymentStatus = 'OPEN' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'EXPIRED';

export interface CreatePaymentParams {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountCents: number;
  readonly description: string;
  readonly method: PaymentMethod;
  readonly locale: 'nl' | 'fr';
  /** Waar de klant heen gaat ná het betalen (of afbreken). */
  readonly redirectUrl: string;
  /** Waar de provider ons de statuswijziging meldt. */
  readonly webhookUrl: string;
}

export interface CreatedPayment {
  readonly providerPaymentId: string;
  /** De hosted checkout van de provider. Hier stuurt de app de klant naartoe. */
  readonly checkoutUrl: string;
}

export interface PaymentSnapshot {
  readonly status: ProviderPaymentStatus;
  /** Welke methode de klant uiteindelijk koos. Kan afwijken van wat we vroegen. */
  readonly method: PaymentMethod | null;
  /** Het werkelijk betaalde bedrag, in centen. Controleer dit — vertrouw de webhook niet. */
  readonly amountCents: number | null;
}

/**
 * De naad tussen ons domein en de betaalprovider.
 *
 * Bestaat niet om ooit van Mollie te wisselen — die kans is klein. Bestaat omdat
 * `CheckoutService` en de webhook anders alleen te testen zijn met een echte
 * API-sleutel en een echte HTTP-verbinding. Met deze interface draait de
 * volledige bestel- en kasbonlogica tegen een nepgateway, in milliseconden.
 */
export interface PaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<CreatedPayment>;

  /**
   * Haalt de actuele status op bij de provider.
   *
   * De webhook van Mollie bevat alleen een payment-id, geen status en geen
   * handtekening. Dat is met opzet: je *moet* terugbellen. Wie de status uit de
   * webhook-body leest, laat iedereen die het endpoint kent bestellingen als
   * betaald markeren.
   */
  getPayment(providerPaymentId: string): Promise<PaymentSnapshot>;
}
