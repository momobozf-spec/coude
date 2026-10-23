import 'dotenv/config'

import { createPrismaClient } from '../../src/server/db/create-client'

import { seedRuleSets } from './rulesets'
import { seedCharities } from './charities'
import { seedKnowledge } from './knowledge'
import { seedCharityEvidence } from './charity-claims'
import { DEV_PASSWORD, seedFinancials, seedUsers } from './users'
import { seedDonationsAndGoals, seedFinalizedCalculation } from './donations'
import { seedDraftCalculation } from './calculations'
import { seedReminders } from './reminders'

/**
 * Development seed. Idempotent — every write is an upsert or a delete-then-create,
 * so running it twice leaves the same database.
 *
 * Refuses to run against production: this creates accounts with a known password.
 */

const prisma = createPrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The seed creates development accounts and must not run in production.')
  }

  console.log('Seeding…')

  const ruleSet = await seedRuleSets(prisma)
  console.log(`  ruleset      ${ruleSet.version}`)

  const { causes, charities } = await seedCharities(prisma)
  console.log(`  causes       ${causes}`)
  console.log(`  charities    ${charities}`)

  const evidence = await seedCharityEvidence(prisma)
  console.log(`  claims       ${evidence.claims} over ${evidence.charities} demo-organisaties`)
  console.log(`  sources      ${evidence.sources}`)

  const articles = await seedKnowledge(prisma)
  console.log(`  articles     ${articles}`)

  const { mohamed, aisha } = await seedUsers(prisma)
  await seedFinancials(prisma, mohamed.id)

  // Aisha holds data purely so that a leak between users is visible in the UI.
  await seedFinancials(prisma, aisha.id)

  console.log('  users        2')

  // Left as a DRAFT on purpose: shipping a finalised worked example would read
  // as settled religious advice rather than as demo data (§32).
  const draft = await seedDraftCalculation(prisma, mohamed.id)
  if (draft) {
    console.log(`  draft calc   ${draft.id}`)
  }

  // A finalised 2025 year, deliberately left partially paid so the payment
  // tracking UI has a real state to render on first run (§44).
  const finalized = await seedFinalizedCalculation(prisma, mohamed.id)
  const { goalId } = await seedDonationsAndGoals(prisma, mohamed.id, finalized?.id ?? null)

  if (finalized) {
    console.log(`  finalized    ${finalized.id}  (Zakat 2025 — EUR 800 van 1375 betaald)`)
  }
  console.log(`  sadaqah goal ${goalId}  (EUR 50/maand, nu op 35)`)

  const scheduling = await seedReminders(prisma, mohamed.id, finalized?.id ?? null)
  console.log(
    `  reminders    ${scheduling.reminders} · notifications ${scheduling.notifications}`,
  )
  console.log('')
  console.log('Development accounts:')
  console.log(`  ${mohamed.email} / ${DEV_PASSWORD}   (Familie-plan, met vermogen en donaties)`)
  console.log(`  ${aisha.email} / ${DEV_PASSWORD}   (Gratis plan — mag nooit zichtbaar zijn bij de eerste)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
