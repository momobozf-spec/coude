import type { NextRequest } from 'next/server'

import { prisma } from '@/server/db/prisma'
import { provisionUser } from '@/server/auth/config'
import { hashPassword } from '@/server/auth/password'
import { created, handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { registerSchema } from '@/modules/auth/schemas'
import { ConflictError } from '@/lib/errors'
import { recordAudit } from '@/server/services/audit'
import { logger } from '@/lib/logger'

export const POST = handler(async (request: NextRequest) => {
  enforce(rateLimitKey('register', null, request), RATE_LIMITS.auth)

  const input = registerSchema.parse(await request.json())

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })

  if (existing) {
    // The email is already visible to whoever owns it, so this is not an
    // enumeration leak we can avoid without breaking the signup flow.
    throw new ConflictError('Er bestaat al een account met dit e-mailadres.')
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true, name: true },
  })

  // The adapter's createUser event does not fire for credentials signup, so the
  // same provisioning runs explicitly here.
  await provisionUser(user.id)

  await recordAudit({
    userId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
  })

  logger.info('auth.register.success', { userId: user.id })

  return created({ id: user.id })
})
