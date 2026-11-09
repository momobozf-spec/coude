'use server'

/**
 * Server actions voor zoeken en bewaren.
 * Keten: UI → action → service → repository.
 */
import { revalidatePath } from 'next/cache'
import { SavedPropertyStatus, SearchFrequency } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { findActiveJourney } from '@/modules/journey/repository'
import * as repository from './repository'
import * as service from './service'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

function toResult<T>(error: unknown): ActionResult<T> {
  if (isAppError(error)) return { ok: false, error: error.message }

  logger.error('Onverwachte fout in een search-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.' }
}

const createSchema = z.object({
  query: z.string().trim().min(3).max(1000),
  name: z.string().trim().max(100).optional(),
  frequency: z.enum(SearchFrequency).optional(),
})

/**
 * Maakt een zoekopdracht en draait hem meteen.
 *
 * Meteen uitvoeren is een bewuste keuze: een zoekopdracht die pas morgen
 * resultaten toont, voelt als een formulier dat niets deed.
 */
export async function createSearchAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ searchId: string; source: string; matches: number }>> {
  try {
    const userId = await requireUserId()
    const parsed = createSchema.parse(input)

    const journey = await findActiveJourney(userId)
    const created = await service.createSearchFromQuery(userId, {
      ...parsed,
      journeyId: journey?.id ?? null,
    })

    const run = await service.runSearch(userId, created.searchId)

    revalidatePath('/search')
    revalidatePath('/dashboard')

    return {
      ok: true,
      data: { searchId: created.searchId, source: created.source, matches: run.matches },
    }
  } catch (error) {
    return toResult(error)
  }
}

const idSchema = z.object({ searchId: z.string().min(1) })

export async function runSearchAction(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ matches: number; newMatches: number }>> {
  try {
    const userId = await requireUserId()
    const { searchId } = idSchema.parse(input)

    const run = await service.runSearch(userId, searchId)
    revalidatePath('/search')

    return { ok: true, data: { matches: run.matches, newMatches: run.newMatches } }
  } catch (error) {
    return toResult(error)
  }
}

const toggleSchema = z.object({
  searchId: z.string().min(1),
  active: z.boolean().optional(),
  alertsEnabled: z.boolean().optional(),
  frequency: z.enum(SearchFrequency).optional(),
})

export async function updateSearchAction(
  input: z.input<typeof toggleSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { searchId, ...data } = toggleSchema.parse(input)

    await repository.updateSearch(userId, searchId, data)
    revalidatePath('/search')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function deleteSearchAction(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { searchId } = idSchema.parse(input)

    await repository.deleteSearch(userId, searchId)
    revalidatePath('/search')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

const saveSchema = z.object({
  propertyId: z.string().min(1),
  status: z.enum(SavedPropertyStatus).optional(),
})

export async function savePropertyAction(
  input: z.input<typeof saveSchema>,
): Promise<ActionResult<{ saved: true }>> {
  try {
    const userId = await requireUserId()
    const { propertyId } = saveSchema.parse(input)

    const journey = await findActiveJourney(userId)
    await service.savePropertyForUser(userId, propertyId, { journeyId: journey?.id ?? null })

    revalidatePath('/saved')
    revalidatePath('/dashboard')

    return { ok: true, data: { saved: true } }
  } catch (error) {
    return toResult(error)
  }
}

export async function unsavePropertyAction(
  input: z.input<typeof saveSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { propertyId } = saveSchema.parse(input)

    await repository.unsaveProperty(userId, propertyId)
    revalidatePath('/saved')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

const statusSchema = z.object({
  propertyId: z.string().min(1),
  status: z.enum(SavedPropertyStatus),
})

export async function updateSavedStatusAction(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { propertyId, status } = statusSchema.parse(input)

    await repository.updateSavedProperty(userId, propertyId, { status })
    revalidatePath('/saved')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
