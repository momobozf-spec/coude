/**
 * Provider-factory voor documentopslag.
 *
 * De S3-implementatie is bewust nog niet aanwezig: hij vraagt om
 * `@aws-sdk/client-s3`, en die afhankelijkheid toevoegen voordat er een bucket
 * is levert alleen bundelgewicht op. Het interface staat vast (`StorageProvider`),
 * dus de implementatie erbij zetten raakt geen enkele aanroeper.
 */
import 'server-only'
import { env } from '@/config/env'
import { StorageError } from '@/lib/errors'
import type { StorageProvider } from '@/types/storage'
import { LocalStorageProvider } from './localProvider'

let cached: StorageProvider | undefined

export function getStorageProvider(): StorageProvider {
  cached ??= createStorageProvider()
  return cached
}

function createStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === 's3') {
    throw new StorageError(
      'De S3-provider is nog niet geïmplementeerd. Zet STORAGE_PROVIDER=local, ' +
        'of voeg een implementatie van StorageProvider toe in src/server/storage/.',
    )
  }
  return new LocalStorageProvider()
}

/** Alleen voor tests. */
export function setStorageProvider(provider: StorageProvider | undefined): void {
  cached = provider
}

export { LocalStorageProvider }
