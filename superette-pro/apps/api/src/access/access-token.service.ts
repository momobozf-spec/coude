import { randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenResponse } from '@superette/contracts';
import { ConsentService } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { GateKeysService } from './gate-keys.service';
import { signGateToken } from './gate-token';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly keys: GateKeysService,
    private readonly consents: ConsentService,
  ) {}

  /**
   * Geeft een verse QR-sleutel uit voor deze klant en deze winkel.
   *
   * ## Rotatie
   *
   * Elke uitgifte markeert alle eerdere ongebruikte tokens van deze
   * (gebruiker, winkel) als `supersededAt`. Dat is de reden dat een screenshot
   * van gisteren — of van tien seconden geleden — niets waard is: er is
   * intussen een nieuwere sleutel, en de oude is daarmee dood.
   *
   * Zonder supersession zou een klant met een screenshot en een geduldige vriend
   * twee mensen naar binnen kunnen laten binnen dezelfde TTL.
   *
   * ## Waarom hier al toestemming controleren
   *
   * We zouden dit aan de deur kunnen laten. Maar dan staat de klant in de regen
   * te ontdekken dat hij zijn camera-toestemming heeft ingetrokken. Beter hier,
   * waar de app een fatsoenlijke uitleg kan tonen. De deur controleert het
   * opnieuw — vertrouw nooit op een check die eerder in de keten stond.
   */
  async issue(userId: string, storeId: string): Promise<AccessTokenResponse> {
    const ttlSeconds = this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
    const rotateSeconds = this.config.getOrThrow<number>('ACCESS_TOKEN_ROTATE_SECONDS');

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, active: true },
    });
    if (!store || !store.active) {
      throw new NotFoundException('Winkel bestaat niet of is niet actief');
    }

    if (!(await this.consents.hasRequiredConsents(userId))) {
      throw new ForbiddenException(
        'Toegang vereist toestemming voor het loggen van winkelbezoeken en voor camerabewaking',
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
    // 32 bytes uit de CSPRNG. Ruim voldoende om raden uit te sluiten; de nonce
    // is bovendien maar 60 seconden relevant.
    const nonce = randomBytes(32).toString('base64url');

    const token = await this.prisma.$transaction(async (tx) => {
      // Alle nog levende sleutels van deze klant voor deze winkel vervallen.
      await tx.accessToken.updateMany({
        where: { userId, storeId, usedAt: null, supersededAt: null },
        data: { supersededAt: issuedAt },
      });

      const previous = await tx.accessToken.findFirst({
        where: { userId, storeId },
        orderBy: { rotationSeq: 'desc' },
        select: { rotationSeq: true },
      });

      return tx.accessToken.create({
        data: {
          userId,
          storeId,
          nonce,
          rotationSeq: (previous?.rotationSeq ?? -1) + 1,
          issuedAt,
          expiresAt,
        },
      });
    });

    const qrPayload = await signGateToken(
      {
        tokenId: token.id,
        userId,
        storeId,
        nonce: token.nonce,
        rotationSeq: token.rotationSeq,
        issuedAt: token.issuedAt,
        expiresAt: token.expiresAt,
      },
      this.keys.privateKey,
    );

    return {
      qrPayload,
      expiresAt: token.expiresAt.toISOString(),
      rotateAfterSeconds: rotateSeconds,
      seq: token.rotationSeq,
    };
  }

  /**
   * Ruimt verlopen tokens op. Bedoeld voor een cron-taak.
   *
   * De `AccessLog` blijft staan — die is de wettelijke audit-trail. Alleen de
   * kortlevende sleutels zelf verdwijnen; die hebben na hun vervaldatum geen
   * enkele waarde meer, ook niet als bewijs.
   */
  async purgeExpired(olderThan: Date): Promise<number> {
    const { count } = await this.prisma.accessToken.deleteMany({
      where: { expiresAt: { lt: olderThan } },
    });
    return count;
  }
}
