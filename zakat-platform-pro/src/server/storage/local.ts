import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  ObjectNotFoundError,
  StorageError,
  type FileStorage,
  type PutObjectInput,
  type StoredObject,
} from '@/server/storage/types'

/**
 * Local filesystem storage for development.
 *
 * The directory is gitignored and sits outside `public/`, so nothing here is
 * ever served statically. Keys are validated before touching the filesystem:
 * a key containing `..` or an absolute path would otherwise let a crafted
 * request read or overwrite files outside the storage root.
 */

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-z0-9]{2,5}$/

export class LocalFileStorage implements FileStorage {
  readonly backend = 'local' as const

  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) {
      throw new StorageError(`Unsafe storage key: ${key}`)
    }

    const resolved = path.resolve(this.root, key)
    const rootResolved = path.resolve(this.root)

    // Belt and braces: even a key that passed the pattern must land inside root.
    if (!resolved.startsWith(rootResolved + path.sep)) {
      throw new StorageError(`Storage key escapes the storage root: ${key}`)
    }

    return resolved
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const target = this.resolve(input.key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, input.body)

    return {
      key: input.key,
      sizeBytes: input.body.byteLength,
      checksumSha256: createHash('sha256').update(input.body).digest('hex'),
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key))
    } catch (error) {
      if (isMissing(error)) throw new ObjectNotFoundError(key)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true })
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key))
      return true
    } catch (error) {
      if (isMissing(error)) return false
      throw error
    }
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'ENOENT'
  )
}
