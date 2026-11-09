/**
 * De levenscyclus van een document tegen een echte database en echte opslag:
 * PENDING-overgangen, compensatie in beide richtingen, en de opruimtaak.
 *
 * ─── DE VIER STORINGSSCENARIO'S ──────────────────────────────────────────────
 *
 * Een upload raakt twee systemen — de database en de opslag — en die kunnen
 * niet samen in één transactie. Elk van de vier uitkomsten moet een
 * herstelbare toestand opleveren, en dat is precies wat hier bewezen wordt:
 *
 *   1. rij aangemaakt, opslag faalt      → FAILED, geen weesbestand;
 *   2. opslag gelukt, rij bijwerken faalt → blijft PENDING, bestand blijft;
 *                                           de opruimtaak maakt het af;
 *   3. rij op DELETED, wissen faalt      → deletedAt gezet, purgedAt leeg;
 *                                           de opruimtaak wist alsnog;
 *   4. rij op PENDING, niets in de opslag → na de respijtperiode FAILED.
 *
 * De storingen worden echt veroorzaakt door een opslagprovider die faalt — niet
 * door een mock van de service. Wat we willen weten is wat de code dóét als de
 * schijf wegvalt, niet wat wij denken dat hij doet.
 */
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { DocumentCategory, DocumentStatus } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import * as service from '@/modules/documents/service'
import * as repository from '@/modules/documents/repository'
import { PENDING_GRACE_MINUTES } from '@/modules/documents/domain/lifecycle'
import { getStorageProvider, setStorageProvider } from '@/server/storage'
import type { StorageProvider } from '@/types/storage'

const pdf = (content = 'inhoud') => Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.from(content)])

const upload = (overrides: Partial<service.UploadInput> = {}): service.UploadInput => ({
  category: DocumentCategory.BANK,
  originalFilename: 'rekeninguittreksel.pdf',
  mimeType: 'application/pdf',
  data: pdf(),
  ...overrides,
})

const realStorage = getStorageProvider()

/** Een provider die faalt op de gekozen bewerkingen; de rest werkt gewoon. */
function brokenStorage(failing: Array<'put' | 'delete' | 'getMetadata'>): StorageProvider {
  const boom = () => Promise.reject(new Error('opslag onbereikbaar'))

  return {
    name: realStorage.name,
    put: failing.includes('put') ? boom : realStorage.put.bind(realStorage),
    get: realStorage.get.bind(realStorage),
    delete: failing.includes('delete') ? boom : realStorage.delete.bind(realStorage),
    exists: realStorage.exists.bind(realStorage),
    getMetadata: failing.includes('getMetadata') ? boom : realStorage.getMetadata.bind(realStorage),
    signedUrl: realStorage.signedUrl.bind(realStorage),
  } as StorageProvider
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

describeIfDatabase('PENDING-overgangen', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Levenscyclus')).id
  })

  afterEach(() => {
    setStorageProvider(realStorage)
  })

  afterAll(async () => {
    setStorageProvider(realStorage)
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('gaat van PENDING naar AVAILABLE bij een geslaagde upload', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())

    const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(row.status).toBe(DocumentStatus.AVAILABLE)
    expect(row.checksum).not.toBeNull()
    expect(row.failureReason).toBeNull()
    expect(await realStorage.exists(row.storageKey)).toBe(true)
  })

  it('gaat van PENDING naar FAILED wanneer de opslag wegvalt', async () => {
    // Scenario 1. De rij bestaat al vóór het schrijven, dus de storing laat een
    // spoor achter dat zichzelf verklaart in plaats van stilte.
    setStorageProvider(brokenStorage(['put']))

    await expect(service.uploadDocument(userId, upload({ data: pdf('mislukt') }))).rejects.toThrow()

    const row = await prisma.document.findFirstOrThrow({
      where: { userId, status: DocumentStatus.FAILED },
      orderBy: { createdAt: 'desc' },
    })
    expect(row.failureReason).toBeTruthy()
    // Geen weesbestand: er is niets weggeschreven.
    expect(await realStorage.exists(row.storageKey)).toBe(false)
  })

  it('houdt geen weesbestand over wanneer de opslag faalt', async () => {
    setStorageProvider(brokenStorage(['put']))
    const before = await prisma.document.count({ where: { userId } })

    await expect(service.uploadDocument(userId, upload({ data: pdf('wees') }))).rejects.toThrow()

    // Wél een rij: dát is het punt. Een mislukking zonder rij zou onzichtbaar zijn.
    expect(await prisma.document.count({ where: { userId } })).toBe(before + 1)
  })

  it('laat een PENDING-rij binnen de respijtperiode met rust', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PENDING, createdAt: new Date() },
    })
    // Zonder bestand: anders is het antwoord meteen 'mark_available'.
    const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    await realStorage.delete(row.storageKey)

    expect(await service.reconcileDocument(userId, documentId)).toBe(DocumentStatus.PENDING)
  })

  it('zet een verlopen PENDING zonder bestand op FAILED', async () => {
    // Scenario 4.
    const { documentId } = await service.uploadDocument(userId, upload())
    const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    await realStorage.delete(row.storageKey)

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING,
        createdAt: minutesAgo(PENDING_GRACE_MINUTES + 5),
      },
    })

    expect(await service.reconcileDocument(userId, documentId)).toBe(DocumentStatus.FAILED)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.failureReason).toBeTruthy()
  })

  it('zet een PENDING mét bestand alsnog op AVAILABLE', async () => {
    // Scenario 2: het bestand staat er, alleen de bevestiging ontbrak. Niets
    // weggooien — dat zou een geslaagde upload alsnog laten verdwijnen.
    const { documentId } = await service.uploadDocument(userId, upload({ data: pdf('bestaat wel') }))
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PENDING, sizeBytes: 0 },
    })

    expect(await service.reconcileDocument(userId, documentId)).toBe(DocumentStatus.AVAILABLE)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.sizeBytes).toBeGreaterThan(0)
  })

  it('raakt een AVAILABLE-rij niet aan', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    expect(await service.reconcileDocument(userId, documentId)).toBe(DocumentStatus.AVAILABLE)
  })

  it('laat een ander de rij van deze gebruiker niet reconciliëren', async () => {
    const intruder = await createUser('Indringer')
    try {
      const { documentId } = await service.uploadDocument(userId, upload())
      await expect(service.reconcileDocument(intruder.id, documentId)).rejects.toThrow()
    } finally {
      await deleteUser(intruder.id)
    }
  })
})

describeIfDatabase('compensatie in beide richtingen', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Compensatie')).id
  })

  afterEach(() => {
    setStorageProvider(realStorage)
  })

  afterAll(async () => {
    setStorageProvider(realStorage)
    await deleteUser(userId)
  })

  it('richting 1 — opslag faalt na het aanmaken van de rij: FAILED, geen bestand', async () => {
    setStorageProvider(brokenStorage(['put']))
    await expect(service.uploadDocument(userId, upload({ data: pdf('richting1') }))).rejects.toThrow()

    const row = await prisma.document.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    expect(row.status).toBe(DocumentStatus.FAILED)
    expect(await realStorage.exists(row.storageKey)).toBe(false)
  })

  it('richting 2 — wissen faalt na het verwijderen: rij DELETED, purgedAt leeg', async () => {
    // Scenario 3. De gebruiker heeft op verwijderen geklikt, dus de rij moet
    // meteen DELETED zijn — hij hoort niet te wachten op de opslag. Maar
    // `purgedAt` blijft leeg, want het bestand ís er nog. Dat verschil is het
    // hele punt: zonder die twee velden denkt de gebruiker dat zijn loonfiche
    // weg is terwijl hij op schijf blijft staan.
    const { documentId } = await service.uploadDocument(userId, upload({ data: pdf('richting2') }))
    const before = await repository.requireDocument(userId, documentId)

    setStorageProvider(brokenStorage(['delete']))
    await service.deleteDocument(userId, documentId)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.status).toBe(DocumentStatus.DELETED)
    expect(after.deletedAt).not.toBeNull()
    expect(after.purgedAt).toBeNull()

    // Het bestand staat er inderdaad nog — de opruimwachtrij is geen formaliteit.
    setStorageProvider(realStorage)
    expect(await realStorage.exists(before.storageKey)).toBe(true)

    // En de opruimtaak maakt het af.
    await service.purgeOrphans()
    expect(await realStorage.exists(before.storageKey)).toBe(false)
    const purged = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(purged.purgedAt).not.toBeNull()
  })

  it('laat een mislukte checklistkoppeling de upload niet terugdraaien', async () => {
    // Het bestand is opgeslagen; dat is wat telt. Een fout in een afgeleide
    // administratie mag geen document laten verdwijnen.
    const { documentId } = await service.uploadDocument(
      userId,
      upload({ checklistItemKey: 'bestaat.niet' }),
    )

    const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(row.status).toBe(DocumentStatus.AVAILABLE)
  })
})

describeIfDatabase('opruimen: eerste, tweede en gelijktijdige run', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Opruimen')).id
  })

  afterAll(async () => {
    setStorageProvider(realStorage)
    await deleteUser(userId)
  })

  /** Een rij die opgeruimd moet worden: DELETED, maar het bestand staat er nog. */
  async function orphan(label: string) {
    const { documentId } = await service.uploadDocument(userId, upload({ data: pdf(label) }))
    const row = await repository.requireDocument(userId, documentId)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.DELETED, deletedAt: new Date(), purgedAt: null },
    })
    return { documentId, storageKey: row.storageKey }
  }

  it('ruimt bij de eerste run op en laat bij de tweede niets meer te doen', async () => {
    const { documentId, storageKey } = await orphan('eerste-run')

    const first = await service.purgeOrphans()
    expect(first.purged).toBeGreaterThan(0)
    expect(first.failures).toBe(0)
    expect(await realStorage.exists(storageKey)).toBe(false)

    const second = await service.purgeOrphans()
    // Idempotent: dezelfde rij wordt niet nóg eens meegeteld.
    expect(second.purged).toBe(0)
    expect(second.failures).toBe(0)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.purgedAt).not.toBeNull()
  })

  it('blijft correct wanneer drie runs elkaar overlappen', async () => {
    // Gelijktijdig opruimen mag geen fouten opleveren en geen rij dubbel
    // verwerken. `rm --force` op een bestand dat een andere run net wiste is
    // geen storing; dat is precies waarom de provider daar niet op gooit.
    const orphans = await Promise.all([orphan('gelijk-a'), orphan('gelijk-b'), orphan('gelijk-c')])

    const reports = await Promise.all([
      service.purgeOrphans(),
      service.purgeOrphans(),
      service.purgeOrphans(),
    ])

    expect(reports.every((r) => r.failures === 0)).toBe(true)

    for (const { documentId, storageKey } of orphans) {
      expect(await realStorage.exists(storageKey)).toBe(false)
      const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
      expect(row.purgedAt).not.toBeNull()
    }
  })

  it('laat een rij in de wachtrij staan wanneer het wissen blijft falen', async () => {
    // Niet stilzwijgend op purged zetten: dan zou een bestand dat nooit
    // verdween wél als verdwenen geboekt staan.
    const { documentId } = await orphan('blijft-falen')

    setStorageProvider(brokenStorage(['delete']))
    const report = await service.purgeOrphans()
    setStorageProvider(realStorage)

    expect(report.failures).toBeGreaterThan(0)

    const row = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(row.purgedAt).toBeNull()

    // En de volgende ronde pakt hem alsnog op.
    const retry = await service.purgeOrphans()
    expect(retry.purged).toBeGreaterThan(0)
    expect(
      (await prisma.document.findUniqueOrThrow({ where: { id: documentId } })).purgedAt,
    ).not.toBeNull()
  })
})
