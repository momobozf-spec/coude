import 'server-only'

import type { ZakatProfile } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { assertFeature } from '@/server/services/entitlements'
import { safeTimezone, toHijri } from '@/lib/dates'
import { ZakatProfileNotFoundError, InvalidNisabConfigurationError } from '@/server/modules/zakat/errors'
import {
  ONBOARDING_STEPS,
  type OnboardingStepPayload,
  type ZakatProfilePayload,
} from '@/modules/zakat/schemas'

/**
 * Zakat profile and onboarding (§1, §2).
 *
 * The profile is created with the user (phase 1 provisioning), so this service
 * only ever reads and updates. Onboarding writes the same columns one step at a
 * time and records how far it got, which is what makes it resumable — there is
 * no separate wizard-state blob to fall out of sync with the profile.
 */

export interface ZakatProfileView {
  methodology: ZakatProfile['methodology']
  nisabBasis: ZakatProfile['nisabBasis']
  customNisabValue: string | null
  customNisabCurrency: string | null
  defaultCurrency: string
  haulStartDate: Date | null
  zakatDueDate: Date | null
  zakatDueHijri: string | null
  preferredCalendar: ZakatProfile['preferredCalendar']
  deductShortTermDebts: boolean
  businessAssetsEnabled: boolean
  advancedMode: boolean
  relevantAssetTypes: ZakatProfile['relevantAssetTypes']
  onboardingStep: number
  onboardingComplete: boolean
  timezone: string
}

function toView(row: ZakatProfile, timezone: string): ZakatProfileView {
  return {
    methodology: row.methodology,
    nisabBasis: row.nisabBasis,
    customNisabValue: row.customNisabValue?.toString() ?? null,
    customNisabCurrency: row.customNisabCurrency,
    defaultCurrency: row.defaultCurrency,
    haulStartDate: row.haulStartDate,
    zakatDueDate: row.zakatDueDate,
    zakatDueHijri: row.zakatDueDate ? toHijri(row.zakatDueDate).formatted : null,
    preferredCalendar: row.preferredCalendar,
    deductShortTermDebts: row.deductShortTermDebts,
    businessAssetsEnabled: row.businessAssetsEnabled,
    advancedMode: row.advancedMode,
    relevantAssetTypes: row.relevantAssetTypes,
    onboardingStep: row.onboardingStep,
    onboardingComplete: row.onboardingStep >= ONBOARDING_STEPS,
    timezone,
  }
}

export async function getZakatProfile(actor: Actor): Promise<ZakatProfileView> {
  const row = await prisma.zakatProfile.findUnique({ where: { userId: actor.userId } })
  if (!row) throw new ZakatProfileNotFoundError()
  return toView(row, actor.timezone)
}

/** The raw row, for the calculation service. */
export async function requireZakatProfile(actor: Actor): Promise<ZakatProfile> {
  const row = await prisma.zakatProfile.findUnique({ where: { userId: actor.userId } })
  if (!row) throw new ZakatProfileNotFoundError()
  return row
}

export async function updateZakatProfile(
  actor: Actor,
  input: ZakatProfilePayload,
): Promise<ZakatProfileView> {
  const existing = await requireZakatProfile(actor)

  const nisabBasis = input.nisabBasis ?? existing.nisabBasis
  const customNisabValue =
    input.customNisabValue !== undefined
      ? input.customNisabValue
      : (existing.customNisabValue?.toString() ?? null)

  // A CUSTOM basis without a value cannot produce a nisab, so it is rejected
  // here rather than failing later inside the engine.
  if (nisabBasis === 'CUSTOM' && !customNisabValue) {
    throw new InvalidNisabConfigurationError(
      'Kies een bedrag voor je handmatige nisab, of gebruik goud of zilver.',
    )
  }

  const defaultCurrency = input.defaultCurrency ?? existing.defaultCurrency

  // Advanced categories and extra currencies are the paid part of the profile;
  // the gate lives in the entitlement service, not in a plan comparison here.
  if (input.advancedMode) assertFeature(actor, 'ADVANCED_ASSETS')
  if (input.businessAssetsEnabled) assertFeature(actor, 'BUSINESS_ASSETS')
  if (defaultCurrency !== existing.defaultCurrency && defaultCurrency !== 'EUR') {
    assertFeature(actor, 'MULTI_CURRENCY')
  }

  const [row] = await prisma.$transaction([
    prisma.zakatProfile.update({
      where: { userId: actor.userId },
      data: {
        methodology: input.methodology,
        nisabBasis,
        customNisabValue,
        customNisabCurrency:
          nisabBasis === 'CUSTOM'
            ? (input.customNisabCurrency ?? defaultCurrency)
            : null,
        defaultCurrency,
        haulStartDate: input.haulStartDate,
        zakatDueDate: input.zakatDueDate,
        hijriDueDay: input.zakatDueDate ? toHijri(input.zakatDueDate).day : undefined,
        hijriDueMonth: input.zakatDueDate ? toHijri(input.zakatDueDate).month : undefined,
        preferredCalendar: input.preferredCalendar,
        deductShortTermDebts: input.deductShortTermDebts,
        businessAssetsEnabled: input.businessAssetsEnabled,
        advancedMode: input.advancedMode,
        relevantAssetTypes: input.relevantAssetTypes,
      },
    }),
    ...(input.timezone
      ? [
          prisma.user.update({
            where: { id: actor.userId },
            data: { timezone: safeTimezone(input.timezone) },
          }),
        ]
      : []),
  ])

  await recordAudit({
    userId: actor.userId,
    action: 'ZAKAT_PROFILE_UPDATED',
    entityType: 'ZakatProfile',
    entityId: row.id,
    // Categorical settings only; the custom nisab amount is a financial value
    // and stays out of the audit trail (§28).
    metadata: { nisabBasis: row.nisabBasis, methodology: row.methodology },
  })

  return toView(row, input.timezone ? safeTimezone(input.timezone) : actor.timezone)
}

// ── Onboarding ───────────────────────────────────────────────────────────────

/**
 * Save one onboarding step.
 *
 * `onboardingStep` only ever moves forward, so navigating back to review an
 * earlier answer cannot make a finished onboarding look unfinished again.
 */
export async function saveOnboardingStep(
  actor: Actor,
  input: OnboardingStepPayload,
): Promise<ZakatProfileView> {
  const existing = await requireZakatProfile(actor)

  if (existing.onboardingStep === 0) {
    trackEvent('ZAKAT_ONBOARDING_STARTED', actor.userId)
  }

  if (input.nisabBasis === 'CUSTOM' && !input.customNisabValue && !existing.customNisabValue) {
    throw new InvalidNisabConfigurationError(
      'Vul een bedrag in voor je handmatige nisab.',
    )
  }

  const row = await prisma.zakatProfile.update({
    where: { userId: actor.userId },
    data: {
      defaultCurrency: input.defaultCurrency,
      nisabBasis: input.nisabBasis,
      customNisabValue: input.customNisabValue,
      customNisabCurrency:
        input.nisabBasis === 'CUSTOM'
          ? (input.defaultCurrency ?? existing.defaultCurrency)
          : undefined,
      zakatDueDate: input.zakatDueDate,
      hijriDueDay: input.zakatDueDate ? toHijri(input.zakatDueDate).day : undefined,
      hijriDueMonth: input.zakatDueDate ? toHijri(input.zakatDueDate).month : undefined,
      relevantAssetTypes: input.relevantAssetTypes,
      onboardingStep: Math.max(existing.onboardingStep, input.step),
    },
  })

  if (row.onboardingStep >= ONBOARDING_STEPS && existing.onboardingStep < ONBOARDING_STEPS) {
    await prisma.user.update({
      where: { id: actor.userId },
      data: { onboardedAt: new Date() },
    })

    await recordAudit({
      userId: actor.userId,
      action: 'ONBOARDING_COMPLETED',
      entityType: 'ZakatProfile',
      entityId: row.id,
    })

    trackEvent('ZAKAT_ONBOARDING_COMPLETED', actor.userId, { nisabBasis: row.nisabBasis })
  }

  return toView(row, actor.timezone)
}
