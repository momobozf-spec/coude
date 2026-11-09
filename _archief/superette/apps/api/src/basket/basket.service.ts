import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { computeVatBreakdown, type VatLine } from '@superette/vat';
import type { Basket as BasketDto } from '@superette/contracts';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BasketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Voegt een gescand product toe aan het mandje.
   *
   * ## Prijssnapshot
   *
   * De prijs en het BTW-tarief worden vastgelegd bij de *eerste* scan van dit
   * product, niet bij het afrekenen en niet bij elke volgende scan. Verandert de
   * catalogusprijs terwijl de klant in de winkel staat, dan betaalt hij wat op
   * het schap stond. Dat is niet alleen fatsoenlijk, het is de wet.
   */
  async scan(userId: string, basketId: string, barcode: string, quantity: number): Promise<BasketDto> {
    const basket = await this.requireOpenBasket(userId, basketId);
    const product = await this.catalog.findByBarcode(barcode);

    const existing = await this.prisma.basketItem.findUnique({
      where: { basketId_productId: { basketId, productId: product.id } },
      select: { quantity: true },
    });

    const desiredQuantity = (existing?.quantity ?? 0) + quantity;

    // Meer scannen dan er in het schap ligt betekent dat de voorraadadministratie
    // niet klopt. Weiger, en laat de uitbater het uitzoeken — een onbemande
    // winkel kan niet "even navragen".
    const stock = await this.catalog.stockOf(basket.storeId, product.id);
    if (desiredQuantity > stock) {
      throw new BadRequestException(`Nog ${stock} stuks beschikbaar van dit product`);
    }

    await this.prisma.basketItem.upsert({
      where: { basketId_productId: { basketId, productId: product.id } },
      update: { quantity: desiredQuantity },
      create: {
        basketId,
        productId: product.id,
        quantity,
        // Snapshot. Wordt bij een tweede scan bewust NIET overschreven.
        unitPriceInclCents: product.priceInclCents,
        vat: product.vat,
      },
    });

    return this.load(userId, basketId);
  }

  /** Zet het aantal van één regel. `0` verwijdert de regel. */
  async setQuantity(userId: string, basketId: string, productId: string, quantity: number): Promise<BasketDto> {
    const basket = await this.requireOpenBasket(userId, basketId);

    if (quantity === 0) {
      await this.prisma.basketItem.deleteMany({ where: { basketId, productId } });
      return this.load(userId, basketId);
    }

    const stock = await this.catalog.stockOf(basket.storeId, productId);
    if (quantity > stock) {
      throw new BadRequestException(`Nog ${stock} stuks beschikbaar van dit product`);
    }

    const updated = await this.prisma.basketItem.updateMany({ where: { basketId, productId }, data: { quantity } });
    if (updated.count === 0) {
      throw new NotFoundException('Dit product zit niet in je mandje');
    }

    return this.load(userId, basketId);
  }

  /**
   * Laadt het mandje met de volledige BTW-uitsplitsing.
   *
   * De uitsplitsing wordt op elke aanroep herberekend uit de *gesnapshotte*
   * regelprijzen, niet uit de huidige catalogus. Zo ziet de klant in de app exact
   * wat er straks op zijn kasbon komt.
   */
  async load(userId: string, basketId: string): Promise<BasketDto> {
    const basket = await this.prisma.basket.findUnique({
      where: { id: basketId },
      include: { items: { include: { product: true }, orderBy: { scannedAt: 'asc' } } },
    });

    if (!basket) throw new NotFoundException('Winkelmandje bestaat niet');
    if (basket.userId !== userId) throw new ForbiddenException('Dit is niet jouw winkelmandje');

    const vatLines: VatLine[] = basket.items.map((item) => ({
      quantity: item.quantity,
      unitPriceInclCents: item.unitPriceInclCents,
      vat: item.vat,
    }));

    const breakdown = computeVatBreakdown(vatLines);

    return {
      id: basket.id,
      storeId: basket.storeId,
      status: basket.status,
      items: basket.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        barcode: item.product.barcode,
        nameNl: item.product.nameNl,
        nameFr: item.product.nameFr,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        unitPriceInclCents: item.unitPriceInclCents,
        vat: item.vat,
      })),
      totalInclCents: breakdown.totalInclCents,
      totalExclCents: breakdown.totalExclCents,
      totalVatCents: breakdown.totalVatCents,
      vatBuckets: breakdown.buckets.map((bucket) => ({ ...bucket })),
    };
  }

  /** Het actieve mandje van deze klant in deze winkel, als hij er een heeft. */
  async findOpenBasket(userId: string, storeId: string): Promise<BasketDto | null> {
    const basket = await this.prisma.basket.findFirst({
      where: { userId, storeId, status: 'OPEN' },
      select: { id: true },
    });

    return basket ? this.load(userId, basket.id) : null;
  }

  private async requireOpenBasket(userId: string, basketId: string) {
    const basket = await this.prisma.basket.findUnique({
      where: { id: basketId },
      select: { id: true, userId: true, storeId: true, status: true },
    });

    if (!basket) throw new NotFoundException('Winkelmandje bestaat niet');
    if (basket.userId !== userId) throw new ForbiddenException('Dit is niet jouw winkelmandje');
    if (basket.status !== 'OPEN') throw new BadRequestException('Dit winkelmandje is al afgesloten');

    return basket;
  }
}
