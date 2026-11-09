import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { CreatePaymentParams, CreatedPayment, PaymentGateway, PaymentSnapshot } from './payment-gateway';

/**
 * Nepgateway voor ontwikkeling zonder Mollie-sleutel.
 *
 * Wordt alleen gebruikt als `MOLLIE_API_KEY` ontbreekt, en weigert dienst zodra
 * `NODE_ENV=production` — een winkel die per ongeluk op deze gateway draait, zou
 * elke bestelling gratis afleveren.
 *
 * Betalingen worden onmiddellijk als geslaagd beschouwd. De volledige keten
 * erna — order, voorraad, gapenloos factuurnummer, kasbon met BTW-uitsplitsing —
 * is daarmee end-to-end testbaar zonder één netwerkverzoek.
 */
@Injectable()
export class StubPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(StubPaymentGateway.name);
  private readonly payments = new Map<string, { amountCents: number; method: CreatePaymentParams['method'] }>();

  constructor(private readonly appUrl: string) {
    this.logger.warn('MOLLIE_API_KEY ontbreekt — betalingen worden GESIMULEERD en altijd als geslaagd gemarkeerd');
  }

  createPayment(params: CreatePaymentParams): Promise<CreatedPayment> {
    const providerPaymentId = `stub_${randomBytes(8).toString('hex')}`;
    this.payments.set(providerPaymentId, { amountCents: params.amountCents, method: params.method });

    this.logger.log(`[SIMULATIE] betaling ${providerPaymentId} van ${params.amountCents} cent voor ${params.orderNumber}`);

    return Promise.resolve({
      providerPaymentId,
      // Verwijst naar een pagina in de PWA die de webhook lokaal aftrapt.
      checkoutUrl: `${this.appUrl}/betaling/simulatie?payment=${providerPaymentId}`,
    });
  }

  getPayment(providerPaymentId: string): Promise<PaymentSnapshot> {
    const payment = this.payments.get(providerPaymentId);

    if (!payment) {
      return Promise.resolve({ status: 'FAILED', method: null, amountCents: null });
    }

    return Promise.resolve({ status: 'PAID', method: payment.method, amountCents: payment.amountCents });
  }
}
