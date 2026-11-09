/**
 * Hulpmiddelen voor de integratietests.
 *
 * Elke test maakt zijn eigen gebruikers met een uniek e-mailadres, en ruimt na
 * afloop op. Zo kunnen tests naast elkaar bestaan in dezelfde database zonder
 * elkaars data te zien — en blijft een mislukte test niet als rommel achter.
 */
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

let counter = 0

/** Een uniek e-mailadres per aanroep, zodat tests elkaar niet raken. */
export function uniqueEmail(prefix = 'test'): string {
  counter += 1
  return `${prefix}-${process.pid}-${counter}@integration.local`
}

export async function createUser(name = 'Testgebruiker') {
  return prisma.user.create({
    data: { email: uniqueEmail(), name, passwordHash: 'niet-gebruikt-in-tests' },
    select: { id: true, email: true },
  })
}

/**
 * Verwijdert een gebruiker en alles wat eraan hangt.
 *
 * De cascades in het schema doen het meeste werk; dit is de enige plek waar we
 * daarop leunen, en dat is meteen een impliciete test dat ze kloppen.
 */
export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { id: userId } })
}

/**
 * De checklist-templates die de tests nodig hebben.
 *
 * Idempotent, zodat meerdere testbestanden hem kunnen aanroepen zonder
 * duplicaten te maken.
 */
export async function ensureChecklistTemplate(key = 'test.checklist') {
  const template = await prisma.checklistTemplate.upsert({
    where: { key },
    create: {
      key,
      name: 'Testchecklist',
      scope: 'DOCUMENTS',
      country: 'BE',
      sortOrder: 999,
    },
    update: {},
  })

  await prisma.checklistItem.upsert({
    where: { templateId_key: { templateId: template.id, key: `${key}.item1` } },
    create: {
      templateId: template.id,
      key: `${key}.item1`,
      title: 'Verplicht testitem',
      importance: 'REQUIRED',
      sortOrder: 0,
    },
    update: {},
  })

  return template
}
