import 'dotenv/config'

import { readFile } from 'node:fs/promises'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { importCharity } from '@/server/modules/charities/import-service'

/**
 * Een goed doel opnemen of bijwerken vanuit een nagekeken JSON-bestand.
 *
 *   ADMIN_EMAIL=jij@voorbeeld.be CHARITY_FILE=charities/naam.json npm run charity:import
 *
 * Voorbeeld en uitleg: docs/charity-example.json en docs/DEPLOY.md.
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const file = process.env.CHARITY_FILE
  if (!email || !file) {
    process.stderr.write('Zet ADMIN_EMAIL (een beheerder) en CHARITY_FILE (pad naar het JSON-bestand).\n')
    process.exitCode = 1
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, deletedAt: true },
  })
  if (!user || user.deletedAt || user.role !== 'ADMIN') {
    process.stderr.write(`${email} is geen actieve beheerder (zie npm run admin:grant).\n`)
    process.exitCode = 1
    return
  }

  const actor: Actor = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: 'FREE',
    locale: 'nl',
    timezone: 'Europe/Brussels',
    defaultCurrency: 'EUR',
    onboarded: true,
    households: [],
  }

  const result = await importCharity(actor, JSON.parse(await readFile(file, 'utf8')))
  process.stdout.write(
    `${result.created ? 'Aangemaakt' : 'Bijgewerkt'}: ${result.charityId} — ${result.sources} bron(nen), ` +
      `${result.claimsWritten} claim(s) geschreven, ${result.claimsUnchanged} ongewijzigd.\n`,
  )
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
