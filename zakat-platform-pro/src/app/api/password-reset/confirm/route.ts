import type { NextRequest } from 'next/server'

import { ValidationError } from '@/lib/errors'
import { handler, noContent } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { resetPassword } from '@/server/modules/account/service'
import { resetConfirmSchema } from '@/modules/auth/schemas'

export const POST = handler(async (request: NextRequest) => {
  enforce(rateLimitKey('password-reset', null, request), RATE_LIMITS.auth)

  const input = resetConfirmSchema.parse(await request.json())
  const outcome = await resetPassword(input.token, input.password)

  if (outcome === 'invalid') {
    throw new ValidationError('Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.')
  }
  if (typeof outcome === 'object') {
    throw new ValidationError(outcome.problem, { password: [outcome.problem] })
  }
  return noContent()
})

export const dynamic = 'force-dynamic'
