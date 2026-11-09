/**
 * Wat het schema belooft, en of de database dat ook waarmaakt.
 *
 * ─── WAAROM DIT EEN EIGEN SUITE VERDIENT ─────────────────────────────────────
 *
 * Foreign keys, unique constraints, cascades en transacties zijn de enige
 * garanties in dit systeem die niet van applicatiecode afhangen. Precies
 * daarom kan geen enkele unit test ze aantonen: een mock die
 * `Prisma.PrismaClientKnownRequestError` gooit bewijst alleen dat wíj denken
 * dat de constraint bestaat.
 *
 * Drie soorten belofte worden hier getoetst:
 *
 *   - unique: wat maar één keer mag bestaan, bestaat ook maar één keer;
 *   - referentiële integriteit: wat verwijst, verwijst naar iets dat bestaat,
 *     en het gedrag bij verwijderen (Cascade of SetNull) is wat het schema zegt;
 *   - atomiciteit: een transactie die halverwege faalt, laat níets achter.
 *
 * Die laatste is de belangrijkste. `createJourneyWithBlueprint` schrijft een
 * traject plus tientallen taken plus hun afhankelijkheden. Een halve schrijving
 * daar levert een gebruiker op met een traject dat nergens heen leidt.
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import { DocumentCategory, Prisma } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'
import { createJourneyWithBlueprint } from '@/modules/journey/service'
import * as documents from '@/modules/documents/service'

const pdf = () => Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.from('constraints')])

let counter = 0
const unique = (prefix: string) => `${prefix}-${process.pid}-${(counter += 1)}`

async function createProperty() {
  const id = unique('constraint')
  return prisma.property.create({
    data: {
      source: 'test',
      externalId: id,
      url: `https://example.com/${id}`,
      urlNormalized: `https://example.com/${id}`,
      fingerprint: id,
      title: 'Testwoning',
    },
  })
}

describeIfDatabase('unique constraints', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Constraints')).id
  })

  afterAll(async () => {
    await deleteUser(userId)
    await prisma.$disconnect()
  })

  it('laat twee documenten niet dezelfde storage key delen', async () => {
    // Twee rijen op één sleutel betekent dat verwijderen van de een het bestand
    // van de ander wist.
    const storageKey = `documents/${userId}/other/${unique('key')}`
    const base = {
      userId,
      category: DocumentCategory.OTHER,
      originalFilename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    }

    await prisma.document.create({ data: { ...base, storageKey } })
    await expect(prisma.document.create({ data: { ...base, storageKey } })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('laat twee gebruikers niet hetzelfde e-mailadres delen', async () => {
    const email = `${unique('dubbel')}@integration.local`
    await prisma.user.create({ data: { email, passwordHash: 'x' } })

    await expect(
      prisma.user.create({ data: { email, passwordHash: 'x' } }),
    ).rejects.toMatchObject({ code: 'P2002' })

    await prisma.user.deleteMany({ where: { email } })
  })

  it('laat één taak niet twee keer van dezelfde taak afhangen', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: unique('traject') })
    const dependency = await prisma.taskDependency.findFirstOrThrow({
      where: { task: { journeyId: journey.id } },
    })

    await expect(
      prisma.taskDependency.create({
        data: { taskId: dependency.taskId, dependsOnId: dependency.dependsOnId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('laat een checklist-item niet twee keer in hetzelfde traject staan', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: unique('checklist') })
    const existing = await prisma.userChecklistItem.findFirst({
      where: { journeyId: journey.id },
    })

    if (!existing) return // geen checklist-templates in deze database

    await expect(
      prisma.userChecklistItem.create({
        data: { userId, journeyId: journey.id, itemId: existing.itemId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})

describeIfDatabase('referentiële integriteit', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Relaties')).id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('weigert een document voor een gebruiker die niet bestaat', async () => {
    await expect(
      prisma.document.create({
        data: {
          userId: 'bestaat-echt-niet',
          category: DocumentCategory.OTHER,
          originalFilename: 'zwevend.pdf',
          storageKey: `documents/nergens/${unique('key')}`,
          mimeType: 'application/pdf',
          sizeBytes: 10,
        },
      }),
      // P2003: foreign key constraint failed.
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('ruimt bij het verwijderen van een gebruiker al zijn data op (Cascade)', async () => {
    const victim = await createUser('Vertrekker')
    const journey = await createJourneyWithBlueprint(victim.id, { name: unique('vertrek') })
    const { documentId } = await documents.uploadDocument(victim.id, {
      category: DocumentCategory.OTHER,
      originalFilename: 'van-mij.pdf',
      mimeType: 'application/pdf',
      data: pdf(),
    })

    await prisma.user.delete({ where: { id: victim.id } })

    // Niets van deze gebruiker blijft achter — dat is de belofte achter
    // "account verwijderen".
    expect(await prisma.document.count({ where: { id: documentId } })).toBe(0)
    expect(await prisma.homeBuyingJourney.count({ where: { id: journey.id } })).toBe(0)
    expect(await prisma.journeyTask.count({ where: { journeyId: journey.id } })).toBe(0)
    expect(await prisma.taskDependency.count({ where: { task: { journeyId: journey.id } } })).toBe(0)
  })

  it('laat een document staan wanneer de gekoppelde woning verdwijnt (SetNull)', async () => {
    // De woning is context, geen bestaansgrond. Een verkoopovereenkomst mag niet
    // verdwijnen omdat een zoekresultaat opgeruimd wordt.
    const property = await createProperty()
    await prisma.savedProperty.create({ data: { userId, propertyId: property.id } })

    const { documentId } = await documents.uploadDocument(userId, {
      category: DocumentCategory.PURCHASE_AGREEMENT,
      originalFilename: 'compromis.pdf',
      mimeType: 'application/pdf',
      data: pdf(),
      propertyId: property.id,
    })

    await prisma.savedProperty.deleteMany({ where: { propertyId: property.id } })
    await prisma.property.delete({ where: { id: property.id } })

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.propertyId).toBeNull()
    expect(after.status).toBe('AVAILABLE')
  })

  it('laat een document staan wanneer het traject verdwijnt (SetNull)', async () => {
    const journey = await createJourneyWithBlueprint(userId, { name: unique('los') })
    const { documentId } = await documents.uploadDocument(userId, {
      category: DocumentCategory.OTHER,
      originalFilename: 'losgekoppeld.pdf',
      mimeType: 'application/pdf',
      data: pdf(),
      journeyId: journey.id,
    })

    await prisma.homeBuyingJourney.delete({ where: { id: journey.id } })

    const after = await prisma.document.findUniqueOrThrow({ where: { id: documentId } })
    expect(after.journeyId).toBeNull()
  })
})

describeIfDatabase('transacties', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await createUser('Transacties')).id
  })

  afterAll(async () => {
    await deleteUser(userId)
  })

  it('laat niets achter wanneer een transactie halverwege faalt', async () => {
    const before = await prisma.homeBuyingJourney.count({ where: { userId } })

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.homeBuyingJourney.create({
          data: { userId, name: 'Wordt teruggedraaid', blueprintVersion: 1 },
        })
        // Alles tot hier is geldig. Deze regel niet.
        throw new Error('iets ging mis na de eerste schrijfactie')
      }),
    ).rejects.toThrow('iets ging mis')

    expect(await prisma.homeBuyingJourney.count({ where: { userId } })).toBe(before)
    expect(
      await prisma.homeBuyingJourney.count({ where: { userId, name: 'Wordt teruggedraaid' } }),
    ).toBe(0)
  })

  it('draait ook een constraint-fout halverwege volledig terug', async () => {
    const journey = await prisma.homeBuyingJourney.create({
      data: { userId, name: unique('constraint-rollback'), blueprintVersion: 1 },
    })
    const before = await prisma.journeyTask.count({ where: { journeyId: journey.id } })

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.journeyTask.create({
          data: {
            journeyId: journey.id,
            userId,
            templateKey: 'ROLLBACK_A',
            title: 'Eerste',
            stage: 'ORIENTATION',
            sortOrder: 1,
          },
        })
        await tx.journeyTask.create({
          data: {
            journeyId: journey.id,
            userId,
            templateKey: 'ROLLBACK_A', // zelfde sleutel: hier klapt hij
            title: 'Tweede',
            stage: 'ORIENTATION',
            sortOrder: 2,
          },
        })
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

    // Ook de eerste, op zichzelf geldige, taak is weg.
    expect(await prisma.journeyTask.count({ where: { journeyId: journey.id } })).toBe(before)
  })

  it('schrijft een traject en al zijn taken als één geheel', async () => {
    // De keerzijde: bij succes staat álles er. Een traject met de helft van
    // zijn taken zou een gebruiker opleveren die vastloopt zonder uitleg.
    const journey = await createJourneyWithBlueprint(userId, { name: unique('compleet') })

    const tasks = await prisma.journeyTask.count({ where: { journeyId: journey.id } })
    const dependencies = await prisma.taskDependency.count({
      where: { task: { journeyId: journey.id } },
    })

    expect(tasks).toBeGreaterThan(0)
    expect(dependencies).toBeGreaterThan(0)
    expect(journey.initializedAt).not.toBeNull()
  })
})
