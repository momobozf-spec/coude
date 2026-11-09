'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { logPrayer } from '@/server/modules/prayer/prayer.service'
import { recomputeDailySummary } from '@/server/modules/my-day/my-day.service'
import { isoDateSchema } from '@/server/modules/planner/task.schema'

const logPrayerSchema = z.object({
  date: isoDateSchema,
  prayer: z.enum(['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']),
  /** `null` clears the entry. Never writes MISSED implicitly. */
  status: z.enum(['ON_TIME', 'LATE', 'JAMAAH', 'MISSED', 'EXCUSED']).nullable(),
})

export async function logPrayerAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const data = logPrayerSchema.parse(input)

    await logPrayer(actor, data.date, data.prayer, data.status)
    await recomputeDailySummary(actor, data.date)

    revalidatePath('/app')
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
