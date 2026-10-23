import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { assetUsage, createAsset, listAssets } from '@/server/modules/assets/service'
import { assetInputSchema } from '@/modules/zakat/schemas'

export const GET = handler(async () => {
  const actor = await requireActor()
  const [assets, usage] = await Promise.all([listAssets(actor), assetUsage(actor)])
  return ok({ assets, usage })
})

export const POST = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('assets', actor.userId, request), RATE_LIMITS.write)

  const input = assetInputSchema.parse(await request.json())
  return created(await createAsset(actor, input))
})

export const dynamic = 'force-dynamic'
