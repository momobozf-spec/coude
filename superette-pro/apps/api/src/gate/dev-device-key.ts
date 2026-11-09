/**
 * De device-sleutel die `prisma/seed.ts` voor de demo-winkel aanmaakt.
 *
 * Hij staat in de repository en is dus publiek: een winkel met deze sleutel
 * in productie laat iedereen de deur openen. `DevDeviceKeyCheck` (`dev-device-key.check.ts`) weigert
 * daarom te starten in productie zolang een winkel hem nog gebruikt.
 */
import { createHash } from 'node:crypto';

export const DEV_DEVICE_KEY = 'dev-scanner-antwerpen-zuid-vervang-in-productie';

/** Zelfde functie als in `DeviceAuthGuard` en de seed: SHA-256, hex. */
export const hashDeviceKey = (key: string): string => createHash('sha256').update(key, 'utf8').digest('hex');
