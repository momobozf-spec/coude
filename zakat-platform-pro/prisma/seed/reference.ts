import 'dotenv/config'

import { createPrismaClient } from '../../src/server/db/create-client'

import { seedRuleSets } from './rulesets'
import { seedCauses } from './charities'

/**
 * Referentiedata voor productie: de Zakat-regelset en de doel-categorieën.
 * Zonder regelset kan niemand een berekening maken.
 *
 *   npm run db:reference
 *
 * Idempotent (alleen upserts) en veilig op productie: geen accounts, geen
 * demo-organisaties, geen financiële gegevens. De kennisbankartikelen zitten
 * er bewust niet in — die staan op IN_REVIEW tot een geleerde ze nagekeken
 * heeft (zie docs/LAUNCH-CHECKLIST.md).
 */
const prisma = createPrismaClient()

async function main(): Promise<void> {
  const ruleSet = await seedRuleSets(prisma)
  const causes = await seedCauses(prisma)
  console.log(`Regelset ${ruleSet.version} en ${causes.size} categorieën staan klaar.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
