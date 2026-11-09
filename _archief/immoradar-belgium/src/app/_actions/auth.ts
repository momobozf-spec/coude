'use server'

import { redirect } from 'next/navigation'

import { loginSchema } from '@/domain/schemas'
import { clearSessionCookie, getSession, issueSessionToken, setSessionCookie } from '@/lib/session'
import { createLogger } from '@/lib/logger'
import { verifyPassword } from '@/lib/password'
import * as agencyRepository from '@/repositories/agencyRepository'
import { recordAudit } from '@/services/auditService'

const logger = createLogger({ component: 'auth' })

export interface LoginState {
  error: string | null
}

/**
 * Inloggen.
 *
 * ─── WAAROM ÉÉN FOUTMELDING VOOR ALLES ───────────────────────────────────────
 *
 * Onbekend e-mailadres, verkeerd wachtwoord en gedeactiveerd account geven
 * hetzelfde antwoord. Zou "dit account bestaat niet" apart bestaan, dan is dit
 * formulier een gratis controle op wie er klant is bij welk kantoor — en in een
 * markt waarin kantoren elkaars klanten willen kennen, is dat geen theoretisch
 * lek.
 *
 * Om dezelfde reden wordt het wachtwoord óók geverifieerd wanneer de gebruiker
 * niet bestaat: anders verraadt de reactietijd het verschil.
 */
export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Vul een geldig e-mailadres en wachtwoord in.' }
  }

  const user = await agencyRepository.findUserByEmail(parsed.data.email)

  // Een hash die gegarandeerd niet klopt, zodat de vergelijking evenveel tijd
  // kost als bij een bestaande gebruiker.
  const hash =
    user?.passwordHash ??
    'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

  const valid = await verifyPassword(parsed.data.password, hash)

  if (!user || !valid || !user.active) {
    logger.warn('Mislukte inlogpoging', { email: parsed.data.email })
    return { error: 'Onjuiste combinatie van e-mailadres en wachtwoord.' }
  }

  // Een gebruiker met een rol die een kantoor vereist maar er geen heeft, is een
  // configuratiefout. Hem toelaten zou betekenen dat elke tenantquery op `null`
  // draait, en dat is precies het scenario waarin data van kantoren door elkaar
  // gaat lopen.
  if (user.role !== 'PLATFORM_ADMIN' && !user.agencyId) {
    logger.error('Gebruiker zonder kantoor', { userId: user.id, role: user.role })
    return { error: 'Dit account is niet aan een kantoor gekoppeld. Neem contact op met beheer.' }
  }

  await agencyRepository.recordLogin(user.id)

  const token = issueSessionToken({
    userId: user.id,
    agencyId: user.agencyId,
    role: user.role,
  })

  await setSessionCookie(token)

  await recordAudit({
    actor: user.email,
    agencyId: user.agencyId,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
  })

  redirect(user.role === 'PLATFORM_ADMIN' ? '/admin/sources' : '/')
}

export async function logout(): Promise<void> {
  const session = await getSession()

  if (session) {
    await recordAudit({
      actor: session.userId,
      agencyId: session.agencyId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: session.userId,
    })
  }

  await clearSessionCookie()
  redirect('/login')
}
