import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentMethod } from '@superette/contracts';
import type {
  CreatePaymentParams,
  CreatedPayment,
  PaymentGateway,
  PaymentSnapshot,
  ProviderPaymentStatus,
} from './payment-gateway';

const MOLLIE_API = 'https://api.mollie.com/v2';

/**
 * Onze betaalmethoden → Mollie's method-identifiers.
 *
 * Bancontact en Payconiq zijn hier de reden dat we Mollie kozen: samen dekken ze
 * het overgrote deel van de Belgische betaalmarkt, en Stripe heeft Payconiq niet.
 */
const MOLLIE_METHOD: Readonly<Record<PaymentMethod, string>> = Object.freeze({
  BANCONTACT: 'bancontact',
  PAYCONIQ: 'payconiq',
  APPLE_PAY: 'applepay',
  GOOGLE_PAY: 'googlepay',
  CARD: 'creditcard',
});

/** Mollie's statussen → de onze. Alles wat we niet kennen is `FAILED`, nooit `PAID`. */
const STATUS_MAP: Readonly<Record<string, ProviderPaymentStatus>> = Object.freeze({
  open: 'OPEN',
  pending: 'PENDING',
  authorized: 'PENDING',
  paid: 'PAID',
  canceled: 'CANCELED',
  expired: 'EXPIRED',
  failed: 'FAILED',
});

const REVERSE_METHOD: Readonly<Record<string, PaymentMethod>> = Object.freeze(
  Object.fromEntries(Object.entries(MOLLIE_METHOD).map(([ours, theirs]) => [theirs, ours as PaymentMethod])),
);

/** Centen → Mollie's decimale string. 3450 → "34.50". Nooit via floats. */
export function centsToMollieAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Bedrag moet een niet-negatief geheel aantal centen zijn, kreeg: ${cents}`);
  }

  const euros = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${euros}.${String(remainder).padStart(2, '0')}`;
}

/** Mollie's decimale string → centen. "34.50" → 3450. */
export function mollieAmountToCents(amount: string): number {
  const match = /^(\d+)\.(\d{2})$/.exec(amount);
  if (!match) throw new RangeError(`Onverwacht bedragformaat van Mollie: "${amount}"`);

  return Number(match[1]) * 100 + Number(match[2]);
}

@Injectable()
export class MollieGateway implements PaymentGateway {
  private readonly logger = new Logger(MollieGateway.name);

  constructor(private readonly config: ConfigService) {}

  async createPayment(params: CreatePaymentParams): Promise<CreatedPayment> {
    const response = await this.request('POST', '/payments', {
      amount: { currency: 'EUR', value: centsToMollieAmount(params.amountCents) },
      description: params.description,
      redirectUrl: params.redirectUrl,
      webhookUrl: params.webhookUrl,
      method: MOLLIE_METHOD[params.method],
      locale: params.locale === 'fr' ? 'fr_BE' : 'nl_BE',
      // Onze eigen id reist mee, zodat we een betaling ook terugvinden als de
      // webhook nooit aankomt en we handmatig moeten reconciliëren.
      metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    });

    const checkoutUrl = response?._links?.checkout?.href;
    if (typeof response.id !== 'string' || typeof checkoutUrl !== 'string') {
      throw new InternalServerErrorException('Mollie gaf geen bruikbare betaal-URL terug');
    }

    return { providerPaymentId: response.id, checkoutUrl };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const response = await this.request('GET', `/payments/${encodeURIComponent(providerPaymentId)}`);

    const status = STATUS_MAP[response.status as string];
    if (!status) {
      // Een onbekende status behandelen we nooit als betaald. Liever een klant
      // die zijn kasbon later krijgt dan gratis producten de deur uit.
      this.logger.error(`Onbekende Mollie-status "${response.status}" voor ${providerPaymentId}`);
      return { status: 'FAILED', method: null, amountCents: null };
    }

    return {
      status,
      method: typeof response.method === 'string' ? (REVERSE_METHOD[response.method] ?? null) : null,
      amountCents: response?.amount?.value ? mollieAmountToCents(response.amount.value) : null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const apiKey = this.config.get<string>('MOLLIE_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MOLLIE_API_KEY ontbreekt. Zet je test-sleutel in .env, of gebruik de StubGateway.',
      );
    }

    const response = await fetch(`${MOLLIE_API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Mollie's foutlichaam is niet getypeerd; `unknown` dwingt ons hier te kijken
    // voor we het gebruiken.
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const detail = typeof payload?.['detail'] === 'string' ? payload['detail'] : response.statusText;
      this.logger.error(`Mollie ${method} ${path} → ${response.status}: ${detail}`);
      throw new InternalServerErrorException(`Betaling kon niet worden verwerkt: ${detail}`);
    }

    return payload;
  }
}
