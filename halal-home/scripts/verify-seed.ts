/**
 * Draait de seed twee keer tegen een wegwerpbare PostgreSQL en controleert dat
 * hij idempotent is.
 *
 * ─── WAAROM DIT EEN APART SCRIPT IS ──────────────────────────────────────────
 *
 * De seed is een los proces (`tsx prisma/seed.ts`) met een eigen
 * PrismaClient. Hem vanuit Vitest aanroepen zou betekenen dat we óf de
 * interne functies importeren — en dan test je niet het script dat werkelijk
 * draait — óf een subproces starten vanuit een test, wat de suite traag en
 * ondoorzichtig maakt.
 *
 * Dit script start dezelfde ingebedde PostgreSQL als de integratiesuite, past
 * de migraties toe, en draait daarna `npm run db:seed` twee keer. Precies zoals
 * een ontwikkelaar het zou doen.
 *
 * Draaien: npm run db:verify-seed
 */
import { execFileSync } from 'node:child_process'

import {
  assertSafeTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/integration/database'

interface Counts {
  users: number
  journeys: number
  tasks: number
  dependencies: number
  blockingDependencies: number
  checklistTemplates: number
  checklistItems: number
  userChecklistItems: number
  terms: number
  costRules: number
  financingProviders: number
  financingProducts: number
  properties: number
  serviceProviders: number
  searches: number
  savedProperties: number
  documents: number
  events: number
}

function run(command: string, args: string[], databaseUrl: string): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === 'win32',
  })
}

async function countAll(databaseUrl: string): Promise<Counts> {
  // Verse client per meting: de seed draait in een eigen proces, dus een
  // gedeelde verbinding zou verouderde tellingen kunnen geven.
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

  try {
    return {
      users: await prisma.user.count(),
      journeys: await prisma.homeBuyingJourney.count(),
      tasks: await prisma.journeyTask.count(),
      dependencies: await prisma.taskDependency.count(),
      // Apart geteld: als de seed alleen `dependsOn` zou toepassen, blijft het
      // totaal kloppen terwijl elk geseed traject stilletjes onbeschermd is.
      blockingDependencies: await prisma.taskDependency.count({
        where: { type: 'BLOCKING' },
      }),
      checklistTemplates: await prisma.checklistTemplate.count(),
      checklistItems: await prisma.checklistItem.count(),
      userChecklistItems: await prisma.userChecklistItem.count(),
      terms: await prisma.propertyTerm.count(),
      costRules: await prisma.costRule.count(),
      financingProviders: await prisma.financingProvider.count(),
      financingProducts: await prisma.financingProduct.count(),
      properties: await prisma.property.count(),
      serviceProviders: await prisma.serviceProvider.count(),
      searches: await prisma.propertySearch.count(),
      savedProperties: await prisma.savedProperty.count(),
      documents: await prisma.document.count(),
      events: await prisma.journeyEvent.count(),
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? (await startTestDatabase())

  // Dit script draait migraties en een seed. Zonder deze controle zou een
  // verkeerd gezette TEST_DATABASE_URL een echte database vullen.
  assertSafeTestDatabase(databaseUrl)

  try {
    console.log('Migraties toepassen op een lege database…')
    run('npx', ['prisma', 'migrate', 'deploy'], databaseUrl)

    console.log('\nSeed — eerste run')
    const firstOutput = run('npx', ['tsx', 'prisma/seed.ts'], databaseUrl)
    console.log(firstOutput.trim())
    const first = await countAll(databaseUrl)

    console.log('\nSeed — tweede run (idempotentiecontrole)')
    const secondOutput = run('npx', ['tsx', 'prisma/seed.ts'], databaseUrl)
    console.log(secondOutput.trim())
    const second = await countAll(databaseUrl)

    console.log('\n─── Tellingen ───')
    const problems: string[] = []

    for (const key of Object.keys(first) as (keyof Counts)[]) {
      const a = first[key]
      const b = second[key]
      const equal = a === b

      console.log(`${equal ? '  ok  ' : ' FOUT '} ${key.padEnd(22)} ${a} → ${b}`)
      if (!equal) problems.push(`${key}: ${a} → ${b}`)
    }

    if (first.blockingDependencies === 0) {
      throw new Error(
        'De seed legde geen enkele BLOCKING-afhankelijkheid vast. Een geseed ' +
          'traject zou dan een bod zonder financieringsbewijs toestaan.',
      )
    }

    if (problems.length > 0) {
      throw new Error(
        `De seed is niet idempotent. Deze tellingen veranderden bij de tweede run:\n` +
          problems.map((p) => `  - ${p}`).join('\n'),
      )
    }

    console.log('\nDe seed is idempotent: tweede run geeft identieke tellingen.')
  } finally {
    if (!process.env.TEST_DATABASE_URL) await stopTestDatabase()
  }
}

main().catch((error) => {
  console.error('\nSeedverificatie mislukt:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
