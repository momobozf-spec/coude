'use server'

/**
 * Server actions voor de onboarding.
 *
 * Elke stap is een apart formulier dat hierheen post. De action leest de
 * FormData, zet hem om naar het type dat het stapschema verwacht, en laat de
 * service valideren — zodat er precies één plek is waar de regels staan.
 */
import { revalidatePath } from 'next/cache'
import { OnboardingGoal, PurchaseTimeline, PurchaseType } from '@prisma/client'

import { requireUserId } from '@/modules/auth/session'
import { isAppError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { MoneyError, parseAmountToCents } from '@/lib/money'
import { PRIORITY_KEYS, type PriorityKey } from './schema'
import * as service from './service'

export interface OnboardingActionResult {
  ok: boolean
  error?: string
  /** Naar welke stap de wizard moet na deze action. */
  nextStep?: number
  journeyId?: string
}

function toResult(error: unknown): OnboardingActionResult {
  if (error instanceof MoneyError) return { ok: false, error: error.message }
  if (isAppError(error)) return { ok: false, error: error.message }

  logger.error('Onverwachte fout in een onboarding-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.' }
}

const text = (form: FormData, key: string): string | undefined => {
  const value = form.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Zet de ruwe FormData om naar de vorm die het stapschema verwacht.
 *
 * Bedragen gaan hier door `parseAmountToCents`: de gebruiker typt "450.000" of
 * "450000", en vanaf dit punt is alles centen. Zie src/lib/money.ts.
 */
function parseStep(step: number, form: FormData): unknown {
  switch (step) {
    case 1:
      return { goal: text(form, 'goal') as OnboardingGoal | undefined }

    case 2:
      return {
        country: 'BE',
        region: text(form, 'region'),
        city: text(form, 'city'),
        postalCode: text(form, 'postalCode') ?? '',
        radiusKm: text(form, 'radiusKm'),
      }

    case 3: {
      const maxBudgetCents = parseAmountToCents(text(form, 'maxBudget') ?? null)
      const ownFundsCents = parseAmountToCents(text(form, 'ownFunds') ?? null)

      if (maxBudgetCents === null) throw new ValidationError('Vul je maximale budget in')
      if (ownFundsCents === null) throw new ValidationError('Vul je eigen middelen in')

      const financing = text(form, 'needsFinancing')

      return {
        maxBudgetCents,
        ownFundsCents,
        // 'unsure' → null. Onzeker is een geldig antwoord en iets anders dan nee.
        needsFinancing: financing === 'yes' ? true : financing === 'no' ? false : null,
        purchaseType: (text(form, 'purchaseType') as PurchaseType | undefined) ?? PurchaseType.EXISTING,
        firstHome: form.get('firstHome') !== 'false',
      }
    }

    case 4:
      return { timeline: text(form, 'timeline') as PurchaseTimeline | undefined }

    case 5: {
      const selected = form
        .getAll('priorities')
        .filter((v): v is string => typeof v === 'string')
        .filter((v): v is PriorityKey => (PRIORITY_KEYS as readonly string[]).includes(v))

      return { priorities: selected }
    }

    default:
      throw new ValidationError(`Onbekende onboardingstap: ${step}`)
  }
}

export async function saveOnboardingStepAction(
  step: number,
  formData: FormData,
): Promise<OnboardingActionResult> {
  try {
    const userId = await requireUserId()
    const state = await service.saveStep(userId, step, parseStep(step, formData))

    revalidatePath('/onboarding')
    return { ok: true, nextStep: Math.min(step + 1, state.totalSteps + 1) }
  } catch (error) {
    return toResult(error)
  }
}

/**
 * Rondt de onboarding af.
 *
 * Idempotent: twee keer aanroepen geeft twee keer hetzelfde `journeyId` en
 * maakt geen tweede traject. Zie `completeOnboarding` in de service.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  try {
    const userId = await requireUserId()
    const result = await service.completeOnboarding(userId)

    revalidatePath('/dashboard')
    revalidatePath('/journey', 'layout')

    return { ok: true, journeyId: result.journeyId }
  } catch (error) {
    return toResult(error)
  }
}
