import 'dotenv/config'

import { prisma } from '@/server/db/prisma'
import { unlockByEmail } from '@/server/modules/account/service'

/**
 * Heft de inlogvergrendeling van één account op.
 *
 *   UNLOCK_EMAIL=iemand@voorbeeld.be npm run unlock:user
 *
 * Een gebruiker kan zichzelf ook ontgrendelen via "Wachtwoord vergeten".
 */
async function main(): Promise<void> {
  const email = process.env.UNLOCK_EMAIL?.trim().toLowerCase()
  if (!email) {
    process.stderr.write('Zet UNLOCK_EMAIL op het e-mailadres van het account.\n')
    process.exitCode = 1
    return
  }

  const userId = await unlockByEmail(email)
  if (!userId) {
    process.stderr.write(`Geen account gevonden voor ${email}.\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`${email} is ontgrendeld.\n`)
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
