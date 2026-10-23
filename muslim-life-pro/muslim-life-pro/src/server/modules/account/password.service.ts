import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { appUrl } from '@/config/app-url'
import { siteConfig } from '@/config/site'
import { logger } from '@/lib/logger'
import { UnauthenticatedError, ValidationError } from '@/lib/errors'
import { enforce } from '@/server/services/rate-limit'
import { escapeHtml, sendEmail } from '@/server/integrations/email'
import { writeAudit } from '@/server/services/audit'
import type { Actor } from '@/server/auth/actor'

/**
 * Password reset and change.
 *
 * - Reset tokens are 32 random bytes; only their SHA-256 is stored.
 * - A token is single-use and lives for an hour.
 * - Requesting a reset never reveals whether the address has an account.
 * - Setting a new password stamps `passwordChangedAt`, which invalidates every
 *   session issued before it (see `getActor`).
 */

export const BCRYPT_COST = 12
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * bcrypt only reads the first 72 BYTES. A longer password would be silently
 * truncated, so it is refused rather than half-checked.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'That password is too long (max 72 bytes).')

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/** Always resolves the same way, whether or not the account exists. */
export async function requestPasswordReset(rawEmail: string, ip: string): Promise<void> {
  if (ip !== 'unknown') await enforce('auth.passwordReset', ip)

  const parsed = z.string().trim().toLowerCase().email().max(255).safeParse(rawEmail)
  if (!parsed.success) return
  const email = parsed.data
  await enforce('auth.passwordReset.account', email)

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true, deletionStatus: true, passwordHash: true },
  })
  // No account, a deleted one, or an OAuth-only one: silently do nothing.
  if (!user || user.deletedAt || user.deletionStatus === 'COMPLETED' || !user.passwordHash) return

  const token = randomBytes(32).toString('base64url')
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  })

  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const sent = await sendEmail({
    to: email,
    subject: `${siteConfig.name} — reset your password`,
    text: `Someone (hopefully you) asked to reset your ${siteConfig.name} password.\n\nOpen this link within one hour:\n${link}\n\nIf this wasn't you, ignore this e-mail; your password stays the same.`,
    html: `<p>Someone (hopefully you) asked to reset your ${escapeHtml(siteConfig.name)} password.</p><p><a href="${escapeHtml(link)}">Choose a new password</a> (valid for one hour).</p><p>If this wasn't you, ignore this e-mail; your password stays the same.</p>`,
  })
  logger.info('account.password_reset.requested', { userId: user.id, sent })
}

/** Consume a reset token and set the new password. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const password = passwordSchema.safeParse(newPassword)
  if (!password.success) {
    throw new ValidationError(password.error.issues[0]?.message ?? 'Invalid password.')
  }
  if (!token || token.length > 200) throw new ValidationError('This reset link is invalid or has expired.')

  const passwordHash = await hashPassword(password.data)
  const now = new Date()

  const userId = await prisma.$transaction(async (tx) => {
    // Claim the token atomically: a second use (or a race) matches zero rows.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (claimed.count !== 1) return null

    const row = await tx.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { userId: true },
    })
    if (!row) return null

    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, passwordChangedAt: now },
    })
    // Any other outstanding links for this account die with this one.
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    })
    return row.userId
  })

  if (!userId) throw new ValidationError('This reset link is invalid or has expired.')

  await writeAudit({ actorId: userId, action: 'PASSWORD_RESET', entityType: 'User', entityId: userId })
}

/** Change the password of a signed-in member, after re-checking the current one. */
export async function changePassword(
  actor: Actor,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await enforce('auth.login.account', actor.email)

  const password = passwordSchema.safeParse(newPassword)
  if (!password.success) {
    throw new ValidationError(password.error.issues[0]?.message ?? 'Invalid password.')
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new UnauthenticatedError('Your current password is not correct.')
  }

  await prisma.user.update({
    where: { id: actor.userId },
    data: { passwordHash: await hashPassword(password.data), passwordChangedAt: new Date() },
  })
  await writeAudit({ actorId: actor.userId, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: actor.userId })
}
