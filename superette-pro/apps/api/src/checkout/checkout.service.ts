import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrderStatus, Prisma } from '@prisma/client';
import type { CheckoutResponse, PaymentMethod, Receipt } from '@superette/contracts';
import { computeVatBreakdown, type VatLine } from '@superette/vat';
import { BasketService } from '../basket/basket.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY, type PaymentGateway, type ProviderPaymentStatus } from '../payments/payment-gateway';
import { nextInvoiceNumber } from '../receipt/invoice-number';

/**
 * Ordernummers hoeven — anders dan factuurnummers — géén doorlopende reeks te
 * vormen. Een mislukte betaling mag een gat achterlaten.
 *
 * Daarom hier geen tellerrij met een slot: dat zou bij elke checkoutpoging
 * dezelfde databaserij vergrendelen en twee kassa's op elkaar laten wachten.
 * Datum + willekeur is genoeg: leesbaar voor de klant, geen contentie.
 */
function generateOrderNumber(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `JJ-${date}-${suffix}`;
}

/** Provider-status → onze orderstatus. Alles wat geen `PAID` is, is geen `PAID`. */
const ORDER_STATUS: Readonly<Record<ProviderPaymentStatus, OrderStatus>> = Object.freeze({
  OPEN: 'AWAITING_PAYMENT',
  PENDING: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELED: 'FAILED',
  EXPIRED: 'EXPIRED',
});

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly baskets: BasketService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Maakt (of hergebruikt) een order voor dit mandje en start een betaling.
   *
   * Hergebruikt bewust: `Order.basketId` is uniek, dus een tweede poging na een
   * mislukte betaling zou anders stuklopen op een constraint. De klant die zijn
   * Bancontact-app wegklikt en het opnieuw probeert, is geen randgeval — dat is
   * dinsdagmiddag.
   */
  async start(userId: string, basketId: string, method: PaymentMethod): Promise<CheckoutResponse> {
    const basket = await this.baskets.load(userId, basketId);

    if (basket.status !== 'OPEN') {
      throw new BadRequestException('Dit winkelmandje is al afgesloten');
    }
    if (basket.items.length === 0) {
      throw new BadRequestException('Je winkelmandje is leeg');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true } });

    const vatLines: VatLine[] = basket.items.map((item) => ({
      quantity: item.quantity,
      unitPriceInclCents: item.unitPriceInclCents,
      vat: item.vat,
    }));
    const breakdown = computeVatBreakdown(vatLines);

    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { basketId }, select: { id: true, status: true, orderNumber: true } });

      if (existing?.status === 'PAID') {
        throw new BadRequestException('Deze bestelling is al betaald');
      }

      const orderData = {
        userId,
        storeId: basket.storeId,
        basketId,
        status: 'AWAITING_PAYMENT' as const,
        totalExclCents: breakdown.totalExclCents,
        totalVatCents: breakdown.totalVatCents,
        totalInclCents: breakdown.totalInclCents,
        vatBuckets: breakdown.buckets as unknown as Prisma.InputJsonValue,
        paymentProvider: 'MOLLIE',
        paymentMethod: method,
        // Een nieuwe poging krijgt een nieuwe betaling bij de provider; de oude
        // id mag niet blijven staan, anders koppelt een late webhook van de
        // afgebroken betaling zich aan deze order.
        providerPaymentId: null,
      };

      const items = basket.items.map((item) => ({
        productId: item.productId,
        nameNl: item.nameNl,
        nameFr: item.nameFr,
        quantity: item.quantity,
        unitPriceInclCents: item.unitPriceInclCents,
        lineTotalInclCents: item.quantity * item.unitPriceInclCents,
        vat: item.vat,
      }));

      if (existing) {
        // Het mandje kan gewijzigd zijn tussen twee betaalpogingen: producten
        // bijgescand, aantallen aangepast. De orderregels moeten het mandje
        // volgen, niet de eerste poging.
        await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
        return tx.order.update({
          where: { id: existing.id },
          data: { ...orderData, items: { create: items } },
        });
      }

      return tx.order.create({
        data: { ...orderData, orderNumber: generateOrderNumber(new Date()), items: { create: items } },
      });
    });

    const payment = await this.gateway.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: breakdown.totalInclCents,
      description: `Jamal & Jamila — ${order.orderNumber}`,
      method,
      locale: user.locale === 'fr' ? 'fr' : 'nl',
      redirectUrl: `${this.config.getOrThrow<string>('APP_URL')}/bestelling/${order.id}`,
      webhookUrl: this.config.get<string>('MOLLIE_WEBHOOK_URL') ?? `${this.config.getOrThrow<string>('APP_URL')}/api/v1/webhooks/mollie`,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { providerPaymentId: payment.providerPaymentId },
    });

    return { orderId: order.id, orderNumber: order.orderNumber, redirectUrl: payment.checkoutUrl };
  }

  /**
   * Verwerkt een statusmelding van de betaalprovider.
   *
   * ## Drie regels die deze functie veilig maken
   *
   * 1. **De body van de webhook is geen bewijs.** Mollie stuurt alleen een
   *    payment-id — geen status, geen handtekening. We bellen terug. Wie de
   *    status uit de body leest, laat iedereen die dit endpoint kent
   *    bestellingen als betaald markeren met één `curl`.
   * 2. **Het bedrag wordt gecontroleerd.** Een betaling van €0,01 op een order
   *    van €87,90 is geen betaling. Zonder deze check zou een aanvaller die de
   *    checkout-URL manipuleert voor een cent de winkel leegkopen.
   * 3. **Idempotent.** Mollie herhaalt de webhook bij elke twijfel. Een tweede
   *    aanroep mag geen tweede kasbon, geen tweede voorraadafboeking en al
   *    zeker geen tweede factuurnummer opleveren.
   */
  async handleWebhook(providerPaymentId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { providerPaymentId },
      include: { items: true },
    });

    if (!order) {
      // Geen 404 naar buiten: dat zou bevestigen welke payment-ids bij ons
      // bestaan. Mollie is ook niet gebaat bij een fout — er valt niets te
      // herhalen.
      this.logger.warn(`Webhook voor onbekende betaling ${providerPaymentId}`);
      return;
    }

    if (order.status === 'PAID') {
      this.logger.log(`Webhook voor ${order.orderNumber} genegeerd: al betaald`);
      return;
    }

    const snapshot = await this.gateway.getPayment(providerPaymentId);

    if (snapshot.status !== 'PAID') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: ORDER_STATUS[snapshot.status] },
      });
      return;
    }

    if (snapshot.amountCents !== order.totalInclCents) {
      // Dit hoort niet te kunnen. Gebeurt het toch, dan is er geknoeid of is er
      // een bug: markeer als mislukt en laat een mens ernaar kijken.
      this.logger.error(
        `Bedrag komt niet overeen voor ${order.orderNumber}: betaald ${snapshot.amountCents}, verwacht ${order.totalInclCents}`,
      );
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      return;
    }

    await this.settlePaidOrder(order.id);
    this.logger.log(`Bestelling ${order.orderNumber} betaald en afgehandeld`);
  }

  /**
   * Alles wat er bij een geslaagde betaling in één transactie moet gebeuren.
   *
   * Order, mandje, voorraad, factuurnummer en kasbon horen bij elkaar. Faalt er
   * één, dan mag er geen enkele blijven staan — anders heb je een afgeboekte
   * voorraad zonder kasbon, of erger: een verbruikt factuurnummer zonder factuur,
   * en dus een gat in een reeks die geen gaten mag hebben.
   */
  private async settlePaidOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, store: true },
      });

      // Tweede idempotentiegrendel, nu binnen de transactie: twee webhooks die
      // exact tegelijk binnenkomen, komen allebei voorbij de check hierboven.
      if (order.status === 'PAID') return;

      const paidAt = new Date();

      await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt } });
      await tx.basket.update({ where: { id: order.basketId }, data: { status: 'PAID', closedAt: paidAt } });

      for (const item of order.items) {
        // `GREATEST(…, 0)`: de voorraadadministratie van een onbemande winkel
        // loopt onvermijdelijk uit de pas met het schap. Een negatieve voorraad
        // maakt dat alleen maar erger.
        await tx.$executeRaw`
          UPDATE "Inventory"
             SET "quantity" = GREATEST("quantity" - ${item.quantity}, 0)
           WHERE "storeId" = ${order.storeId} AND "productId" = ${item.productId}
        `;
      }

      const invoiceNumber = await nextInvoiceNumber(tx, order.storeId, paidAt.getFullYear());

      const receipt: Receipt = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        issuedAt: paidAt.toISOString(),
        storeName: order.store.name,
        storeAddress: `${order.store.address}, ${order.store.city}`,
        storeVatNumber: order.store.vatNumber,
        lines: order.items.map((item) => ({
          nameNl: item.nameNl,
          nameFr: item.nameFr,
          quantity: item.quantity,
          unitPriceInclCents: item.unitPriceInclCents,
          lineTotalInclCents: item.lineTotalInclCents,
          vatRate: Number(item.vat.replace('VAT_', '')),
        })),
        vatBuckets: order.vatBuckets as Receipt['vatBuckets'],
        totalExclCents: order.totalExclCents,
        totalVatCents: order.totalVatCents,
        totalInclCents: order.totalInclCents,
        paymentMethod: order.paymentMethod,
        paidAt: paidAt.toISOString(),
      };

      await tx.receipt.create({
        data: {
          orderId: order.id,
          invoiceNumber,
          issuedAt: paidAt,
          // Onveranderlijke kopie. Wordt een product later hernoemd of de prijs
          // aangepast, dan blijft de uitgereikte bon exact wat hij was.
          snapshot: receipt as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }
}
