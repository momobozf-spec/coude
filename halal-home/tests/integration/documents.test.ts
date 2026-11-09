/**
 * Documenten tegen een echte database en een echte (lokale) opslag.
 *
 * Wat hier bewezen wordt en in unit tests niet kan: dat een upload werkelijk
 * een bestand wegschrijft, dat verwijderen het écht wist, en dat gebruiker A
 * niets van B kan lezen, downloaden, wijzigen of verwijderen.
 *
 * Draaien: TEST_DATABASE_URL=postgresql://… npm run test:integration
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { DocumentCategory, DocumentStatus } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import { createJourneyWithBlueprint } from '@/modules/journey/service'
import * as service from '@/modules/documents/service'
import * as repository from '@/modules/documents/repository'
import { computeChecksum } from '@/modules/documents/domain/integrity'
import { getStorageProvider } from '@/server/storage'

/** Een geldige PDF: de magic-byte-controle eist %PDF aan het begin. */
const pdf = (content = 'testinhoud') =>
  Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), Buffer.from(content)])

const upload = (overrides: Partial<service.UploadInput> = {}): service.UploadInput => ({
  category: DocumentCategory.IDENTITY,
  originalFilename: 'identiteitskaart.pdf',
  mimeType: 'application/pdf',
  data: pdf(),
  ...overrides,
})

describeIfDatabase('uploaden', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('schrijft het bestand weg en zet de rij op AVAILABLE', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())

    const document = await repository.requireDocument(userId, documentId)
    expect(document.status).toBe(DocumentStatus.AVAILABLE)
    expect(document.sizeBytes).toBeGreaterThan(0)

    // Het bestand staat er werkelijk.
    expect(await getStorageProvider().exists(document.storageKey)).toBe(true)
  })

  it('legt de checksum vast', async () => {
    const data = pdf('unieke inhoud voor de checksum')
    const { documentId } = await service.uploadDocument(userId, upload({ data }))

    const document = await repository.requireDocument(userId, documentId)
    expect(document.checksum).toBe(computeChecksum(data))
  })

  it('gebruikt een onraadbare sleutel zonder de bestandsnaam', async () => {
    const { documentId } = await service.uploadDocument(
      userId,
      upload({ originalFilename: 'loonfiche-januari.pdf' }),
    )

    const document = await repository.requireDocument(userId, documentId)
    expect(document.storageKey).not.toContain('loonfiche')
    expect(document.storageKey).toMatch(new RegExp(`^documents/${userId}/identity/`))
    // De naam blijft wel als metadata bestaan.
    expect(document.originalFilename).toBe('loonfiche-januari.pdf')
  })

  it('meldt een dubbele upload zonder hem te blokkeren', async () => {
    const data = pdf('exact hetzelfde bestand')

    const first = await service.uploadDocument(userId, upload({ data }))
    const second = await service.uploadDocument(userId, upload({ data }))

    expect(first.duplicateOf).toBeNull()
    expect(second.duplicateOf?.id).toBe(first.documentId)
  })

  it('weigert een bestand waarvan de inhoud niet bij het type past', async () => {
    await expect(
      service.uploadDocument(
        userId,
        upload({ data: Buffer.from('<html><script>alert(1)</script></html>') }),
      ),
    ).rejects.toThrow()
  })

  it('weigert een leeg bestand', async () => {
    await expect(
      service.uploadDocument(userId, upload({ data: Buffer.alloc(0) })),
    ).rejects.toThrow()
  })

  it('weigert een niet-toegestaan type', async () => {
    await expect(
      service.uploadDocument(
        userId,
        upload({ mimeType: 'application/zip', originalFilename: 'archief.zip' }),
      ),
    ).rejects.toThrow()
  })
})

describeIfDatabase('downloaden', () => {
  let userId: string
  let documentId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    documentId = (await service.uploadDocument(userId, upload({ data: pdf('download mij') })))
      .documentId
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('geeft de inhoud terug', async () => {
    const result = await service.downloadDocument(userId, documentId)

    expect(result.data.toString()).toContain('download mij')
    expect(result.mimeType).toBe('application/pdf')
  })

  it('legt de download vast in de audittrail zonder inhoud', async () => {
    await service.downloadDocument(userId, documentId)

    const audit = await prisma.auditLog.findFirst({
      where: { userId, action: 'DOCUMENT_DOWNLOADED', entityId: documentId },
      orderBy: { createdAt: 'desc' },
    })

    expect(audit).not.toBeNull()
    expect(JSON.stringify(audit?.metadata)).not.toContain('download mij')
  })

  it('geeft een kortlevende URL', async () => {
    const url = await service.createDownloadUrl(userId, documentId)

    expect(url).toContain('signature=')
    expect(url).toContain('expires=')
  })
})

describeIfDatabase('verwijderen', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('wist het bestand écht en markeert de rij', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    const before = await repository.requireDocument(userId, documentId)

    await service.deleteDocument(userId, documentId)

    // Het bestand is weg uit de opslag.
    expect(await getStorageProvider().exists(before.storageKey)).toBe(false)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.status).toBe(DocumentStatus.DELETED)
    expect(after.deletedAt).not.toBeNull()
    // purgedAt bewijst dat het wissen gelukt is.
    expect(after.purgedAt).not.toBeNull()
  })

  it('weigert dubbel verwijderen', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    await service.deleteDocument(userId, documentId)

    await expect(service.deleteDocument(userId, documentId)).rejects.toThrow()
  })

  it('verbergt verwijderde documenten in de lijst', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    await service.deleteDocument(userId, documentId)

    const visible = await repository.listDocuments(userId)
    expect(visible.map((d) => d.id)).not.toContain(documentId)

    const all = await repository.listDocuments(userId, { includeDeleted: true })
    expect(all.map((d) => d.id)).toContain(documentId)
  })

  it('maakt de checklistkoppeling los', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: 'Documenttraject' })
    const { documentId } = await service.uploadDocument(userId, upload({ journeyId: journey.id }))

    const item = await prisma.checklistItem.findFirst({
      where: { documentCategory: DocumentCategory.IDENTITY },
      select: { id: true },
    })

    if (item) {
      await prisma.userChecklistItem.upsert({
        where: { journeyId_itemId: { journeyId: journey.id, itemId: item.id } },
        create: { userId, journeyId: journey.id, itemId: item.id, documentId },
        update: { documentId },
      })

      await service.deleteDocument(userId, documentId)

      const after = await prisma.userChecklistItem.findFirst({
        where: { journeyId: journey.id, itemId: item.id },
      })
      // Een afgevinkt item mag niet naar een verwijderd document blijven wijzen.
      expect(after?.documentId).toBeNull()
    }
  })
})

describeIfDatabase('uitleg', () => {
  let userId: string
  let documentId: string

  beforeAll(async () => {
    userId = (await createUser()).id
    documentId = (
      await service.uploadDocument(
        userId,
        upload({ category: DocumentCategory.PURCHASE_AGREEMENT }),
      )
    ).documentId
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('maakt een uitleg met de checksum van het bronbestand', async () => {
    const explanation = await service.requestExplanation(userId, documentId)
    const document = await repository.requireDocument(userId, documentId)

    expect(explanation.sourceChecksum).toBe(document.checksum)
    expect(explanation.disclaimer.length).toBeGreaterThan(0)
  })

  it('maakt een nieuwe rij in plaats van de oude te overschrijven', async () => {
    const first = await service.requestExplanation(userId, documentId)
    const second = await service.requestExplanation(userId, documentId)

    expect(second.id).not.toBe(first.id)

    const all = await repository.listExplanations(userId, documentId)
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it('markeert een uitleg als verouderd na een nieuwe upload', async () => {
    // Simuleert een gewijzigd bronbestand: andere checksum op de rij.
    await prisma.document.update({
      where: { id: documentId },
      data: { checksum: 'volledig-andere-checksum' },
    })

    const view = await service.getExplanationView(userId, documentId)
    expect(view?.freshness).toBe('outdated')
  })
})

describeIfDatabase('user isolation op documenten', () => {
  let alice: string
  let bob: string
  let aliceDocumentId: string

  beforeAll(async () => {
    alice = (await createUser('Alice')).id
    bob = (await createUser('Bob')).id
    aliceDocumentId = (await service.uploadDocument(alice, upload())).documentId
  })

  afterAll(async () => {
    await deleteUser(alice)
    await deleteUser(bob)
  })

  it('Bob kan het document van Alice niet lezen', async () => {
    expect(await repository.findDocument(bob, aliceDocumentId)).toBeNull()
    await expect(repository.requireDocument(bob, aliceDocumentId)).rejects.toThrow()
  })

  it('Bob kan het niet downloaden', async () => {
    await expect(service.downloadDocument(bob, aliceDocumentId)).rejects.toThrow()
  })

  it('Bob krijgt geen gesigneerde URL', async () => {
    await expect(service.createDownloadUrl(bob, aliceDocumentId)).rejects.toThrow()
  })

  it('Bob kan het niet verwijderen', async () => {
    await expect(service.deleteDocument(bob, aliceDocumentId)).rejects.toThrow()

    const after = await prisma.document.findUniqueOrThrow({ where: { id: aliceDocumentId } })
    expect(after.status).toBe(DocumentStatus.AVAILABLE)
  })

  it('Bob kan de metadata niet wijzigen', async () => {
    await expect(
      repository.updateMetadata(bob, aliceDocumentId, { displayName: 'gekaapt' }),
    ).rejects.toThrow()

    const after = await prisma.document.findUniqueOrThrow({ where: { id: aliceDocumentId } })
    expect(after.displayName).not.toBe('gekaapt')
  })

  it('Bob kan er geen uitleg bij opvragen', async () => {
    await expect(service.requestExplanation(bob, aliceDocumentId)).rejects.toThrow()
  })

  it('Bob ziet het niet in zijn lijst', async () => {
    const documents = await repository.listDocuments(bob)
    expect(documents.map((d) => d.id)).not.toContain(aliceDocumentId)
  })

  it('Alice kan haar document niet aan het traject van Bob koppelen', async () => {
    const bobJourney = await createJourneyWithBlueprint(bob, { name: 'Bob traject' })

    await expect(
      service.uploadDocument(alice, upload({ journeyId: bobJourney.id })),
    ).rejects.toThrow()
  })

  it('Alice kan haar document niet aan een niet-bewaarde woning koppelen', async () => {
    const property = await prisma.property.create({
      data: {
        source: 'test',
        externalId: `iso-${Date.now()}`,
        url: `https://example.com/iso-${Date.now()}`,
        urlNormalized: `https://example.com/iso-${Date.now()}`,
        fingerprint: `iso-${Date.now()}`,
        title: 'Woning van niemand',
      },
    })

    await expect(
      service.uploadDocument(alice, upload({ propertyId: property.id })),
    ).rejects.toThrow()

    await prisma.property.delete({ where: { id: property.id } })
  })
})

describeIfDatabase('opruimen', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser()).id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('wist alsnog wat eerder niet gewist raakte', async () => {
    const { documentId } = await service.uploadDocument(userId, upload())
    const document = await repository.requireDocument(userId, documentId)

    // Simuleert scenario 3: rij op DELETED, bestand blijft staan.
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.DELETED, deletedAt: new Date(), purgedAt: null },
    })
    expect(await getStorageProvider().exists(document.storageKey)).toBe(true)

    const report = await service.purgeOrphans()

    expect(report.purged).toBeGreaterThan(0)
    expect(await getStorageProvider().exists(document.storageKey)).toBe(false)

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.purgedAt).not.toBeNull()
  })

  it('is veilig om twee keer te draaien', async () => {
    await expect(service.purgeOrphans()).resolves.toBeDefined()
    await expect(service.purgeOrphans()).resolves.toBeDefined()
  })
})
