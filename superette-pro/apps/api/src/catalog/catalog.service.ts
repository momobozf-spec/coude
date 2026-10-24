import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isValidEan } from './ean';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Zoekt het product achter een gescande barcode.
   *
   * Valideert eerst het controlecijfer. Een barcode die de camera verkeerd las,
   * mag nooit een *ander* bestaand product opleveren — dan legt de klant een
   * serum van €34,50 in zijn mandje terwijl hij muntthee scande.
   *
   * @throws {BadRequestException} bij een ongeldig controlecijfer.
   * @throws {NotFoundException} als de barcode niet in de catalogus staat.
   */
  async findByBarcode(barcode: string): Promise<Product> {
    if (!isValidEan(barcode)) {
      throw new BadRequestException('Streepjescode is onleesbaar. Probeer opnieuw te scannen.');
    }

    const product = await this.prisma.product.findUnique({ where: { barcode } });

    if (!product || !product.active) {
      throw new NotFoundException('Dit product staat niet in onze catalogus');
    }

    return product;
  }

  /** De voorraad van één product in één winkel. `0` als er geen voorraadrij is. */
  async stockOf(storeId: string, productId: string): Promise<number> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { storeId_productId: { storeId, productId } },
      select: { quantity: true },
    });

    return inventory?.quantity ?? 0;
  }
}
