import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DeviceAuthenticatedRequest extends Request {
  /** De winkel waarvan de scanner deze request deed. Gezet door `DeviceAuthGuard`. */
  store: Store;
}

const DEVICE_KEY_HEADER = 'x-device-key';

/**
 * Authenticeert de fysieke deurscanner, niet de klant.
 *
 * De scanner stuurt zijn winkel-id in de body en een geheime sleutel in de
 * `x-device-key` header. Wij hashen die met SHA-256 en vergelijken hem in
 * constante tijd met `Store.deviceKeyHash`.
 *
 * ## Waarom SHA-256 en niet Argon2
 *
 * Argon2 is traag *met opzet*, omdat wachtwoorden weinig entropie hebben en je
 * een aanvaller die de hash steelt wil afremmen. Een device-sleutel is 32 bytes
 * uit een CSPRNG: die kraak je niet met een woordenlijst, hoe traag je hash ook
 * is. Argon2 zou hier alleen 50–100ms toevoegen aan iemand die in de regen voor
 * de deur staat.
 *
 * ## Waarom constante tijd
 *
 * Een gewone `===` op strings stopt bij het eerste verschillende teken. Wie de
 * responstijd nauwkeurig meet, raadt de sleutel byte voor byte. `timingSafeEqual`
 * kijkt altijd naar alle bytes.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceAuthenticatedRequest>();

    const presentedKey = request.header(DEVICE_KEY_HEADER);
    const storeId = (request.body as { storeId?: unknown } | undefined)?.storeId;

    if (typeof presentedKey !== 'string' || presentedKey.length === 0 || typeof storeId !== 'string') {
      throw new UnauthorizedException('Onbekend apparaat');
    }

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || !store.active) {
      throw new UnauthorizedException('Onbekend apparaat');
    }

    const presentedHash = createHash('sha256').update(presentedKey, 'utf8').digest();
    const expectedHash = Buffer.from(store.deviceKeyHash, 'hex');

    // Lengtecheck vóór timingSafeEqual: die werpt bij ongelijke lengtes, en dat
    // is óók een timing-signaal. Beide hashes zijn 32 bytes, dus een afwijking
    // betekent een corrupte kolom — behandel het als een mislukte authenticatie.
    if (expectedHash.length !== presentedHash.length || !timingSafeEqual(presentedHash, expectedHash)) {
      throw new UnauthorizedException('Onbekend apparaat');
    }

    request.store = store;
    return true;
  }
}

/** Hulpfunctie voor de seed en voor het inrichten van een nieuwe scanner. */
export function hashDeviceKey(plaintextKey: string): string {
  return createHash('sha256').update(plaintextKey, 'utf8').digest('hex');
}
