import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { upsertSource } from '@/server/modules/charities/admin-service'
import { upsertSourceSchema } from '@/modules/charities/schemas'

type Context = { params: Promise<{ id: string }> }

/** Add an evidence source to a charity. */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('admin-charities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = upsertSourceSchema.parse(await request.json())
  return created(await upsertSource(actor, id, input))
})

const updateSchema = upsertSourceSchema.extend({ sourceId: z.string().uuid() })

/** Correct an existing source (e.g. a moved URL or a new retrieval date). */
export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireAdmin()
  enforce(rateLimitKey('admin-charities', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const { sourceId, ...input } = updateSchema.parse(await request.json())
  return ok(await upsertSource(actor, id, input, sourceId))
})

export const dynamic = 'force-dynamic'
