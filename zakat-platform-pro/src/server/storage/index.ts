import 'server-only'

import path from 'node:path'

import { serverEnv, isTest } from '@/config/env'
import { LocalFileStorage } from '@/server/storage/local'
import { InMemoryFileStorage } from '@/server/storage/memory'
import type { FileStorage } from '@/server/storage/types'

export * from '@/server/storage/types'
export { LocalFileStorage } from '@/server/storage/local'
export { InMemoryFileStorage } from '@/server/storage/memory'

let cached: FileStorage | null = null

/**
 * Resolve the configured backend.
 *
 * `s3` fails loudly without credentials rather than silently writing receipts to
 * the local disk of a container that will be replaced — the same rule the price
 * and FX providers follow.
 */
export function getFileStorage(): FileStorage {
  if (cached) return cached

  // Tests never write to disk; a test that needs to assert on stored bytes
  // constructs its own InMemoryFileStorage.
  if (isTest) {
    cached = new InMemoryFileStorage()
    return cached
  }

  const env = serverEnv()

  switch (env.STORAGE_PROVIDER) {
    case 'local':
      cached = new LocalFileStorage(path.resolve(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR))
      return cached

    case 's3':
      if (!env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
        throw new Error(
          'STORAGE_PROVIDER=s3 vereist S3_BUCKET, S3_ACCESS_KEY en S3_SECRET_KEY. ' +
            'Zonder credentials wordt er bewust niet teruggevallen op lokale opslag.',
        )
      }
      throw new Error(
        'STORAGE_PROVIDER=s3 is nog niet geïmplementeerd (fase 3 levert lokale opslag).',
      )

    default:
      cached = new LocalFileStorage(path.resolve(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR))
      return cached
  }
}

/** Test seam. */
export function setFileStorage(storage: FileStorage | null): void {
  cached = storage
}
