import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DEV_DEVICE_KEY, hashDeviceKey } from './dev-device-key';

/** Weigert in productie te starten zolang een winkel de publieke dev-scannersleutel gebruikt. */
@Injectable()
export class DevDeviceKeyCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevDeviceKeyCheck.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const stores = await this.prisma.store.count({ where: { deviceKeyHash: hashDeviceKey(DEV_DEVICE_KEY) } });
    if (stores > 0) {
      this.logger.error(`${stores} winkel(s) gebruiken nog de dev-scannersleutel uit prisma/seed.ts`);
      throw new Error('Weigert te starten: een winkel gebruikt de publieke dev-scannersleutel uit prisma/seed.ts. Zet een nieuwe device-sleutel.');
    }
  }
}
