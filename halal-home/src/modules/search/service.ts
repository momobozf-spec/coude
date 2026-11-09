/**
 * De zoeklogica: van vrije tekst tot opgeslagen matches.
 *
 * De volledige keten van één run:
 *
 *   criteria → bronnen bevragen → normaliseren → ontdubbelen → opslaan of
 *   bijwerken → matchen → matches opslaan → run afsluiten
 *
 * Elke stap staat apart en is testbaar. Wat puur is (normaliseren, ontdubbelen,
 * matchen) staat in `domain/`; hier staat de orkestratie en de database.
 */
import 'server-only'
import { RunStatus, SearchFrequency, type Prisma } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { ConflictError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/modules/audit/service'
import { checkLimit, PLANS } from '@/modules/billing/plans'
import { matchProperty, type MatchableProperty } from '@/modules/property/domain/matching'
import {
  dedupeBatch,
  diffProperty,
  findDuplicate,
  normalizeListing,
  type NormalizedProperty,
} from '@/modules/property/domain/normalize'
import { buildSourceContext, getPropertySources } from '@/server/integrations/property'
import {
  CRITERIA_SCHEMA_VERSION,
  describeCriteria,
  hasAnyCriterion,
  searchCriteriaSchema,
  type SearchCriteria,
} from './schemas/searchCriteria'
import { parseQuery } from './parserAi'
import * as repository from './repository'

/**
 * Leest de opgeslagen criteria van een zoekopdracht.
 *
 * Valideert bij het teruglezen, niet alleen bij het schrijven: een document dat
 * met een ouder schema is geschreven mag geen onvoorspelbaar gedrag geven
 * verderop. Faalt de validatie, dan is dat een expliciete fout en geen stille
 * lege zoekopdracht.
 */
export function readCriteria(raw: unknown): SearchCriteria {
  const parsed = searchCriteriaSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(
      'De opgeslagen zoekcriteria zijn niet leesbaar. Maak de zoekopdracht opnieuw aan.',
    )
  }
  return parsed.data
}

export interface CreateSearchResult {
  searchId: string
  criteria: SearchCriteria
  /** Welke laag de criteria leverde: het model of de deterministische parser. */
  source: 'ai' | 'deterministic'
  recognized: string[]
}

/**
 * Maakt een zoekopdracht uit vrije tekst.
 *
 * De planlimiet wordt hier gecontroleerd en niet in de UI: een limiet die
 * alleen in een component staat, is geen limiet.
 */
export async function createSearchFromQuery(
  userId: string,
  input: { query: string; name?: string; journeyId?: string | null; frequency?: SearchFrequency },
): Promise<CreateSearchResult> {
  const query = input.query.trim()
  if (query.length < 3) {
    throw new ValidationError('Beschrijf in een paar woorden wat je zoekt')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!user) throw new ValidationError('Gebruiker niet gevonden')

  const active = await repository.countActiveSearches(userId)
  const limit = checkLimit(user.plan, 'maxActiveSearches', active)
  if (!limit.allowed) {
    throw new ConflictError(
      limit.message ?? `Je ${PLANS[user.plan].label}-plan staat niet meer zoekopdrachten toe.`,
    )
  }

  const parsed = await parseQuery(query)

  if (!hasAnyCriterion(parsed.criteria)) {
    throw new ValidationError(
      'We konden hier geen zoekcriteria uit halen. Noem bijvoorbeeld een gemeente, een maximumprijs of een aantal slaapkamers.',
    )
  }

  const name = input.name?.trim() || describeCriteria(parsed.criteria)

  const search = await repository.createSearch(userId, {
    name: await uniqueName(userId, name),
    originalQuery: query,
    criteria: parsed.criteria as unknown as Prisma.InputJsonValue,
    criteriaVersion: CRITERIA_SCHEMA_VERSION,
    journeyId: input.journeyId ?? null,
    frequency: input.frequency,
  })

  await recordAudit({
    userId,
    action: 'SEARCH_CREATED',
    entityType: 'PropertySearch',
    entityId: search.id,
    metadata: { source: parsed.source },
  })

  return {
    searchId: search.id,
    criteria: parsed.criteria,
    source: parsed.source,
    recognized: parsed.recognized,
  }
}

/**
 * Maakt de naam uniek binnen deze gebruiker.
 *
 * De unique constraint op (userId, name) zou anders een 500 geven op de tweede
 * zoekopdracht met dezelfde beschrijving — en dat is precies wat er gebeurt
 * wanneer iemand twee keer "Te koop · in Gent · tot 450.000 €" zoekt.
 */
async function uniqueName(userId: string, base: string): Promise<string> {
  const trimmed = base.slice(0, 90)
  const existing = await prisma.propertySearch.findMany({
    where: { userId, name: { startsWith: trimmed } },
    select: { name: true },
  })

  if (!existing.some((s) => s.name === trimmed)) return trimmed

  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${trimmed} (${suffix})`
    if (!existing.some((s) => s.name === candidate)) return candidate
  }

  return `${trimmed} (${Date.now()})`
}

export interface RunResult {
  runId: string
  fetched: number
  newProperties: number
  updatedProperties: number
  matches: number
  newMatches: number
  sourceStats: Record<string, unknown>
}

/**
 * Voert een zoekopdracht uit.
 *
 * Fouten van één bron laten de andere doorlopen: als één API plat ligt, moet de
 * gebruiker nog steeds de resultaten van de rest zien. Wat er misging komt in
 * `SearchRun.sourceStats` te staan.
 */
export async function runSearch(userId: string, searchId: string): Promise<RunResult> {
  const search = await repository.requireSearch(userId, searchId)
  const criteria = readCriteria(search.criteria)

  const run = await repository.startRun(searchId)
  const sourceStats: Record<string, unknown> = {}

  try {
    // ── 1. Bronnen bevragen ─────────────────────────────────────────────────
    const context = buildSourceContext()
    const raw: NormalizedProperty[] = []

    for (const source of getPropertySources()) {
      try {
        const result = await source.search(criteria, context)
        sourceStats[source.name] = result.stats

        for (const listing of result.listings) {
          raw.push(normalizeListing(source.name, listing))
        }
      } catch (error) {
        // Geen throw: één kapotte bron mag de run niet slopen.
        sourceStats[source.name] = {
          fetched: 0,
          durationMs: 0,
          error: error instanceof Error ? error.message : 'onbekende fout',
        }
        logger.warn('Vastgoedbron mislukt', { source: source.name })
      }
    }

    // ── 2. Ontdubbelen binnen de batch ──────────────────────────────────────
    const batch = dedupeBatch(raw)

    // ── 3. Opslaan of bijwerken ─────────────────────────────────────────────
    const existing = await repository.findExistingForDedupe(batch)
    const propertyIds: string[] = []
    let newProperties = 0
    let updatedProperties = 0

    for (const candidate of batch) {
      const duplicate = findDuplicate(candidate, existing)

      if (!duplicate) {
        const created = await repository.createProperty(candidate)
        propertyIds.push(created.id)
        newProperties++
        continue
      }

      // Een fingerprint-match is geen bewijs: twee identieke appartementen in
      // hetzelfde gebouw geven dezelfde vingerafdruk. Alleen bij een zekere
      // match werken we het bestaande pand bij; anders slaan we het als apart
      // pand op en laten we de beslissing aan een mens.
      if (!duplicate.match.confident) {
        const created = await repository.createProperty(candidate)
        propertyIds.push(created.id)
        newProperties++
        continue
      }

      const before = existing.find((e) => e.id === duplicate.property.id)
      const changes = before ? diffProperty(before, candidate) : []

      await repository.updateProperty(duplicate.property.id, candidate, changes)
      propertyIds.push(duplicate.property.id)
      if (changes.length > 0) updatedProperties++
    }

    // ── 4. Matchen ──────────────────────────────────────────────────────────
    const properties = await repository.findPropertiesByIds(propertyIds)
    const matches = properties
      .map((property) => {
        const result = matchProperty(toMatchable(property), criteria)
        return {
          searchId,
          propertyId: property.id,
          userId,
          score: result.score,
          hardPass: result.hardPass,
          reasons: result.reasons as unknown as Prisma.InputJsonValue,
        }
      })
      // Alleen panden die de harde eisen halen komen in de lijst. De rest
      // bewaren we niet: een match die nooit getoond wordt, is ruis.
      .filter((m) => m.hardPass)

    const newMatches = await repository.upsertMatches(matches)

    // ── 5. Afsluiten ────────────────────────────────────────────────────────
    await repository.finishRun(run.id, {
      status: RunStatus.COMPLETED,
      fetchedCount: raw.length,
      newPropertyCount: newProperties,
      matchCount: matches.length,
      sourceStats: sourceStats as Prisma.InputJsonValue,
    })

    await repository.updateSearch(userId, searchId, {
      lastRunAt: new Date(),
      nextRunAt: nextRunFor(search.frequency),
    })

    return {
      runId: run.id,
      fetched: raw.length,
      newProperties,
      updatedProperties,
      matches: matches.length,
      newMatches,
      sourceStats,
    }
  } catch (error) {
    await repository.finishRun(run.id, {
      status: RunStatus.FAILED,
      fetchedCount: 0,
      newPropertyCount: 0,
      matchCount: 0,
      sourceStats: sourceStats as Prisma.InputJsonValue,
      error: error instanceof Error ? error.message : 'onbekende fout',
    })
    throw error
  }
}

/** Wanneer draait deze zoekopdracht opnieuw? */
export function nextRunFor(frequency: SearchFrequency, from: Date = new Date()): Date {
  const hours: Record<SearchFrequency, number> = {
    HOURLY: 1,
    EVERY_6_HOURS: 6,
    DAILY: 24,
    // Handmatig: ver in de toekomst, zodat de scheduler hem niet oppikt.
    MANUAL: 24 * 365,
  }

  return new Date(from.getTime() + hours[frequency] * 3_600_000)
}

type PropertyRow = Awaited<ReturnType<typeof repository.findPropertiesByIds>>[number]

/** Zet een databaserij om in wat de matcher nodig heeft. */
export function toMatchable(property: PropertyRow): MatchableProperty {
  return {
    title: property.title,
    description: property.description,
    city: property.city,
    postalCode: property.postalCode,
    propertyType: property.propertyType,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingAreaM2: property.livingAreaM2,
    landAreaM2: property.landAreaM2,
    epcLabel: property.epcLabel,
    features: property.features,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bewaarde panden
// ─────────────────────────────────────────────────────────────────────────────

export async function savePropertyForUser(
  userId: string,
  propertyId: string,
  options: { journeyId?: string | null } = {},
) {
  const property = await repository.findPropertyById(propertyId)
  if (!property) throw new ValidationError('Woning niet gevonden')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (!user) throw new ValidationError('Gebruiker niet gevonden')

  const existing = await repository.findSavedProperty(userId, propertyId)
  if (!existing) {
    const count = await repository.countSavedProperties(userId)
    const limit = checkLimit(user.plan, 'maxSavedProperties', count)
    if (!limit.allowed) {
      throw new ConflictError(limit.message ?? 'Je plan staat niet meer bewaarde woningen toe.')
    }
  }

  return repository.saveProperty(userId, propertyId, {
    journeyId: options.journeyId ?? null,
    // Snapshot van de prijs, zodat "€12.000 gedaald sinds jij hem bewaarde"
    // geen historiek-query nodig heeft.
    priceAtSave: property.price,
  })
}
