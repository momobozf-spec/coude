import 'dotenv/config'

import { prisma } from '@/server/db/prisma'
import { recordAudit } from '@/server/services/audit'

/**
 * Geeft een bestaand account de rol ADMIN (prijzen publiceren, goede doelen
 * beheren). Het account moet eerst gewoon geregistreerd zijn.
 *
 *   ADMIN_EMAIL=jij@voorbeeld.be npm run admin:grant
 *   ADMIN_EMAIL=jij@voorbeeld.be ADMIN_REVOKE=1 npm run admin:grant
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) {
    process.stderr.write('Zet ADMIN_EMAIL op het e-mailadres van een bestaand account.\n')
    process.exitCode = 1
    return
  }
  const revoke = process.env.ADMIN_REVOKE === '1'

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } })
  if (!user || user.deletedAt) {
    process.stderr.write(`Geen actief account gevonden voor ${email}. Registreer het eerst via /register.\n`)
    process.exitCode = 1
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    // Rolwijziging trekt bestaande sessies in, zodat de nieuwe rol meteen geldt.
    data: { role: revoke ? 'USER' : 'ADMIN', sessionVersion: { increment: 1 } },
  })
  await recordAudit({
    userId: user.id,
    action: 'SESSIONS_REVOKED',
    entityType: 'User',
    entityId: user.id,
    metadata: { reason: revoke ? 'admin_revoked' : 'admin_granted' },
  })

  process.stdout.write(`${email} is nu ${revoke ? 'gewone gebruiker' : 'beheerder'}. Log opnieuw in.\n`)
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
