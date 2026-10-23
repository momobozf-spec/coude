import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, noContent, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { deleteAsset, getAsset, updateAsset } from '@/server/modules/assets/service'
import { assetUpdateSchema } from '@/modules/zakat/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getAsset(actor, id))
})

export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('assets', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const input = assetUpdateSchema.parse(await request.json())
  return ok(await updateAsset(actor, id, input))
})

export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('assets', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  await deleteAsset(actor, id)
  return noContent()
})

export const dynamic = 'force-dynamic'
