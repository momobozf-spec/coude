/**
 * Lokale opslag, voor development.
 *
 * NIET VOOR PRODUCTIE. Er is geen encryptie at rest, geen redundantie, en de
 * bestanden staan op dezelfde schijf als de applicatie.
 *
 * Wat er wél goed aan is en ook in productie moet gelden:
 *   - de map ligt buiten de webroot, dus Next serveert hem nooit rechtstreeks;
 *   - een download loopt via een gesigneerd, aflopend token;
 *   - `resolveSafePath` weigert elke sleutel die buiten de basismap wijst.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { env } from '@/config/env'
import { StorageError } from '@/lib/errors'
import type { StorageMetadata, StorageProvider, StoredObject } from '@/types/storage'

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const

  private readonly baseDir: string
  private readonly signingSecret: string

  constructor(baseDir = env.STORAGE_LOCAL_DIR, signingSecret = env.STORAGE_SIGNING_SECRET ?? '') {
    this.baseDir = path.resolve(process.cwd(), baseDir)
    this.signingSecret = signingSecret
  }

  /**
   * Zet een sleutel om in een absoluut pad, en weigert alles wat ontsnapt.
   *
   * Zonder deze controle is `../../.env` een geldige sleutel, en dan is een
   * documentdownload een willekeurige-bestandslezer.
   */
  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key)
    const relative = path.relative(this.baseDir, resolved)

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new StorageError('Ongeldige opslagsleutel')
    }
    return resolved
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const target = this.resolveSafePath(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)
    return { key, size: data.byteLength, mimeType }
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveSafePath(key))
    } catch {
      // De onderliggende fout kan het absolute pad bevatten; die geven we niet door.
      throw new StorageError('Bestand niet gevonden in de opslag')
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveSafePath(key), { force: true })
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveSafePath(key))
      return true
    } catch {
      return false
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const stats = await stat(this.resolveSafePath(key))
      return { key, size: stats.size, lastModified: stats.mtime }
    } catch {
      // Niet bestaan is een antwoord, geen fout.
      return null
    }
  }

  /**
   * Een gesigneerde URL naar de eigen download-route.
   *
   * Het token bindt de sleutel aan een vervaltijd. Zonder handtekening zou de
   * URL van een willekeurig document raadbaar én onbeperkt geldig zijn.
   *
   * Belangrijk: dit token is geen vervanging voor de autorisatiecheck. De
   * download-route controleert nog steeds of het document van de ingelogde
   * gebruiker is — een gelekte URL mag geen toegang geven aan een ander account.
   */
  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
    const signature = this.sign(key, expiresAt)

    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      signature,
    })

    return Promise.resolve(`${env.NEXT_PUBLIC_APP_URL}/api/documents/download?${params}`)
  }

  private sign(key: string, expiresAt: number): string {
    return createHmac('sha256', this.signingSecret).update(`${key}:${expiresAt}`).digest('hex')
  }

  /**
   * Controleert een token uit een download-URL.
   *
   * `timingSafeEqual` en niet `===`: string-vergelijking stopt bij het eerste
   * verschillende teken, en dat verschil in looptijd is genoeg om een
   * handtekening teken voor teken te raden.
   */
  verifySignature(key: string, expiresAt: number, signature: string): boolean {
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false

    const expected = Buffer.from(this.sign(key, expiresAt), 'utf8')
    const provided = Buffer.from(signature, 'utf8')

    if (expected.length !== provided.length) return false
    return timingSafeEqual(expected, provided)
  }
}
