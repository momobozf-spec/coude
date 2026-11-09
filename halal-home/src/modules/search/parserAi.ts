/**
 * De AI-laag van de zoekparser.
 *
 * Het model krijgt het Zod-schema als contract (omgezet naar JSON Schema) en
 * moet daaraan voldoen. Wat er terugkomt gaat door `searchCriteriaSchema.parse`,
 * dus een model dat een veld verzint of een verkeerd type teruggeeft, komt er
 * niet doorheen — `.strict()` op het schema zorgt daarvoor.
 *
 * ─── FALLBACK IS DE REGEL, NIET DE UITZONDERING ──────────────────────────────
 *
 * Elke fout — AI uitgeschakeld, geen key, time-out, ongeldige output — leidt
 * naar de deterministische parser. De gebruiker merkt hooguit dat de
 * interpretatie wat grover is; hij krijgt nooit een foutmelding op de plek waar
 * hij net zijn wensen intikte.
 */
import 'server-only'
import { logger } from '@/lib/logger'
import { getAiProvider, isAiEnabled } from '@/server/integrations/ai'
import { searchCriteriaSchema, type SearchCriteria } from './schemas/searchCriteria'
import { parseQueryDeterministic, reconcile } from './domain/parser'

/**
 * Het JSON-schema dat het model als contract krijgt.
 *
 * Handgeschreven en niet gegenereerd uit Zod: een generator produceert een
 * schema vol `anyOf` en `$ref` dat modellen slecht volgen. Dit is dezelfde vorm,
 * maar plat en leesbaar. De echte validatie blijft Zod — dit schema is een
 * instructie, geen garantie.
 */
const JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transactionType: { type: 'string', enum: ['buy', 'rent'] },
    locations: { type: 'array', items: { type: 'string' } },
    postalCodes: { type: 'array', items: { type: 'string', pattern: '^\\d{4}$' } },
    radiusKm: { type: 'integer', minimum: 1, maximum: 100 },
    hardRequirements: { $ref: '#/$defs/constraints' },
    preferences: { $ref: '#/$defs/constraints' },
  },
  $defs: {
    constraints: {
      type: 'object',
      additionalProperties: false,
      properties: {
        propertyTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'house',
              'apartment',
              'villa',
              'studio',
              'penthouse',
              'duplex',
              'loft',
              'bungalow',
              'farmhouse',
              'land',
              'commercial',
              'garage',
              'other',
            ],
          },
        },
        minPrice: { type: 'integer' },
        maxPrice: { type: 'integer' },
        minBedrooms: { type: 'integer' },
        minBathrooms: { type: 'integer' },
        minSurfaceM2: { type: 'integer' },
        minLandSurfaceM2: { type: 'integer' },
        epcLabels: {
          type: 'array',
          items: { type: 'string', enum: ['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        },
        features: { type: 'array', items: { type: 'string' } },
        nearby: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: {
                type: 'string',
                enum: [
                  'mosque',
                  'school',
                  'halal_shop',
                  'supermarket',
                  'public_transport',
                  'hospital',
                  'park',
                ],
              },
              maxDistanceMeters: { type: 'integer', minimum: 100, maximum: 20000 },
            },
            required: ['category'],
          },
        },
        keywords: { type: 'array', items: { type: 'string' } },
        excludedKeywords: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const SYSTEM_PROMPT = `Je zet een Nederlandstalige zoekopdracht voor vastgoed in België om in gestructureerde criteria.

REGELS:
- Verzin nooit criteria die er niet staan. Wat de gebruiker niet noemt, laat je weg.
- Onderscheid harde eisen van voorkeuren:
  "moet", "minstens", "minimaal", "zeker" → hardRequirements
  "liefst", "bij voorkeur", "graag", "idealiter" → preferences
  Bij twijfel: hardRequirements voor prijs en locatie, preferences voor de rest.
- Bedragen zijn in hele euro's. "500k" is 500000, "een half miljoen" is 500000.
- Bij "EPC A of B" neem je alle labels die minstens zo goed zijn: A++, A+, A, B.
- Belgische postcodes zijn vier cijfers. Zet een gemeente in locations, niet in postalCodes.
- radiusKm alleen wanneer er ook een locatie of postcode is.
- Voor "dichtbij een moskee/school/halal winkel" gebruik je nearby met een categorie.

Antwoord uitsluitend met JSON.`

export interface ParsedQuery {
  criteria: SearchCriteria
  /** Welke laag het antwoord leverde. De UI mag dit tonen. */
  source: 'ai' | 'deterministic'
  /** Wat we met zekerheid herkenden. */
  recognized: string[]
}

/**
 * Zet vrije tekst om in criteria.
 *
 * Gooit nooit. In het slechtste geval komen er lege criteria terug, en dan toont
 * de UI "we konden hier niets uit halen" met de velden om het handmatig in te
 * vullen — beter dan een foutmelding.
 */
export async function parseQuery(query: string): Promise<ParsedQuery> {
  const deterministic = parseQueryDeterministic(query)

  if (!isAiEnabled()) {
    return {
      criteria: deterministic.criteria,
      source: 'deterministic',
      recognized: deterministic.recognized,
    }
  }

  try {
    const { value } = await getAiProvider().completeJson<SearchCriteria>({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
      schemaName: 'SearchCriteria',
      jsonSchema: JSON_SCHEMA,
      validate: (raw) => searchCriteriaSchema.parse(raw),
      maxTokens: 1024,
      temperature: 0,
    })

    return {
      criteria: reconcile(deterministic.criteria, value),
      source: 'ai',
      recognized: deterministic.recognized,
    }
  } catch (error) {
    // Geen `throw`: de zoekfunctie moet blijven werken wanneer een externe
    // dienst hapert. De query zelf gaat niet mee de log in — die bevat de
    // woonwensen en het budget van de gebruiker.
    logger.warn('AI-parser mislukt, deterministische parser gebruikt', {
      error: error instanceof Error ? error.message : 'onbekend',
    })

    return {
      criteria: deterministic.criteria,
      source: 'deterministic',
      recognized: deterministic.recognized,
    }
  }
}
