import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  cancelReminder,
  getReminder,
  setReminderStatus,
  updateReminder,
} from '@/server/modules/reminders/service'
import { reminderStatusSchema, reminderUpdateSchema } from '@/modules/reminders/schemas'

type Context = { params: Promise<{ id: string }> }

export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok(await getReminder(actor, id))
})

/**
 * A body carrying only `status` changes lifecycle state (pause, resume,
 * complete); anything else is a full update. Keeping both here avoids a second
 * endpoint for what is, to the user, the same object.
 */
export const PATCH = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('reminders', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  const body = await request.json()

  const statusOnly = reminderStatusSchema.safeParse(body)
  if (statusOnly.success && Object.keys(body as object).length === 1) {
    return ok(await setReminderStatus(actor, id, statusOnly.data.status))
  }

  const input = reminderUpdateSchema.parse(body)
  return ok(await updateReminder(actor, id, input))
})

/**
 * DELETE **cancels** rather than erasing. The notifications a reminder produced
 * point at it, and an account's scheduling history stays readable.
 */
export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('reminders', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  return ok(await cancelReminder(actor, id))
})

export const dynamic = 'force-dynamic'
