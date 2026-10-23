import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

import { seedGeography } from './geography'
import { seedCategories } from './categories'
import { seedContent } from './content'
import { seedBusinesses } from './businesses'
import { seedDemoUser } from './demo-user'

/**
 * Seeding.
 *
 * Reference data (countries, cities, categories, daily content) is always
 * written and is idempotent — production start-up runs this on every boot.
 *
 * Demonstration listings are fictional. They are written outside production,
 * and in production only when `SEED_DEMO_LISTINGS=1` (a test deployment). Every
 * one is flagged `isDemo` and badged in the UI.
 *
 * Demo accounts with a known password are never written in production.
 */

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) })
const isProduction = process.env.NODE_ENV === 'production'

async function main() {
  console.log('\n  Muslim Life — seeding database\n')

  const geography = await seedGeography(prisma)
  console.log(`  ✓ Geography      ${geography.countries} countries, ${geography.cities} cities`)

  const categories = await seedCategories(prisma)
  console.log(`  ✓ Categories     ${categories} categories`)

  const content = await seedContent(prisma)
  console.log(`  ✓ Daily content  ${content} verses, hadith and duas`)

  if (!isProduction || process.env.SEED_DEMO_LISTINGS === '1') {
    const discovery = await seedBusinesses(prisma)
    console.log(
      `  ✓ Discovery      ${discovery.businesses} businesses, ${discovery.deals} deals (all flagged as demo)`,
    )
  } else {
    console.log('  – Demo listings  skipped (set SEED_DEMO_LISTINGS=1 for a test deployment)')
  }

  // Demo accounts are development-only. Seeding a known password into a
  // production database would be a critical vulnerability.
  if (!isProduction) {
    const demo = await seedDemoUser(prisma)
    if (demo) {
      console.log(
        `  ✓ Demo day       ${demo.habits} habits, ${demo.tasks} tasks, ${demo.blocks} planner blocks`,
      )
      console.log(
        `  ✓ Demo accounts  ${demo.email} / ${demo.adminEmail}  (password: ${demo.password})`,
      )
    }
  } else {
    console.log('  – Demo accounts  skipped in production')
  }

  console.log('\n  Done.\n')
}

main()
  .catch((error) => {
    console.error('\n  Seed failed:\n', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
