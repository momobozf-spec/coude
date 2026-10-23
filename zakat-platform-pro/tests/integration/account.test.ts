import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestUser, hasDatabase, prisma, resetDatabase } from './setup'
import { hashPassword } from '@/server/auth/password'
import { resetRateLimits } from '@/server/http/rate-limit'
import {
  authenticate,
  changePassword,
  hashResetToken,
  isResetTokenValid,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
} from '@/server/modules/account/service'
import { deleteAccount, exportPersonalData } from '@/server/modules/account/privacy'
import type { EmailMessage, EmailSender } from '@/server/integrations/email'
import type { Actor } from '@/server/auth/actor'

// bcrypt (kost 12) maakt elke poging ~250 ms; deze tests doen er tientallen.
const suite = (name: string, fn: () => void) =>
  (hasDatabase ? describe : describe.skip)(name, { timeout: 60_000 }, fn)

const PASSWORD = 'een lange zin als wachtwoord'

async function userWithPassword(email = 'sara@test.local'): Promise<Actor> {
  const actor = await createTestUser({ email })
  await prisma.user.update({
    where: { id: actor.userId },
    data: { passwordHash: await hashPassword(PASSWORD) },
  })
  return actor
}

class CapturingSender implements EmailSender {
  readonly name = 'none' as const
  readonly sent: EmailMessage[] = []
  async send(message: EmailMessage) {
    this.sent.push(message)
    return { delivered: true, providerId: 'test' }
  }
  token(): string {
    const match = /wachtwoord-herstellen\/([A-Za-z0-9_-]+)/.exec(this.sent.at(-1)?.text ?? '')
    if (!match?.[1]) throw new Error('geen link in de mail')
    return match[1]
  }
}

suite('inloggen en vergrendeling', () => {
  beforeEach(async () => {
    await resetDatabase()
    resetRateLimits()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('laat het juiste wachtwoord toe en geeft de sessieversie mee', async () => {
    const actor = await userWithPassword()
    const user = await authenticate({ email: 'SARA@test.local ', password: PASSWORD }, '1.1.1.1')
    expect(user?.id).toBe(actor.userId)
    expect(user?.sessionVersion).toBe(0)
  })

  it('vergrendelt na vijf foute pogingen, ook voor het juiste wachtwoord', async () => {
    const actor = await userWithPassword()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await authenticate({ email: actor.email, password: 'fout' }, '1.1.1.1')).toBeNull()
    }

    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.failedLoginCount).toBe(5)
    expect(row.lockedUntil).not.toBeNull()

    expect(await authenticate({ email: actor.email, password: PASSWORD }, '1.1.1.1')).toBeNull()

    const audit = await prisma.auditLog.count({
      where: { userId: actor.userId, action: 'ACCOUNT_LOCKED' },
    })
    expect(audit).toBe(1)
  })

  it('telt gelijktijdige foute pogingen allemaal mee', async () => {
    const actor = await userWithPassword()
    await Promise.all(
      Array.from({ length: 8 }, () =>
        authenticate({ email: actor.email, password: 'fout' }, '2.2.2.2'),
      ),
    )
    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.failedLoginCount).toBe(8)
    expect(row.lockedUntil).not.toBeNull()
  })

  it('laat na afloop van het slot weer toe en zet de teller terug', async () => {
    const actor = await userWithPassword()
    await prisma.user.update({
      where: { id: actor.userId },
      data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() - 1000) },
    })
    expect(await authenticate({ email: actor.email, password: PASSWORD }, '1.1.1.1')).not.toBeNull()
    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.failedLoginCount).toBe(0)
    expect(row.lockedUntil).toBeNull()
  })

  it('weigert een verwijderd account', async () => {
    const actor = await userWithPassword()
    await prisma.user.update({ where: { id: actor.userId }, data: { deletedAt: new Date() } })
    expect(await authenticate({ email: actor.email, password: PASSWORD }, '1.1.1.1')).toBeNull()
  })

  it('begrenst het aantal pogingen per IP-adres', async () => {
    await userWithPassword()
    // Standaard 30 per kwartier; daarna weigert het ook voor bestaande accounts.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await authenticate({ email: `onbekend${attempt}@test.local`, password: 'x' }, '3.3.3.3')
    }
    expect(await authenticate({ email: 'sara@test.local', password: PASSWORD }, '3.3.3.3')).toBeNull()
    expect(await authenticate({ email: 'sara@test.local', password: PASSWORD }, '4.4.4.4')).not.toBeNull()
  })
})

suite('wachtwoord en sessies', () => {
  beforeEach(async () => {
    await resetDatabase()
    resetRateLimits()
  })

  it('wijzigt het wachtwoord alleen met het juiste huidige wachtwoord', async () => {
    const actor = await userWithPassword()
    await expect(changePassword(actor, 'fout', 'een nieuw lang wachtwoord')).rejects.toThrow(
      /huidige wachtwoord/,
    )

    await changePassword(actor, PASSWORD, 'een nieuw lang wachtwoord')

    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.sessionVersion).toBe(1)
    expect(row.passwordChangedAt).not.toBeNull()
    expect(await authenticate({ email: actor.email, password: 'een nieuw lang wachtwoord' }, '1.1.1.1')).not.toBeNull()
    expect(await authenticate({ email: actor.email, password: PASSWORD }, '1.1.1.1')).toBeNull()
  })

  it('weigert een nieuw wachtwoord dat het e-mailadres bevat', async () => {
    const actor = await userWithPassword('mohamed@test.local')
    await expect(changePassword(actor, PASSWORD, 'mohamed-2026-veilig')).rejects.toThrow(/e-mailadres/)
  })

  it('overal afmelden verhoogt de sessieversie', async () => {
    const actor = await userWithPassword()
    await revokeAllSessions(actor)
    await revokeAllSessions(actor)
    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.sessionVersion).toBe(2)
  })
})

suite('wachtwoordherstel', () => {
  beforeEach(async () => {
    await resetDatabase()
    resetRateLimits()
  })

  it('werkt één keer, bewaart alleen de hash en trekt sessies in', async () => {
    const actor = await userWithPassword()
    await prisma.user.update({
      where: { id: actor.userId },
      data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 60_000) },
    })

    const sender = new CapturingSender()
    await requestPasswordReset(actor.email, '1.1.1.1', { sender })
    const token = sender.token()

    // In de database staat de hash, nooit de token zelf.
    expect(await prisma.verificationToken.count({ where: { token } })).toBe(0)
    expect(await prisma.verificationToken.count({ where: { token: hashResetToken(token) } })).toBe(1)
    expect(await isResetTokenValid(token)).toBe(true)

    expect(await resetPassword(token, 'een gloednieuw wachtwoord')).toBe('ok')
    expect(await resetPassword(token, 'nog een ander wachtwoord')).toBe('invalid')

    const row = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })
    expect(row.sessionVersion).toBe(1)
    expect(row.lockedUntil).toBeNull()
    expect(await authenticate({ email: actor.email, password: 'een gloednieuw wachtwoord' }, '1.1.1.1')).not.toBeNull()
  })

  it('een nieuwe aanvraag maakt de vorige link ongeldig', async () => {
    const actor = await userWithPassword()
    const sender = new CapturingSender()
    await requestPasswordReset(actor.email, '1.1.1.1', { sender })
    const first = sender.token()
    await requestPasswordReset(actor.email, '1.1.1.1', { sender })
    expect(await resetPassword(first, 'een gloednieuw wachtwoord')).toBe('invalid')
    expect(await resetPassword(sender.token(), 'een gloednieuw wachtwoord')).toBe('ok')
  })

  it('weigert een verlopen link', async () => {
    const actor = await userWithPassword()
    const sender = new CapturingSender()
    await requestPasswordReset(actor.email, '1.1.1.1', { sender })
    const later = new Date(Date.now() + 61 * 60_000)
    expect(await resetPassword(sender.token(), 'een gloednieuw wachtwoord', later)).toBe('invalid')
  })

  it('verstuurt niets voor een onbekend adres, zonder dat te verraden', async () => {
    const sender = new CapturingSender()
    await expect(requestPasswordReset('niemand@test.local', '1.1.1.1', { sender })).resolves.toBeUndefined()
    expect(sender.sent).toHaveLength(0)
  })

  it('begrenst het aantal mails per adres', async () => {
    const actor = await userWithPassword()
    const sender = new CapturingSender()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestPasswordReset(actor.email, `5.5.5.${attempt}`, { sender })
    }
    expect(sender.sent).toHaveLength(3)
  })
})

suite('AVG: export en verwijderen', () => {
  beforeEach(async () => {
    await resetDatabase()
    resetRateLimits()
  })

  it('exporteert de eigen gegevens zonder geheimen', async () => {
    const actor = await userWithPassword()
    const exported = await exportPersonalData(actor)
    const text = JSON.stringify(exported)

    expect(text).toContain(actor.email)
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('$2')
    expect(
      await prisma.auditLog.count({ where: { userId: actor.userId, action: 'DATA_EXPORTED' } }),
    ).toBe(1)
  })

  it('verwijdert pas na bevestiging met e-mail en wachtwoord', async () => {
    const actor = await userWithPassword()
    await expect(deleteAccount(actor, { email: 'ander@test.local', password: PASSWORD })).rejects.toThrow()
    await expect(deleteAccount(actor, { email: actor.email, password: 'fout' })).rejects.toThrow()
    expect(await prisma.user.count({ where: { id: actor.userId } })).toBe(1)

    await deleteAccount(actor, { email: actor.email.toUpperCase(), password: PASSWORD })

    expect(await prisma.user.count({ where: { id: actor.userId } })).toBe(0)
    expect(await prisma.zakatProfile.count({ where: { userId: actor.userId } })).toBe(0)
    const audit = await prisma.auditLog.findFirst({ where: { action: 'USER_DELETED', entityId: actor.userId } })
    expect(audit?.userId).toBeNull()
  })

  it('weigert te verwijderen zolang je een huishouden met andere leden beheert', async () => {
    const owner = await userWithPassword('eigenaar@test.local')
    const member = await createTestUser({ email: 'lid@test.local' })
    await prisma.household.create({
      data: {
        name: 'Gezin',
        ownerUserId: owner.userId,
        members: { create: [{ userId: owner.userId, role: 'OWNER' }, { userId: member.userId }] },
      },
    })

    await expect(deleteAccount(owner, { email: owner.email, password: PASSWORD })).rejects.toThrow(/huishouden/)
    expect(await prisma.user.count({ where: { id: owner.userId } })).toBe(1)
  })
})
