/**
 * Van gekwalificeerde lead naar verstuurd bericht.
 *
 * ─── DE VIER POORTEN ─────────────────────────────────────────────────────────
 *
 * Tussen "we hebben een particuliere advertentie" en "er gaat een bericht uit"
 * zitten vier controles, elk met een eigen reden:
 *
 *   1. Is de lead goed genoeg?      classificatie ≥ drempel, score ≥ drempel
 *   2. Wil dit abonnement hem?      gebied, prijs, type, telefoon-eis
 *   3. Is hij al verstuurd?         unieke dedupeKey in de database
 *   4. Kan hij verstuurd worden?    actief abonnement, bekende chat
 *
 * Poort 3 is de enige die niet in code te vertrouwen is, en die staat dus als
 * UNIQUE-constraint in de database. Twee workers die op dezelfde milliseconde
 * dezelfde lead verwerken worden daar afgevangen, niet hier.
 */
import type { Prisma } from '@prisma/client'

import { bestTerritoryMatch } from '@/domain/territory/match'
import type { TerritoryDefinition, TerritoryMatch, TerritorySubject } from '@/domain/types'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import {
  buildAlertMessage,
  buildDedupeKey,
  type AlertReason,
} from '@/notifications/alertMessage'
import { TelegramClient } from '@/notifications/telegramClient'
import { prisma } from '@/repositories/prisma'

const logger = createLogger({ component: 'alerts' })

/** Alles wat een abonnement nodig heeft om te beslissen. */
type SubscriptionWithTargets = Prisma.SubscriptionGetPayload<{
  include: {
    agency: { select: { id: true; name: true; active: true; telegramChatId: true } }
    territories: { include: { territory: true } }
  }
}>

/** De listing-velden waarop een alert wordt gebouwd. */
export interface AlertCandidate {
  listingId: string
  sourceName: string
  url: string
  postalCode: string | null
  city: string | null
  province: string | null
  latitude: number | null
  longitude: number | null
  propertyType: string | null
  listingType: 'sale' | 'rent' | null
  price: number | null
  currency: string
  bedrooms: number | null
  surfaceArea: number | null
  sellerName: string | null
  sellerPhoneE164: string | null
  sellerClassification: 'private' | 'professional' | 'unknown'
  sellerConfidence: number
  classificationReasons: string[]
  leadScore: number
  firstSeenAt: Date
  isDuplicate: boolean
}

function toTerritoryDefinition(
  row: SubscriptionWithTargets['territories'][number]['territory'],
): TerritoryDefinition {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    postalCodes: row.postalCodes,
    municipalities: row.municipalities,
    provinces: row.provinces,
    centerLat: row.centerLat,
    centerLng: row.centerLng,
    radiusKm: row.radiusKm,
    active: row.active,
  }
}

export interface SubscriptionDecision {
  subscription: SubscriptionWithTargets
  matched: boolean
  territoryMatch: TerritoryMatch | null
  /** Waarom niet — zichtbaar in de logs, onmisbaar bij "waarom kreeg ik dit niet?" */
  rejection: string | null
}

/**
 * Beoordeelt één abonnement tegen één lead. Puur, dus los testbaar.
 *
 * Geeft altijd een `SubscriptionDecision` terug, ook bij afwijzing: het
 * verschil tussen "geen gebiedsmatch" en "prijs te hoog" is precies wat een
 * makelaar wil horen als hij belt met de vraag waarom hij niets krijgt.
 */
export function evaluateSubscription(
  subscription: SubscriptionWithTargets,
  candidate: AlertCandidate,
  defaults: { minPrivateConfidence: number; minLeadScore: number },
): SubscriptionDecision {
  const reject = (rejection: string): SubscriptionDecision => ({
    subscription,
    matched: false,
    territoryMatch: null,
    rejection,
  })

  if (subscription.status !== 'ACTIVE') return reject(`abonnement is ${subscription.status}`)
  if (!subscription.agency.active) return reject('makelaar staat inactief')

  if (candidate.isDuplicate) return reject('advertentie is een duplicaat')

  // ── Poort 1: is de verkoper een particulier? ──────────────────────────────
  if (candidate.sellerClassification !== 'private') {
    return reject(`verkoper is ${candidate.sellerClassification}`)
  }

  const confidenceThreshold = Math.max(
    subscription.minPrivateConfidence,
    defaults.minPrivateConfidence,
  )
  if (candidate.sellerConfidence < confidenceThreshold) {
    return reject(
      `zekerheid ${candidate.sellerConfidence.toFixed(2)} onder drempel ${confidenceThreshold.toFixed(2)}`,
    )
  }

  const scoreThreshold = Math.max(subscription.minLeadScore, defaults.minLeadScore)
  if (candidate.leadScore < scoreThreshold) {
    return reject(`leadscore ${candidate.leadScore} onder drempel ${scoreThreshold}`)
  }

  // ── Poort 2: wil dit abonnement deze lead? ────────────────────────────────
  if (subscription.requirePhone && !candidate.sellerPhoneE164) {
    return reject('abonnement vereist een telefoonnummer')
  }

  if (subscription.listingTypes.length > 0) {
    const wanted = candidate.listingType === 'rent' ? 'RENT' : 'SALE'
    if (!subscription.listingTypes.includes(wanted)) {
      return reject(`type ${wanted} staat niet in het abonnement`)
    }
  }

  if (subscription.propertyTypes.length > 0) {
    const type = candidate.propertyType?.toLowerCase() ?? ''
    const wanted = subscription.propertyTypes.map((value) => value.toLowerCase())
    if (!wanted.some((value) => type.includes(value))) {
      return reject(`woningtype "${candidate.propertyType ?? 'onbekend'}" staat niet in het abonnement`)
    }
  }

  if (subscription.minPrice !== null && (candidate.price ?? 0) < subscription.minPrice) {
    return reject(`prijs onder ${subscription.minPrice}`)
  }
  if (subscription.maxPrice !== null && candidate.price !== null && candidate.price > subscription.maxPrice) {
    return reject(`prijs boven ${subscription.maxPrice}`)
  }

  // ── Gebied ────────────────────────────────────────────────────────────────
  const territories = subscription.territories.map((link) => toTerritoryDefinition(link.territory))
  if (territories.length === 0) return reject('abonnement heeft geen werkgebied')

  const subject: TerritorySubject = {
    postalCode: candidate.postalCode,
    city: candidate.city,
    province: candidate.province,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  }

  const territoryMatch = bestTerritoryMatch(territories, subject)
  if (!territoryMatch) return reject('advertentie ligt buiten het werkgebied')

  return { subscription, matched: true, territoryMatch, rejection: null }
}

/** Naar welke chat gaat dit abonnement? Abonnement wint van makelaar. */
export function resolveChatId(subscription: SubscriptionWithTargets, fallback: string): string | null {
  const chatId = subscription.telegramChatId ?? subscription.agency.telegramChatId ?? fallback
  return chatId && chatId.length > 0 ? chatId : null
}

export interface DispatchResult {
  evaluated: number
  matched: number
  sent: number
  suppressed: number
  failed: number
  decisions: SubscriptionDecision[]
}

/**
 * Stuurt een lead naar alle abonnementen die hem willen.
 *
 * Elke ontvanger wordt afzonderlijk afgehandeld: een makelaar die zijn bot
 * blokkeerde mag de melding aan de anderen niet tegenhouden.
 */
export async function dispatchLead(
  candidate: AlertCandidate,
  options: {
    reason?: AlertReason
    now?: Date
    telegram?: TelegramClient
  } = {},
): Promise<DispatchResult> {
  const env = getEnv()
  const now = options.now ?? new Date()
  const reason = options.reason ?? 'new'
  const telegram = options.telegram ?? new TelegramClient({ botToken: env.TELEGRAM_BOT_TOKEN })

  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', agency: { active: true } },
    include: {
      agency: { select: { id: true, name: true, active: true, telegramChatId: true } },
      territories: { include: { territory: true } },
    },
  })

  const result: DispatchResult = {
    evaluated: subscriptions.length,
    matched: 0,
    sent: 0,
    suppressed: 0,
    failed: 0,
    decisions: [],
  }

  for (const subscription of subscriptions) {
    const decision = evaluateSubscription(subscription, candidate, {
      minPrivateConfidence: env.PRIVATE_CONFIDENCE_THRESHOLD,
      minLeadScore: env.MIN_LEAD_SCORE,
    })
    result.decisions.push(decision)

    if (!decision.matched) continue
    result.matched += 1

    const chatId = resolveChatId(subscription, env.TELEGRAM_FALLBACK_CHAT_ID)
    if (!chatId) {
      logger.warn('Abonnement matcht maar heeft geen Telegram-chat', {
        subscriptionId: subscription.id,
        agency: subscription.agency.name,
      })
      result.failed += 1
      continue
    }

    const dedupeKey = buildDedupeKey(subscription.id, candidate.listingId, reason)
    const messageText = buildAlertMessage({
      postalCode: candidate.postalCode,
      city: candidate.city,
      propertyType: candidate.propertyType,
      listingType: candidate.listingType,
      price: candidate.price,
      currency: candidate.currency,
      bedrooms: candidate.bedrooms,
      surfaceArea: candidate.surfaceArea,
      sellerName: candidate.sellerName,
      sellerPhoneE164: candidate.sellerPhoneE164,
      sellerConfidence: candidate.sellerConfidence,
      classificationReasons: candidate.classificationReasons,
      leadScore: candidate.leadScore,
      url: candidate.url,
      sourceName: candidate.sourceName,
      firstSeenAt: candidate.firstSeenAt,
      territoryName: decision.territoryMatch?.territoryName ?? null,
      now,
    })

    // De insert claimt het recht om dit bericht te versturen. Slaagt hij niet
    // op de unique-constraint, dan heeft iemand anders het al gedaan — en
    // versturen we niets. Dit staat vóór de netwerkoproep, niet erna: andersom
    // zou een crash tussen versturen en opslaan een tweede bericht opleveren.
    let alertId: string
    try {
      const created = await prisma.alert.create({
        data: {
          listingId: candidate.listingId,
          subscriptionId: subscription.id,
          agencyId: subscription.agency.id,
          channel: 'TELEGRAM',
          status: 'PENDING',
          dedupeKey,
          leadScore: candidate.leadScore,
          chatId,
          messageText,
        },
        select: { id: true },
      })
      alertId = created.id
    } catch (error) {
      if (isUniqueViolation(error)) {
        logger.debug('Alert bestond al, niet opnieuw verstuurd', { dedupeKey })
        result.suppressed += 1
        continue
      }
      throw error
    }

    try {
      const sendResult = await telegram.sendMessage(chatId, messageText)

      if (sendResult.dryRun) {
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: 'SUPPRESSED_DRY_RUN', attempts: 1, sentAt: now },
        })
        result.suppressed += 1
        continue
      }

      if (sendResult.ok) {
        await prisma.alert.update({
          where: { id: alertId },
          data: {
            status: 'SENT',
            attempts: 1,
            sentAt: new Date(),
            providerMessageId: sendResult.messageId,
          },
        })
        result.sent += 1
        logger.info('Lead verstuurd', {
          listingId: candidate.listingId,
          agency: subscription.agency.name,
          leadScore: candidate.leadScore,
        })
      } else {
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: 'FAILED', attempts: 1, error: sendResult.error?.slice(0, 500) },
        })
        result.failed += 1
        logger.warn('Telegram weigerde het bericht', {
          agency: subscription.agency.name,
          error: sendResult.error,
        })
      }
    } catch (error) {
      // De alert-rij blijft op PENDING staan; `retryPendingAlerts` pikt hem op.
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'FAILED',
          attempts: 1,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      })
      result.failed += 1
      logger.error('Versturen mislukt', {
        agency: subscription.agency.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

/**
 * Probeert eerder mislukte berichten opnieuw.
 *
 * Wordt door de worker aangeroepen. Bewust begrensd op drie pogingen: een chat
 * die drie keer weigert is meestal een bot die geblokkeerd is, en dan is verder
 * proberen alleen ruis.
 */
export async function retryFailedAlerts(
  options: { limit?: number; telegram?: TelegramClient } = {},
): Promise<{ retried: number; sent: number }> {
  const env = getEnv()
  const telegram = options.telegram ?? new TelegramClient({ botToken: env.TELEGRAM_BOT_TOKEN })

  const pending = await prisma.alert.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: options.limit ?? 20,
  })

  let sent = 0

  for (const alert of pending) {
    try {
      const result = await telegram.sendMessage(alert.chatId, alert.messageText)

      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          status: result.dryRun ? 'SUPPRESSED_DRY_RUN' : result.ok ? 'SENT' : 'FAILED',
          attempts: alert.attempts + 1,
          sentAt: result.ok ? new Date() : null,
          providerMessageId: result.messageId,
          error: result.error?.slice(0, 500) ?? null,
        },
      })

      if (result.ok && !result.dryRun) sent += 1
    } catch (error) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          attempts: alert.attempts + 1,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      })
    }
  }

  return { retried: pending.length, sent }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}
