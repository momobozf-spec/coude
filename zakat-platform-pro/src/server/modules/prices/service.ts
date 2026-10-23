import 'server-only'

import type { PublishedPriceKind } from '@/generated/prisma/client'

import { CURRENCY_CODES } from '@/config/currencies'
import { serverEnv } from '@/config/env'
import { ValidationError } from '@/lib/errors'
import { SCALE, fromScaled, toScaled } from '@/lib/decimal'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { ageInDays } from '@/server/integrations/published-prices/core'
import { recordAudit } from '@/server/services/audit'

/**
 * Beheer van gepubliceerde marktprijzen.
 *
 * Alleen beheerders (de aanroeper controleert `requireAdmin`). Een publicatie
 * voor een dag die al een waarde heeft vervangt die waarde: de unieke sleutel is
 * (soort, valuta, dag). Afgeronde berekeningen merken daar niets van — zij
 * dragen hun eigen kopie van de prijs.
 */

export interface PublishInput {
  kind: PublishedPriceKind
  currency: string
  value: string
  /** `yyyy-mm-dd`. */
  effectiveDate: string
  source: string
}

function parseDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new ValidationError('Ongeldige datum.')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.toISOString().slice(0, 10) !== value) throw new ValidationError('Deze datum bestaat niet.')
  return date
}

export function normalizePublishInput(input: PublishInput, now: Date = new Date()) {
  const currency = input.currency.trim().toUpperCase()
  const source = input.source.trim()

  if (input.kind === 'FX_PER_EUR') {
    if (currency === 'EUR') throw new ValidationError('De koers van EUR tegenover EUR is altijd 1.')
    if (!CURRENCY_CODES.includes(currency)) throw new ValidationError('Deze valuta wordt niet ondersteund.')
  } else if (currency !== 'EUR') {
    throw new ValidationError('Metaalprijzen worden in EUR gepubliceerd; andere valuta lopen via de koers.')
  }

  const normalized = input.value.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new ValidationError('Geef een positief getal op, bijvoorbeeld 98.4512.')

  let scaled: bigint
  try {
    scaled = toScaled(normalized, SCALE.FX_RATE)
  } catch {
    throw new ValidationError('Geef een positief getal op, bijvoorbeeld 98.4512.')
  }
  if (scaled <= 0n) throw new ValidationError('De waarde moet groter zijn dan 0.')

  if (source.length < 3 || source.length > 200) {
    throw new ValidationError('Vermeld de bron (3 tot 200 tekens), bijvoorbeeld "LBMA Gold Price PM".')
  }

  const effectiveDate = parseDay(input.effectiveDate)
  if (ageInDays(effectiveDate, now) < 0) {
    throw new ValidationError('Een prijs kan niet voor een dag in de toekomst gepubliceerd worden.')
  }

  return {
    kind: input.kind,
    currency,
    value: fromScaled(scaled, SCALE.FX_RATE),
    effectiveDate,
    source,
  }
}

export async function publishPrice(actor: Actor | null, input: PublishInput): Promise<void> {
  const row = normalizePublishInput(input)

  await prisma.publishedPrice.upsert({
    where: {
      kind_currency_effectiveDate: {
        kind: row.kind,
        currency: row.currency,
        effectiveDate: row.effectiveDate,
      },
    },
    create: { ...row, publishedById: actor?.userId ?? null },
    update: { value: row.value, source: row.source, publishedById: actor?.userId ?? null },
  })

  await recordAudit({
    userId: actor?.userId ?? null,
    action: 'PRICE_PUBLISHED',
    entityType: 'PublishedPrice',
    metadata: {
      kind: row.kind,
      currency: row.currency,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      source: row.source,
    },
  })
}

export interface PriceStatusRow {
  kind: PublishedPriceKind
  currency: string
  value: string | null
  effectiveDate: Date | null
  source: string | null
  ageDays: number | null
  stale: boolean
}

/** Per soort en valuta de recentste publicatie, met een vlag als ze te oud is. */
export async function priceStatus(now: Date = new Date()): Promise<PriceStatusRow[]> {
  const maxAge = serverEnv().MAX_PRICE_AGE_DAYS
  const wanted: Array<{ kind: PublishedPriceKind; currency: string }> = [
    { kind: 'GOLD_PER_GRAM', currency: 'EUR' },
    { kind: 'SILVER_PER_GRAM', currency: 'EUR' },
    ...CURRENCY_CODES.filter((code) => code !== 'EUR').map((currency) => ({
      kind: 'FX_PER_EUR' as const,
      currency,
    })),
  ]

  return Promise.all(
    wanted.map(async ({ kind, currency }) => {
      const row = await prisma.publishedPrice.findFirst({
        where: { kind, currency },
        orderBy: { effectiveDate: 'desc' },
      })
      if (!row) {
        return { kind, currency, value: null, effectiveDate: null, source: null, ageDays: null, stale: true }
      }
      const ageDays = ageInDays(row.effectiveDate, now)
      return {
        kind,
        currency,
        value: row.value.toString(),
        effectiveDate: row.effectiveDate,
        source: row.source,
        ageDays,
        stale: ageDays > maxAge,
      }
    }),
  )
}

// ── Automatische aanvulling van de wisselkoersen ─────────────────────────────

export interface FxSyncResult {
  published: string[]
  /** Ondersteunde valuta die de ECB niet publiceert (MAD, SAR, AED): handmatig. */
  manualOnly: string[]
  missing: string[]
}

/**
 * Haalt de ECB-referentiekoersen op en publiceert ze als gewone publicatie, met
 * de datum die de ECB opgeeft. Valuta die de ECB niet kent, blijven voor de
 * beheerder.
 */
export async function syncEcbRates(fetchImpl: typeof fetch = fetch): Promise<FxSyncResult> {
  const { ECB_CURRENCIES, fetchEcbRates } = await import(
    '@/server/integrations/published-prices/frankfurter'
  )

  const supported = CURRENCY_CODES.filter((code) => code !== 'EUR')
  const fromEcb = supported.filter((code) => ECB_CURRENCIES.has(code))
  const manualOnly = supported.filter((code) => !ECB_CURRENCIES.has(code))

  const { quotes, missing } = await fetchEcbRates(fromEcb, fetchImpl)

  for (const quote of quotes) {
    await publishPrice(null, {
      kind: 'FX_PER_EUR',
      currency: quote.currency,
      value: quote.perEur,
      effectiveDate: quote.effectiveDate,
      source: 'ECB-referentiekoers (via frankfurter.dev)',
    })
  }

  return { published: quotes.map((q) => q.currency), manualOnly, missing }
}
