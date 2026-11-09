import { Injectable, NotFoundException } from '@nestjs/common';
import type { Receipt } from '@superette/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * De digitale kasbonnen in "Mijn aankopen".
 *
 * Leest uitsluitend uit `Receipt.snapshot` — de onveranderlijke kopie die bij
 * het afrekenen is vastgelegd. Nooit opnieuw samenstellen uit `Product` en
 * `Order`: een product dat sindsdien hernoemd of van prijs veranderd is, zou de
 * historische bon met terugwerkende kracht wijzigen. Dat is precies wat een
 * BTW-bon niet mag doen.
 */
@Injectable()
export class ReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<Receipt[]> {
    const receipts = await this.prisma.receipt.findMany({
      where: { order: { userId } },
      orderBy: { issuedAt: 'desc' },
      select: { snapshot: true },
    });

    return receipts.map((receipt) => receipt.snapshot as unknown as Receipt);
  }

  async findForUser(userId: string, orderId: string): Promise<Receipt> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { orderId },
      select: { snapshot: true, order: { select: { userId: true } } },
    });

    // Eén foutmelding voor "bestaat niet" en "niet van jou". Anders kan iemand
    // met een lijst order-ids uitvinden welke er bestaan.
    if (!receipt || receipt.order.userId !== userId) {
      throw new NotFoundException('Kasbon niet gevonden');
    }

    return receipt.snapshot as unknown as Receipt;
  }
}
