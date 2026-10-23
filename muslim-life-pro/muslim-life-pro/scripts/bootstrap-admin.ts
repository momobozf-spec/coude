/**
 * Promote one EXISTING account to administrator.
 *
 * No account is created and no password is set here: register normally first,
 * then set BOOTSTRAP_ADMIN_EMAIL and restart. Remove the variable afterwards.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com npx tsx scripts/bootstrap-admin.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const connectionString = process.env.DATABASE_URL
  if (!email || !connectionString) {
    console.log('bootstrap-admin: BOOTSTRAP_ADMIN_EMAIL or DATABASE_URL not set — nothing to do')
    return
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) })
  try {
    const result = await prisma.user.updateMany({
      where: { email, deletedAt: null },
      data: { role: 'ADMIN' },
    })
    console.log(
      result.count === 1
        ? 'bootstrap-admin: account promoted to ADMIN (sign out and in again)'
        : 'bootstrap-admin: no account with that e-mail yet — register first, then restart',
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('bootstrap-admin failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
