/**
 * Upload-idempotentie tegen een echte database.
 *
 * ─── WAT HIER BEWEZEN MOET WORDEN, EN WAAROM MOCKS DAT NIET KUNNEN ───────────
 *
 * De garantie zit in een unique index op `(userId, idempotencyKey)`. Een mock
 * van de repository zou die index simuleren en dus precies datgene aannemen wat
 * bewezen moet worden. Twee gelijktijdige inserts die allebei de
 * bestaanscontrole passeren zijn alleen met een échte database te reproduceren.
 *
 * Vier eigenschappen, en ze zijn niet inwisselbaar:
 *
 *   1. dezelfde sleutel, twee verzoeken → één document;
 *   2. dezelfde bytes, verschillende sleutels → twéé documenten. De checksum
 *      mag een bewuste tweede upload niet stil tegenhouden;
 *   3. dezelfde sleutel, twee gebruikers → twee documenten. De index staat op
 *      `(userId, idempotencyKey)`, dus de sleutel van Bob raakt Alice niet;
 *   4. een replay na een mislukte poging maakt de bestaande rij af in plaats
 *      van er een tweede naast te zetten.
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { DocumentCategory, DocumentStatus, Prisma } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import * as service from '@/modules/documents/service'
import * as repository from '@/modules/documents/repository'
import { computeChecksum } from '@/modules/documents/domain/integrity'
import { getStorageProvider } from '@/server/storage'

const pdf = (content = 'testinhoud') =>
  Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.from(content)])

const upload = (overrides: Partial<service.UploadInput> = {}): service.UploadInput => ({
  category: DocumentCategory.INCOME,
  originalFilename: 'loonfiche.pdf',
  mimeType: 'application/pdf',
  data: pdf(),
  ...overrides,
})

let keyCounter = 0
const freshKey = (label: string) => `idem-${label}-${process.pid}-${(keyCounter += 1)}`

describeIfDatabase('upload-idempotentie', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Idempotent')).id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('maakt bij twee verzoeken met dezelfde sleutel maar één document', async () => {
    const idempotencyKey = freshKey('dubbel')

    const first = await service.uploadDocument(userId, upload({ idempotencyKey }))
    const second = await service.uploadDocument(userId, upload({ idempotencyKey }))

    expect(second.documentId).toBe(first.documentId)
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)

    const rows = await prisma.document.count({ where: { userId, idempotencyKey } })
    expect(rows).toBe(1)
  })

  it('houdt ook bij gelijktijdige verzoeken één document over', async () => {
    // Dit is het geval dat de bestaanscontrole in de service niet kan afvangen:
    // beide verzoeken zien "nog niets", en beide proberen te schrijven. Wat hen
    // tegenhoudt is de unique index, niet de applicatiecode.
    const idempotencyKey = freshKey('race')

    const results = await Promise.all([
      service.uploadDocument(userId, upload({ idempotencyKey })),
      service.uploadDocument(userId, upload({ idempotencyKey })),
      service.uploadDocument(userId, upload({ idempotencyKey })),
    ])

    const ids = new Set(results.map((r) => r.documentId))
    expect(ids.size).toBe(1)

    const rows = await prisma.document.count({ where: { userId, idempotencyKey } })
    expect(rows).toBe(1)

    // Precies één verzoek deed het echte werk; de rest herhaalde.
    expect(results.filter((r) => !r.replayed)).toHaveLength(1)
  })

  it('laat een bewuste tweede upload van dezelfde bytes wél door', async () => {
    // Twee loonfiches met identieke inhoud zijn een reëel geval. Op de checksum
    // dedupliceren zou hier stilzwijgend een document laten verdwijnen.
    const data = pdf('exact dezelfde bytes')

    const first = await service.uploadDocument(
      userId,
      upload({ data, idempotencyKey: freshKey('bytes-a') }),
    )
    const second = await service.uploadDocument(
      userId,
      upload({ data, idempotencyKey: freshKey('bytes-b') }),
    )

    expect(second.documentId).not.toBe(first.documentId)
    expect(second.replayed).toBe(false)

    // Beide rijen bestaan, met dezelfde checksum.
    const checksum = computeChecksum(data)
    const rows = await prisma.document.findMany({
      where: { userId, checksum, status: DocumentStatus.AVAILABLE },
      select: { id: true },
    })
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([first.documentId, second.documentId]))

    // En de gebruiker krijgt het wél te horen.
    expect(second.duplicateOf?.id).toBe(first.documentId)
  })

  it('werkt ook zonder sleutel — dan zonder bescherming', async () => {
    // Een client die geen sleutel stuurt, wordt niet geweigerd. Twee NULL-en
    // botsen niet in een unique index; dat is precies waarom de kolom optioneel
    // mag zijn.
    const data = pdf('geen sleutel')

    const first = await service.uploadDocument(userId, upload({ data }))
    const second = await service.uploadDocument(userId, upload({ data }))

    expect(second.documentId).not.toBe(first.documentId)

    const nulls = await prisma.document.count({ where: { userId, idempotencyKey: null } })
    expect(nulls).toBeGreaterThanOrEqual(2)
  })

  it('laat de sleutel van de ene gebruiker die van de andere ongemoeid', async () => {
    const other = await createUser('Andere')
    const idempotencyKey = freshKey('gedeeld')

    try {
      const mine = await service.uploadDocument(userId, upload({ idempotencyKey }))
      const theirs = await service.uploadDocument(other.id, upload({ idempotencyKey }))

      expect(theirs.documentId).not.toBe(mine.documentId)
      expect(theirs.replayed).toBe(false)
    } finally {
      await deleteUser(other.id)
    }
  })

  it('maakt bij een replay de mislukte poging af in plaats van een tweede rij', async () => {
    const idempotencyKey = freshKey('herstel')
    const { documentId } = await service.uploadDocument(userId, upload({ idempotencyKey }))

    // Simuleert een poging die de eindstreep niet haalde: rij op FAILED, bestand
    // uit de opslag weg.
    const document = await repository.requireDocument(userId, documentId)
    await getStorageProvider().delete(document.storageKey)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.FAILED, failureReason: 'opslag was even weg' },
    })

    const retry = await service.uploadDocument(userId, upload({ idempotencyKey }))

    expect(retry.documentId).toBe(documentId)
    expect(retry.replayed).toBe(true)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.status).toBe(DocumentStatus.AVAILABLE)
    expect(after.failureReason).toBeNull()
    // En het bestand staat er weer.
    expect(await getStorageProvider().exists(after.storageKey)).toBe(true)

    expect(await prisma.document.count({ where: { userId, idempotencyKey } })).toBe(1)
  })

  it('laat een verwijderd document niet herleven door een replay', async () => {
    // Anders zou een herhaald verzoek een verwijdering stil terugdraaien.
    const idempotencyKey = freshKey('verwijderd')
    const { documentId } = await service.uploadDocument(userId, upload({ idempotencyKey }))
    await service.deleteDocument(userId, documentId)

    const replay = await service.uploadDocument(userId, upload({ idempotencyKey }))

    expect(replay.documentId).toBe(documentId)
    expect(replay.replayed).toBe(true)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.status).toBe(DocumentStatus.DELETED)
    expect(after.purgedAt).not.toBeNull()
  })

  it('wordt afgedwongen door de database, niet alleen door de applicatie', async () => {
    // De service kán hem ontwijken; de index niet. Deze insert gaat om de
    // service heen en hoort te falen met P2002.
    const idempotencyKey = freshKey('constraint')
    await service.uploadDocument(userId, upload({ idempotencyKey }))

    const attempt = prisma.document.create({
      data: {
        userId,
        idempotencyKey,
        category: DocumentCategory.INCOME,
        originalFilename: 'stiekem.pdf',
        storageKey: `documents/${userId}/income/${freshKey('key')}`,
        mimeType: 'application/pdf',
        sizeBytes: 10,
      },
    })

    await expect(attempt).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    await expect(attempt).rejects.toMatchObject({ code: 'P2002' })
  })
})
