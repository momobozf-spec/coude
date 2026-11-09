/**
 * Registratie.
 *
 * Apart van `config.ts` zodat de server action hem kan aanroepen zonder de
 * Auth.js-handler te importeren.
 */
import 'server-only'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { recordAudit } from '@/modules/audit/service'
import { hashPassword } from './password'

export const registerSchema = z.object({
  email: z.string().email('Vul een geldig e-mailadres in').max(255),
  password: z.string().min(8, 'Je wachtwoord moet minstens 8 tekens hebben').max(200),
  name: z.string().trim().min(1, 'Vul je naam in').max(100),
})

export type RegisterResult = { ok: true; userId: string } | { ok: false; error: string }

export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ongeldige invoer' }
  }

  const email = parsed.data.email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    // Bewust dezelfde tekst als bij een geldige poging zou volgen? Nee — bij
    // registratie is verhullen zinloos: wie het adres intikt krijgt hoe dan ook
    // te horen dat hij niet verder kan. Duidelijkheid wint hier van
    // verhulling; de enumeration-bescherming zit bij het inloggen.
    return { ok: false, error: 'Er bestaat al een account met dit e-mailadres.' }
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true },
  })

  await recordAudit({
    userId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
  })

  return { ok: true, userId: user.id }
}
