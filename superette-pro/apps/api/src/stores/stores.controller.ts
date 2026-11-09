import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicStore {
  id: string;
  name: string;
  address: string;
  city: string;
  opensAtMinute: number;
  closesAtMinute: number;
  /** Of er nu nog plek is. Geen exacte bezetting — dat gaat niemand aan. */
  hasCapacity: boolean;
}

/**
 * De winkellijst voor de app. Publiek, want je moet een winkel kunnen kiezen
 * vóór je inlogt.
 *
 * Selecteert expliciet velden in plaats van hele rijen door te geven. `Store`
 * bevat `deviceKeyHash` en `mqttTopicPrefix` — de eerste is een geheim, de
 * tweede vertelt een aanvaller precies op welk MQTT-topic hij moet publiceren
 * om een deur te openen.
 */
@Controller('stores')
export class StoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<PublicStore[]> {
    const stores = await this.prisma.store.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        opensAtMinute: true,
        closesAtMinute: true,
        currentOccupancy: true,
        maxOccupancy: true,
      },
    });

    return stores.map(({ currentOccupancy, maxOccupancy, ...store }) => ({
      ...store,
      hasCapacity: currentOccupancy < maxOccupancy,
    }));
  }
}
