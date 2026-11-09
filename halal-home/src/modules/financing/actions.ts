'use server'

/**
 * Server actions voor financiering.
 * Keten: UI → action → service → repository/domain calculator.
 *
 * Geen enkele financiële of religieuze regel staat hier: de action valideert,
 * roept de service aan, en vertaalt fouten naar iets dat de UI kan tonen.
 */
import { revalidatePath } from 'next/cache'
import { AnalyticsEventType, FinancingQuoteStatus } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { MAX_AMOUNT_CENTS, MoneyError } from '@/lib/money'
import { recordEvent } from '@/modules/analytics/service'
import { findActiveJourney } from '@/modules/journey/repository'
import { FinancingInputError } from './domain/calculators/types'
import { syncFinancingTasks } from './journeyBridge'
import * as service from './service'
import * as repository from './repository'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  /** Stabiele foutcode, zodat de UI erop kan reageren zonder tekst te matchen. */
  code?: string
  data?: T
}

function toResult<T>(error: unknown): ActionResult<T> {
  // Invoerfouten uit de rekenmotor dragen al een code.
  if (error instanceof FinancingInputError) {
    return { ok: false, error: error.message, code: error.code }
  }
  if (error instanceof MoneyError) {
    return { ok: false, error: error.message, code: 'INVALID_AMOUNT' }
  }
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code }
  }

  logger.error('Onverwachte fout in een financing-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.', code: 'INTERNAL_ERROR' }
}

const amountCents = z.number().int().min(0).max(MAX_AMOUNT_CENTS)

const calculateSchema = z
  .object({
    productId: z.string().min(1),
    purchasePriceCents: amountCents.refine((v) => v > 0, 'Vul een aankoopprijs in'),
    ownContributionCents: amountCents,
    termMonths: z.number().int().min(1).max(480),
  })
  .refine((input) => input.ownContributionCents < input.purchasePriceCents, {
    path: ['ownContributionCents'],
    message: 'Je eigen middelen dekken de volledige aankoopprijs — er valt niets te financieren',
  })

export async function calculateFinancingAction(
  input: z.input<typeof calculateSchema>,
): Promise<ActionResult<service.CalculationView>> {
  try {
    const userId = await requireUserId()
    const parsed = calculateSchema.parse(input)

    const view = await service.calculateForProduct(parsed)

    await recordEvent({
      userId,
      type: AnalyticsEventType.FINANCING_CALCULATION_COMPLETED,
      entityKey: view.product.slug,
      properties: { source: view.product.financingType },
    })

    return { ok: true, data: view }
  } catch (error) {
    return toResult(error)
  }
}

const saveQuoteSchema = calculateSchema.safeExtend({
  propertyId: z.string().nullish(),
  status: z.enum(FinancingQuoteStatus).optional(),
  notes: z.string().max(2000).nullish(),
})

/**
 * Bewaart een berekening en werkt daarna de trajecttaken bij.
 *
 * De taaksynchronisatie mag het bewaren nooit terugdraaien: een quote die
 * opgeslagen is, blijft opgeslagen, ook als de taakupdate faalt.
 */
export async function saveQuoteAction(
  input: z.input<typeof saveQuoteSchema>,
): Promise<ActionResult<{ quoteId: string; completedTaskKeys: string[] }>> {
  try {
    const userId = await requireUserId()
    const parsed = saveQuoteSchema.parse(input)

    const journey = await findActiveJourney(userId)
    const quote = await service.saveQuote(userId, {
      ...parsed,
      journeyId: journey?.id ?? null,
    })

    let completedTaskKeys: string[] = []
    if (journey) {
      try {
        completedTaskKeys = (await syncFinancingTasks(userId, journey.id)).completedTaskKeys
      } catch (error) {
        logger.warn('Taaksynchronisatie na quote mislukt', {
          error: error instanceof Error ? error.message : 'onbekend',
        })
      }
    }

    revalidatePath('/financing')
    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return { ok: true, data: { quoteId: quote.id, completedTaskKeys } }
  } catch (error) {
    return toResult(error)
  }
}

const statusSchema = z.object({
  quoteId: z.string().min(1),
  status: z.enum(FinancingQuoteStatus),
})

export async function setQuoteStatusAction(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { quoteId, status } = statusSchema.parse(input)

    await service.setQuoteStatus(userId, quoteId, status)

    const journey = await findActiveJourney(userId)
    if (journey) {
      try {
        await syncFinancingTasks(userId, journey.id)
      } catch {
        // Zelfde afweging als hierboven: geen terugdraaiing.
      }
    }

    revalidatePath('/financing')
    revalidatePath('/dashboard')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

const deleteSchema = z.object({ quoteId: z.string().min(1) })

export async function deleteQuoteAction(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { quoteId } = deleteSchema.parse(input)

    await repository.deleteQuote(userId, quoteId)
    revalidatePath('/financing')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

/** Legt vast dat een productpagina geopend is. Privacyvriendelijk: geen bedragen. */
export async function trackProductOpenedAction(slug: string): Promise<void> {
  try {
    const userId = await requireUserId()
    await recordEvent({
      userId,
      type: AnalyticsEventType.FINANCING_PRODUCT_OPENED,
      entityKey: slug,
    })
  } catch {
    // Meten mag nooit een paginaweergave breken.
  }
}
