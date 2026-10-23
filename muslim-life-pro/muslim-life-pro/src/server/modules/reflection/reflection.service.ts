import 'server-only'

import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { isoDateToUtcDate, type IsoDate } from '@/lib/dates'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { isoDateSchema } from '@/server/modules/planner/task.schema'

/**
 * Daily reflection.
 *
 * Private by construction: the text is never read by analytics, never sent to the
 * AI provider, and never leaves the user's own rows. Only the *count* of filled
 * fields is ever recorded as an event.
 */

export const reflectionSchema = z.object({
  localDate: isoDateSchema,
  gratitude: z.string().trim().max(2000).nullable().optional(),
  wentWell: z.string().trim().max(2000).nullable().optional(),
  improveTomorrow: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

export type ReflectionInput = z.infer<typeof reflectionSchema>

export interface ReflectionView {
  localDate: IsoDate
  gratitude: string | null
  wentWell: string | null
  improveTomorrow: string | null
  notes: string | null
  updatedAt: Date
}

export async function getReflection(
  actor: Actor,
  date: IsoDate,
): Promise<ReflectionView | null> {
  const reflection = await prisma.dailyReflection.findUnique({
    where: { userId_localDate: { userId: actor.userId, localDate: isoDateToUtcDate(date) } },
    select: {
      gratitude: true,
      wentWell: true,
      improveTomorrow: true,
      notes: true,
      updatedAt: true,
    },
  })

  if (!reflection) return null

  return { localDate: date, ...reflection }
}

function normalise(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Create or update the reflection for a local day.
 *
 * Upserted on `[userId, localDate]`, so there is exactly one per day and
 * re-submitting edits the existing entry rather than stacking duplicates.
 */
export async function saveReflection(
  actor: Actor,
  input: ReflectionInput,
): Promise<ReflectionView> {
  const data = reflectionSchema.parse(input)
  const day = isoDateToUtcDate(data.localDate)

  const fields = {
    gratitude: normalise(data.gratitude),
    wentWell: normalise(data.wentWell),
    improveTomorrow: normalise(data.improveTomorrow),
    notes: normalise(data.notes),
  }

  const filled = Object.values(fields).filter(Boolean).length

  // An entirely empty reflection is a deletion, not a blank row.
  if (filled === 0) {
    await prisma.dailyReflection.deleteMany({ where: { userId: actor.userId, localDate: day } })
    return { localDate: data.localDate, ...fields, updatedAt: new Date() }
  }

  const reflection = await prisma.dailyReflection.upsert({
    where: { userId_localDate: { userId: actor.userId, localDate: day } },
    create: { userId: actor.userId, localDate: day, ...fields },
    update: fields,
    select: {
      gratitude: true,
      wentWell: true,
      improveTomorrow: true,
      notes: true,
      updatedAt: true,
    },
  })

  // Only the count — never the content.
  await track(actor.userId, ANALYTICS_EVENTS.REFLECTION_COMPLETED, { fieldsFilled: filled })

  return { localDate: data.localDate, ...reflection }
}

export async function countReflectionsBetween(
  actor: Actor,
  from: IsoDate,
  to: IsoDate,
): Promise<number> {
  return prisma.dailyReflection.count({
    where: {
      userId: actor.userId,
      localDate: { gte: isoDateToUtcDate(from), lte: isoDateToUtcDate(to) },
    },
  })
}
