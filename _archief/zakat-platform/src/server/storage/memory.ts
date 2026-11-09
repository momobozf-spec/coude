import { createHash } from 'node:crypto'

import {
  ObjectNotFoundError,
  type FileStorage,
  type PutObjectInput,
  type StoredObject,
} from '@/server/storage/types'

/**
 * In-memory storage for tests.
 *
 * Exercises the same interface as the real backends so upload validation,
 * ownership checks and signed-link handling can be tested without touching the
 * filesystem or leaving files behind.
 */
export class InMemoryFileStorage implements FileStorage {
  readonly backend = 'local' as const

  private readonly objects = new Map<string, Buffer>()

  async put(input: PutObjectInput): Promise<StoredObject> {
    this.objects.set(input.key, input.body)
    return {
      key: input.key,
      sizeBytes: input.body.byteLength,
      checksumSha256: createHash('sha256').update(input.body).digest('hex'),
    }
  }

  async get(key: string): Promise<Buffer> {
    const value = this.objects.get(key)
    if (!value) throw new ObjectNotFoundError(key)
    return value
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key)
  }

  /** Test helper. */
  get size(): number {
    return this.objects.size
  }

  clear(): void {
    this.objects.clear()
  }
}
