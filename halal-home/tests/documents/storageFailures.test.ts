/**
 * Wat er gebeurt als de opslag hapert.
 *
 * De vier scenario's uit `domain/lifecycle.ts`, met een storageprovider die op
 * commando faalt. Zonder deze tests is de compensatiestrategie een comment.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { DocumentStatus } from '@prisma/client'

import { LocalStorageProvider } from '@/server/storage/localProvider'
import type { StorageMetadata, StorageProvider, StoredObject } from '@/types/storage'
import { reconcilePending, needsCleanup } from '@/modules/documents/domain/lifecycle'

/** Een provider die precies faalt waar de test dat wil. */
class FlakyStorage implements StorageProvider {
  readonly name = 'local' as const

  failPut = false
  failDelete = false
  failGetMetadata = false

  private objects = new Map<string, Buffer>()

  put(key: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    if (this.failPut) return Promise.reject(new Error('opslag onbereikbaar'))
    this.objects.set(key, data)
    return Promise.resolve({ key, size: data.byteLength, mimeType })
  }

  get(key: string): Promise<Buffer> {
    const data = this.objects.get(key)
    return data ? Promise.resolve(data) : Promise.reject(new Error('niet gevonden'))
  }

  delete(key: string): Promise<void> {
    if (this.failDelete) return Promise.reject(new Error('wissen mislukt'))
    this.objects.delete(key)
    return Promise.resolve()
  }

  exists(key: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(key))
  }

  getMetadata(key: string): Promise<StorageMetadata | null> {
    if (this.failGetMetadata) return Promise.reject(new Error('metadata onbereikbaar'))
    const data = this.objects.get(key)
    return Promise.resolve(
      data ? { key, size: data.byteLength, lastModified: new Date() } : null,
    )
  }

  signedUrl(key: string): Promise<string> {
    return Promise.resolve(`https://example.com/${key}`)
  }

  /** Voor de test: staat er iets? */
  has(key: string): boolean {
    return this.objects.has(key)
  }
}

let storage: FlakyStorage

beforeEach(() => {
  storage = new FlakyStorage()
})

const NOW = new Date('2026-08-07T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

describe('scenario 1 — upload mislukt', () => {
  it('laat geen bestand achter', async () => {
    storage.failPut = true

    await expect(storage.put('documents/u1/identity/a.pdf', Buffer.from('x'), 'application/pdf'))
      .rejects.toThrow()

    expect(storage.has('documents/u1/identity/a.pdf')).toBe(false)
  })

  it('leidt tot FAILED, niet tot een rij die beschikbaar lijkt', () => {
    // De rij blijft niet op PENDING hangen wanneer er niets in de opslag staat
    // en de respijtperiode voorbij is.
    expect(
      reconcilePending(
        { status: DocumentStatus.PENDING, createdAt: minutesAgo(60) },
        false,
        NOW,
      ),
    ).toBe('mark_failed')
  })
})

describe('scenario 2 — upload gelukt, rij bijwerken mislukt', () => {
  it('herstelt naar AVAILABLE omdat het bestand er is', async () => {
    const key = 'documents/u1/identity/b.pdf'
    await storage.put(key, Buffer.from('inhoud'), 'application/pdf')

    const metadata = await storage.getMetadata(key)
    expect(metadata).not.toBeNull()

    // Het bestand ís er, dus niets weggooien.
    expect(
      reconcilePending(
        { status: DocumentStatus.PENDING, createdAt: minutesAgo(60) },
        metadata !== null,
        NOW,
      ),
    ).toBe('mark_available')
  })

  it('gebruikt de werkelijke grootte uit de opslag', async () => {
    const key = 'documents/u1/identity/c.pdf'
    await storage.put(key, Buffer.from('twaalf bytes'), 'application/pdf')

    const metadata = await storage.getMetadata(key)
    expect(metadata?.size).toBe(12)
  })
})

describe('scenario 3 — verwijderen, maar wissen mislukt', () => {
  it('laat het bestand staan wanneer delete faalt', async () => {
    const key = 'documents/u1/bank/d.pdf'
    await storage.put(key, Buffer.from('x'), 'application/pdf')

    storage.failDelete = true
    await expect(storage.delete(key)).rejects.toThrow()

    // Dit is het gevaarlijke geval: de gebruiker denkt dat het weg is.
    expect(storage.has(key)).toBe(true)
  })

  it('blijft in de opruimwachtrij staan', () => {
    // deletedAt gezet, purgedAt leeg → volgende ronde opnieuw proberen.
    expect(
      needsCleanup(
        {
          id: 'd1',
          storageKey: 'documents/u1/bank/d.pdf',
          status: DocumentStatus.DELETED,
          deletedAt: minutesAgo(10),
          purgedAt: null,
          createdAt: minutesAgo(100),
        },
        NOW,
      ),
    ).toBe('deleted_not_purged')
  })

  it('verdwijnt uit de wachtrij zodra het wissen alsnog lukt', async () => {
    const key = 'documents/u1/bank/e.pdf'
    await storage.put(key, Buffer.from('x'), 'application/pdf')
    await storage.delete(key)

    expect(storage.has(key)).toBe(false)
    expect(
      needsCleanup(
        {
          id: 'd1',
          storageKey: key,
          status: DocumentStatus.DELETED,
          deletedAt: minutesAgo(10),
          purgedAt: minutesAgo(9),
          createdAt: minutesAgo(100),
        },
        NOW,
      ),
    ).toBeNull()
  })
})

describe('scenario 4 — wissen gelukt, rij bijwerken mislukt', () => {
  it('is idempotent: nog eens wissen is geen fout', async () => {
    const key = 'documents/u1/bank/f.pdf'
    await storage.put(key, Buffer.from('x'), 'application/pdf')

    await storage.delete(key)
    // Tweede poging op een object dat er niet meer is.
    await expect(storage.delete(key)).resolves.toBeUndefined()
  })
})

describe('de lokale provider weert padontsnapping', () => {
  const provider = new LocalStorageProvider('.storage-test', 'x'.repeat(32))

  it('weigert een sleutel die buiten de basismap wijst', async () => {
    // Zonder deze controle is een documentdownload een willekeurige-
    // bestandslezer.
    await expect(provider.get('../../.env')).rejects.toThrow()
    await expect(provider.getMetadata('../../../etc/passwd')).resolves.toBeNull()
  })

  it('geeft null voor een onbestaand object in plaats van te gooien', async () => {
    expect(await provider.getMetadata('documents/u1/identity/bestaat-niet.pdf')).toBeNull()
  })
})

describe('gesigneerde URL', () => {
  const provider = new LocalStorageProvider('.storage-test', 'geheim'.repeat(6))

  it('accepteert een geldige handtekening', async () => {
    const url = new URL(await provider.signedUrl('documents/u1/identity/g.pdf', 300))

    const key = url.searchParams.get('key')!
    const expires = Number(url.searchParams.get('expires'))
    const signature = url.searchParams.get('signature')!

    expect(provider.verifySignature(key, expires, signature)).toBe(true)
  })

  it('weigert een gewijzigde sleutel', async () => {
    const url = new URL(await provider.signedUrl('documents/u1/identity/g.pdf', 300))
    const expires = Number(url.searchParams.get('expires'))
    const signature = url.searchParams.get('signature')!

    // Iemand die de sleutel aanpast om bij een ander bestand te komen.
    expect(
      provider.verifySignature('documents/u2/identity/h.pdf', expires, signature),
    ).toBe(false)
  })

  it('weigert een verlopen token', () => {
    const past = Math.floor(Date.now() / 1000) - 10
    expect(provider.verifySignature('documents/u1/identity/g.pdf', past, 'x')).toBe(false)
  })

  it('weigert een verzonnen handtekening', async () => {
    const url = new URL(await provider.signedUrl('documents/u1/identity/g.pdf', 300))
    const expires = Number(url.searchParams.get('expires'))

    expect(
      provider.verifySignature('documents/u1/identity/g.pdf', expires, 'a'.repeat(64)),
    ).toBe(false)
  })
})
