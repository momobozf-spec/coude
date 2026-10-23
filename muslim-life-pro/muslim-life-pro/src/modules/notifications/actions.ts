'use server'

import { z } from 'zod'

import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { requireActor } from '@/server/auth/actor'
import { markAllRead, markRead } from '@/server/modules/notifications/notification.service'

const schema = z.object({ id: z.string().uuid() })

/**
 * Mark one notification read.
 *
 * The service scopes the update by `userId`, so an id belonging to someone else
 * simply matches no rows. It deliberately does not 404 — telling a caller that
 * an id exists but is not theirs is more than they need to know.
 */
export async function markReadAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { id } = schema.parse(input)

    await markRead(actor, id)
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}

export async function markAllReadAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const actor = await requireActor()
    return actionOk({ count: await markAllRead(actor) })
  } catch (error) {
    return actionError(error)
  }
}
