/**
 * Productanalytics.
 *
 * ─── STRIKT GESCHEIDEN VAN DE AUDIT LOG ──────────────────────────────────────
 *
 * Een auditregel legt vast wie welk document downloadde en moet bewaard blijven.
 * Een analytics-event zegt alleen dát er ergens een stap is afgerond, en mag
 * weg. Ze door elkaar halen betekent ofwel dat je audittrail wordt opgeschoond,
 * ofwel dat je analytics persoonsgegevens bevat die je niet kwijt raakt.
 *
 * ─── WAT ER NOOIT IN MAG ─────────────────────────────────────────────────────
 *
 * Bedragen, adressen, postcodes, bestandsnamen, e-mailadressen, en taaktitels
 * die de gebruiker zelf typte. Dat is geen richtlijn maar een controle:
 * `sanitizeProperties` hieronder laat alleen sleutels door die op de whitelist
 * staan, en gooit al het andere weg. Een nieuwe eigenschap toevoegen vereist
 * dus een bewuste wijziging in dit bestand — precies de plek waar iemand
 * nadenkt over of het wel mag.
 */
import 'server-only'
import { AnalyticsEventType, type JourneyStage } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { logger } from '@/lib/logger'

/**
 * De eigenschappen die een event mag dragen.
 *
 * Allemaal tellingen, enum-namen of booleans. Geen enkele bevat vrije tekst van
 * de gebruiker of een bedrag.
 */
const ALLOWED_PROPERTIES = new Set([
  'stageIndex',
  'taskCount',
  'completedCount',
  'openCount',
  'optionalCount',
  'itemCount',
  'progressPercentage',
  'blueprintVersion',
  'recommendationKey',
  'severity',
  'effort',
  'step',
  'goal',
  'timeline',
  'purchaseType',
  'needsFinancing',
  'country',
  'region',
  'hasBudget',
  'hasOwnContribution',
  'wasOptional',
  'fromStage',
  'toStage',
  'source',
  'category',
  'result',
  'documentCount',
])

export type AnalyticsValue = string | number | boolean | null

export interface AnalyticsInput {
  userId: string | null
  type: AnalyticsEventType
  stage?: JourneyStage | null
  /** Stabiele blauwdruk- of checklistsleutel. Nooit een titel. */
  entityKey?: string | null
  properties?: Record<string, AnalyticsValue>
}

/**
 * Filtert de eigenschappen tegen de whitelist.
 *
 * Exported omdat dit precies het gedrag is dat een test moet kunnen vastpinnen:
 * als iemand ooit `amount` of `address` meegeeft, moet die eruit vallen.
 */
export function sanitizeProperties(
  properties: Record<string, AnalyticsValue> | undefined,
): Record<string, AnalyticsValue> | undefined {
  if (!properties) return undefined

  const clean: Record<string, AnalyticsValue> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue
    // Ook een toegestane sleutel mag geen lange vrije tekst dragen: dat zou de
    // whitelist omzeilen door bijvoorbeeld een adres in `source` te stoppen.
    if (typeof value === 'string' && value.length > 64) continue
    clean[key] = value
  }

  return Object.keys(clean).length > 0 ? clean : undefined
}

/**
 * Een blauwdruksleutel ziet eruit als `FINANCING_COMPARE_OPTIONS` of als een
 * checklistsleutel `doc.payslips`. Alles wat daar niet op lijkt, is
 * vermoedelijk vrije tekst en gaat er niet in.
 */
const STABLE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/

export function isStableKey(value: string): boolean {
  return STABLE_KEY_PATTERN.test(value)
}

/**
 * Schrijft een event.
 *
 * Faalt nooit hard: een mislukte meting mag geen taak-afvinking terugdraaien.
 * De fout wordt wel gelogd, want stil wegvallende analytics is op termijn een
 * groter probleem dan één verloren rij.
 */
export async function recordEvent(input: AnalyticsInput): Promise<void> {
  try {
    const entityKey =
      input.entityKey && isStableKey(input.entityKey) ? input.entityKey : null

    if (input.entityKey && !entityKey) {
      logger.warn('Analytics entityKey geweigerd: lijkt geen stabiele sleutel', {
        type: input.type,
      })
    }

    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        stage: input.stage ?? null,
        entityKey,
        properties: sanitizeProperties(input.properties),
      },
    })
  } catch (error) {
    logger.error('Analytics-event kon niet worden geschreven', {
      type: input.type,
      error: error instanceof Error ? error.message : 'onbekend',
    })
  }
}

/**
 * Meerdere events in één keer. Gebruikt bij het initialiseren van een traject,
 * waar anders een reeks losse inserts zou ontstaan.
 */
export async function recordEvents(inputs: readonly AnalyticsInput[]): Promise<void> {
  if (inputs.length === 0) return

  try {
    await prisma.analyticsEvent.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        stage: input.stage ?? null,
        entityKey:
          input.entityKey && isStableKey(input.entityKey) ? input.entityKey : null,
        properties: sanitizeProperties(input.properties),
      })),
    })
  } catch (error) {
    logger.error('Analytics-events konden niet worden geschreven', {
      count: inputs.length,
      error: error instanceof Error ? error.message : 'onbekend',
    })
  }
}

export { AnalyticsEventType }
