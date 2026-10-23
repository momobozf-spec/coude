import { NextResponse } from 'next/server'
import { z } from 'zod'

import { toErrorResponse } from '@/lib/errors'
import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import {
  cancelAccountDeletion,
  getDeletionState,
  requestAccountDeletion,
} from '@/server/modules/privacy/deletion.service'
import { enforce } from '@/server/services/rate-limit'

/**
 * Account deletion.
 *
 * POST requests it, DELETE withdraws the request. Nothing here removes data
 * synchronously — the irreversible step runs after the grace window, from the
 * scheduled job, so a member who changes their mind still can.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({ confirmation: z.string() })

export async function GET() {
  try {
    const actor = await requireActor()
    return NextResponse.json(await getDeletionState(actor))
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    await enforce('privacy.deleteAccount', actor.userId)

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    const state = await requestAccountDeletion(actor, parsed.success ? parsed.data.confirmation : '')

    return NextResponse.json(state)
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    await enforce('privacy.deleteAccount', actor.userId)

    return NextResponse.json(await cancelAccountDeletion(actor))
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}
