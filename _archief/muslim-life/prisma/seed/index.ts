import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

import { seedGeography } from './geography'
import { seedCategories } from './categories'
import { seedContent } from './content'
import { seedBusinesses } from './businesses'
import { seedDemoUser } from './demo-user'

const prisma = new PrismaClient()

async function main() {
  console.log('\n  Muslim Life — seeding database\n')

  const geography = await seedGeography(prisma)
  console.log(`  ✓ Geography      ${geography.countries} countries, ${geography.cities} cities`)

  const categories = await seedCategories(prisma)
  console.log(`  ✓ Categories     ${categories} categories`)

  const content = await seedContent(prisma)
  console.log(`  ✓ Daily content  ${content} verses, hadith and duas`)

  const discovery = await seedBusinesses(prisma)
  console.log(
    `  ✓ Discovery      ${discovery.businesses} businesses, ${discovery.deals} deals (all flagged as demo)`,
  )

  // Demo accounts are development-only. Seeding a known password into a
  // production database would be a critical vulnerability.
  if (process.env.NODE_ENV !== 'production') {
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
