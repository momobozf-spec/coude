import { NextResponse } from 'next/server'
import { z } from 'zod'

import { toErrorResponse, ValidationError } from '@/lib/errors'
import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import { clearActivity } from '@/server/modules/privacy/deletion.service'
import { enforce } from '@/server/services/rate-limit'

/** Clear tracked activity while keeping the account. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({ confirmation: z.string() })

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    await enforce('privacy.deleteActivity', actor.userId)

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || parsed.data.confirmation.trim().toUpperCase() !== 'CLEAR') {
      // Typed confirmation, not a checkbox: this is irreversible and a mis-click
      // should not be enough.
      throw new ValidationError('Type CLEAR to confirm.')
    }

    const result = await clearActivity(actor)

    // Counts only — enough for the UI to say what happened, with no content.
    return NextResponse.json({ deleted: result.deleted, total: result.total })
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}
