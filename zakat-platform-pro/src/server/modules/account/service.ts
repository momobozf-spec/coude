import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import type { UserRole } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import { appBaseUrl, serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { consume } from '@/server/http/rate-limit'
import { getEmailSender, type EmailSender } from '@/server/integrations/email'
import { recordAudit } from '@/server/services/audit'
import {
  LOCKOUT_DECAY_MS,
  isLocked,
  lockMinutesForCount,
  type LockoutPolicy,
} from '@/server/modules/account/lockout'

/**
 * Accountbeveiliging: inloggen met vergrendeling, wachtwoord wijzigen, overal
 * afmelden en wachtwoordherstel.
 *
 * Elke wijziging die een aanvaller buitensluit (wachtwoord gewijzigd, hersteld,
 * "overal afmelden") verhoogt `sessionVersion`; `getActor` vergelijkt die met de
 * waarde in de JWT, zodat een gestolen sessie meteen waardeloos wordt.
 */

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  onboarded: boolean
  sessionVersion: number
}

function lockoutPolicy(): LockoutPolicy {
  const env = serverEnv()
  return { maxAttempts: env.LOGIN_MAX_ATTEMPTS, lockMinutes: env.LOGIN_LOCK_MINUTES }
}

/**
 * Atomisch tellen: de database verhoogt (`increment`) en de teruggegeven waarde
 * beslist over het slot. Lezen, bcrypt afwachten en `teller + 1` terugschrijven
 * zou honderd gelijktijdige pogingen allemaal als poging één laten tellen.
 */
async function registerFailedLogin(userId: string, now: Date): Promise<Date | null> {
  await prisma.user.updateMany({
    where: { id: userId, lockedUntil: { lt: new Date(now.getTime() - LOCKOUT_DECAY_MS) } },
    data: { failedLoginCount: 0, lockedUntil: null },
  })

  const counted = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  })

  const minutes = lockMinutesForCount(counted.failedLoginCount, lockoutPolicy())
  if (minutes === null) return null

  const lockedUntil = new Date(now.getTime() + minutes * 60_000)
  await prisma.user.update({ where: { id: userId }, data: { lockedUntil } })
  return lockedUntil
}

/**
 * Geslaagde login vastleggen, maar alleen als het account op dit moment niet op
 * slot staat — een poging die vóór de vergrendeling begon en erna klaar was met
 * bcrypt, komt er zo niet alsnog door.
 */
async function recordSuccessfulLogin(userId: string, now: Date): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id: userId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { failedLoginCount: 0, lockedUntil: null },
  })
  return result.count === 1
}

/**
 * Controleer e-mail en wachtwoord. Geeft null bij elke weigering — de aanroeper
 * toont altijd dezelfde melding, zodat het formulier niet verraadt of een adres
 * bestaat of op slot staat.
 */
export async function authenticate(
  credentials: { email: string; password: string },
  ip: string,
  now = new Date(),
): Promise<AuthenticatedUser | null> {
  const env = serverEnv()

  const perIp = consume(`login:ip:${ip}`, {
    limit: env.LOGIN_MAX_ATTEMPTS_PER_IP,
    windowSeconds: 15 * 60,
  })
  if (!perIp.allowed) {
    logger.warn('auth.login.ip_limited', { ip })
    return null
  }

  const email = credentials.email.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      passwordHash: true,
      onboardedAt: true,
      deletedAt: true,
      lockedUntil: true,
      sessionVersion: true,
    },
  })

  // Altijd vergelijken, ook zonder gebruiker: anders verraadt de responstijd
  // of het account bestaat.
  const valid = await verifyPassword(credentials.password, user?.passwordHash)

  if (!user || !user.passwordHash || user.deletedAt) {
    logger.warn('auth.login.rejected', { reason: 'unknown_or_deleted' })
    return null
  }

  if (isLocked(user.lockedUntil, now)) {
    logger.warn('auth.login.rejected', { userId: user.id, reason: 'locked' })
    return null
  }

  if (!valid) {
    const lockedUntil = await registerFailedLogin(user.id, now)
    if (lockedUntil) {
      await recordAudit({
        userId: user.id,
        action: 'ACCOUNT_LOCKED',
        entityType: 'User',
        entityId: user.id,
        metadata: { until: lockedUntil.toISOString() },
      })
    }
    logger.warn('auth.login.rejected', { userId: user.id, reason: 'password' })
    return null
  }

  if (!(await recordSuccessfulLogin(user.id, now))) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    onboarded: Boolean(user.onboardedAt),
    sessionVersion: user.sessionVersion,
  }
}

// ── Eigen account ────────────────────────────────────────────────────────────

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 200

/** Zelfde regels als bij registratie, plus: niet het e-mailadres zelf. */
export function passwordProblem(password: string, email: string): string | null {
  const length = [...password].length
  if (length < PASSWORD_MIN) return `Gebruik minstens ${PASSWORD_MIN} tekens.`
  if (length > PASSWORD_MAX) return 'Dat wachtwoord is te lang.'
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return 'Gebruik geen wachtwoord dat je e-mailadres bevat.'
  }
  return null
}

export async function changePassword(
  actor: Actor,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const limited = consume(`password-change:${actor.userId}`, { limit: 5, windowSeconds: 15 * 60 })
  if (!limited.allowed) {
    throw new ValidationError('Te veel pogingen. Probeer het over een kwartier opnieuw.')
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { passwordHash: true, email: true },
  })
  if (!user?.passwordHash) {
    throw new ValidationError('Dit account logt in via Google en heeft geen wachtwoord.')
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ValidationError('Je huidige wachtwoord klopt niet.', {
      currentPassword: ['Je huidige wachtwoord klopt niet.'],
    })
  }

  const problem = passwordProblem(newPassword, user.email)
  if (problem) throw new ValidationError(problem, { newPassword: [problem] })

  await prisma.user.update({
    where: { id: actor.userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: actor.userId,
  })
}

/** Maakt elke lopende sessie ongeldig, ook deze. */
export async function revokeAllSessions(actor: Actor): Promise<void> {
  await prisma.user.update({
    where: { id: actor.userId },
    data: { sessionVersion: { increment: 1 } },
  })
  await recordAudit({
    userId: actor.userId,
    action: 'SESSIONS_REVOKED',
    entityType: 'User',
    entityId: actor.userId,
  })
}

// ── Wachtwoordherstel ────────────────────────────────────────────────────────

const RESET_TTL_MS = 60 * 60_000
const RESET_PREFIX = 'password-reset:'

/** Alleen de hash staat in de database; wie de tabel leest, kan er niets mee. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Vraag een herstellink aan. Antwoordt voor elk adres hetzelfde (de aanroeper
 * toont altijd "als het adres bestaat, is er een mail onderweg"), zodat dit geen
 * manier wordt om te testen welke adressen een account hebben.
 */
export async function requestPasswordReset(
  rawEmail: string,
  ip: string,
  options: { sender?: EmailSender } = {},
): Promise<void> {
  const email = rawEmail.toLowerCase().trim()

  const perIp = consume(`reset:ip:${ip}`, { limit: 10, windowSeconds: 60 * 60 })
  const perEmail = consume(`reset:email:${email}`, { limit: 3, windowSeconds: 60 * 60 })
  if (!perIp.allowed || !perEmail.allowed) {
    logger.warn('auth.reset.limited', { ip })
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, deletedAt: true },
  })
  if (!user || user.deletedAt) return

  const token = randomBytes(32).toString('base64url')
  const identifier = `${RESET_PREFIX}${user.id}`

  await prisma.$transaction([
    // Eén geldige link tegelijk: een nieuwe aanvraag maakt de vorige ongeldig.
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashResetToken(token),
        expires: new Date(Date.now() + RESET_TTL_MS),
      },
    }),
  ])

  const link = `${appBaseUrl()}/wachtwoord-herstellen/${token}`
  const result = await (options.sender ?? getEmailSender()).send({
    to: user.email,
    subject: 'Je wachtwoord herstellen — Barakah',
    text: [
      'Iemand (hopelijk jij) vroeg om je wachtwoord bij Barakah te herstellen.',
      '',
      `Kies een nieuw wachtwoord via deze link (één uur geldig, één keer bruikbaar):`,
      link,
      '',
      'Heb je dit niet aangevraagd? Dan hoef je niets te doen; je wachtwoord blijft ongewijzigd.',
    ].join('\n'),
  })

  if (!result.delivered) {
    logger.error('auth.reset.email_failed', { userId: user.id, error: result.error })
  }

  await recordAudit({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    metadata: { delivered: result.delivered },
  })
}

export type ResetOutcome = 'ok' | 'invalid' | { problem: string }

/** Is deze link (nog) bruikbaar? Voor de pagina, vóór het formulier getoond wordt. */
export async function isResetTokenValid(token: string, now = new Date()): Promise<boolean> {
  const row = await prisma.verificationToken.findUnique({
    where: { token: hashResetToken(token) },
    select: { identifier: true, expires: true },
  })
  return Boolean(row && row.identifier.startsWith(RESET_PREFIX) && row.expires > now)
}

export async function resetPassword(
  token: string,
  newPassword: string,
  now = new Date(),
): Promise<ResetOutcome> {
  const hashed = hashResetToken(token)
  const row = await prisma.verificationToken.findUnique({
    where: { token: hashed },
    select: { identifier: true, expires: true },
  })
  if (!row || !row.identifier.startsWith(RESET_PREFIX) || row.expires <= now) return 'invalid'

  const userId = row.identifier.slice(RESET_PREFIX.length)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, deletedAt: true },
  })
  if (!user || user.deletedAt) return 'invalid'

  const problem = passwordProblem(newPassword, user.email)
  if (problem) return { problem }

  const passwordHash = await hashPassword(newPassword)

  // Eenmalig: de link verbruiken en het wachtwoord zetten in één transactie.
  // `deleteMany` op de hash telt: wie tegelijk dezelfde link gebruikt, krijgt 0.
  const used = await prisma.$transaction(async (tx) => {
    const consumed = await tx.verificationToken.deleteMany({ where: { token: hashed } })
    if (consumed.count !== 1) return false

    await tx.verificationToken.deleteMany({ where: { identifier: row.identifier } })
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    })
    return true
  })
  if (!used) return 'invalid'

  await recordAudit({
    userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: userId,
  })
  return 'ok'
}

/** Voor het beheerscript `npm run unlock:user`. */
export async function unlockByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  })
  if (!user) return null
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  })
  return user.id
}

/** Voor de profielpagina: welke beveiligingsopties gelden voor dit account. */
export async function accountSecurityInfo(
  actor: Actor,
): Promise<{ hasPassword: boolean; passwordChangedAt: Date | null; emailReminders: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      passwordHash: true,
      passwordChangedAt: true,
      notificationPreference: { select: { emailEnabled: true } },
    },
  })
  return {
    hasPassword: Boolean(user?.passwordHash),
    passwordChangedAt: user?.passwordChangedAt ?? null,
    emailReminders: user?.notificationPreference?.emailEnabled ?? true,
  }
}

/** Herinneringen ook per e-mail ontvangen (aan/uit). */
export async function setEmailReminders(actor: Actor, enabled: boolean): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId: actor.userId },
    create: { userId: actor.userId, emailEnabled: enabled },
    update: { emailEnabled: enabled },
  })
}
