/**
 * Zod-schema's voor alles wat van buiten komt: collectoruitvoer, formulieren in
 * het dashboard, querystrings, en de cron-route.
 *
 * De regel is streng: geen enkele waarde uit een externe bron of een browser
 * raakt de database zonder eerst door een schema hier te zijn gegaan.
 */
import { z } from 'zod'

import { isBelgianPostalCode } from './geo/provinces'

export const listingTypeSchema = z.enum(['sale', 'rent'])
export const sellerTypeSchema = z.enum(['private', 'professional', 'unknown'])

/**
 * Wat een collector mag opleveren.
 *
 * Bewust tolerant op de inhoud (bijna alles optioneel) en streng op de vorm:
 * een `price` die als string binnenkomt wordt geweigerd, want dan heeft de
 * collector zijn werk niet gedaan en verstopt een coercion hier de bug.
 */
export const rawListingSchema = z.object({
  source: z.string().min(1),
  sourceListingId: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  description: z.string().max(20_000).optional(),
  price: z.number().finite().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  listingType: listingTypeSchema.optional(),
  propertyType: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  surfaceArea: z.number().int().min(1).max(100_000).optional(),
  sellerName: z.string().max(200).optional(),
  sellerPhone: z.string().max(60).optional(),
  sellerTypeHint: sellerTypeSchema.optional(),
  sellerProfileUrl: z.string().url().max(2000).optional(),
  sellerListingCount: z.number().int().min(0).max(100_000).optional(),
  publishedAt: z.date().optional(),
  scrapedAt: z.date(),
  raw: z.unknown().optional(),
})

export type RawListingInput = z.infer<typeof rawListingSchema>

export const belgianPostalCodeSchema = z
  .string()
  .trim()
  .refine(isBelgianPostalCode, { message: 'Geen geldige Belgische postcode' })

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard-invoer
// ─────────────────────────────────────────────────────────────────────────────

export const territoryKindSchema = z.enum(['POSTAL_CODE', 'MUNICIPALITY', 'PROVINCE', 'RADIUS'])

/** Komma- of witruimte-gescheiden lijst uit een formulierveld. */
const listField = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(/[,\n;]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  )

export const agencyFormSchema = z.object({
  name: z.string().trim().min(2, 'Naam is te kort').max(200),
  contactEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  /**
   * Telegram chat-id's zijn gehele getallen; groepen zijn negatief en kanalen
   * beginnen met -100. Als string bewaard omdat ze buiten Number.MAX_SAFE_INTEGER
   * kunnen vallen.
   */
  telegramChatId: z
    .union([z.string().trim().regex(/^-?\d{1,20}$/, 'Chat-id is een getal'), z.literal('')])
    .optional(),
  active: z.coerce.boolean().default(true),
})

export const territoryFormSchema = z
  .object({
    agencyId: z.string().min(1),
    name: z.string().trim().min(2).max(200),
    kind: territoryKindSchema,
    postalCodes: listField,
    municipalities: listField,
    provinces: listField,
    centerLat: z.coerce.number().min(-90).max(90).optional(),
    centerLng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional(),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    // Een gebied zonder inhoud matcht nooit iets, en dat merk je pas als er
    // dagenlang geen leads binnenkomen. Daarom hier hard afkeuren.
    const issue = (message: string, path: string): void => {
      ctx.addIssue({ code: 'custom', message, path: [path] })
    }

    if (value.kind === 'POSTAL_CODE') {
      if (value.postalCodes.length === 0) issue('Geef minstens één postcode', 'postalCodes')
      const invalid = value.postalCodes.filter((code) => !isBelgianPostalCode(code))
      if (invalid.length > 0) issue(`Ongeldige postcodes: ${invalid.join(', ')}`, 'postalCodes')
    }
    if (value.kind === 'MUNICIPALITY' && value.municipalities.length === 0) {
      issue('Geef minstens één gemeente', 'municipalities')
    }
    if (value.kind === 'PROVINCE' && value.provinces.length === 0) {
      issue('Geef minstens één provincie', 'provinces')
    }
    if (value.kind === 'RADIUS') {
      if (value.centerLat === undefined) issue('Breedtegraad ontbreekt', 'centerLat')
      if (value.centerLng === undefined) issue('Lengtegraad ontbreekt', 'centerLng')
      if (value.radiusKm === undefined) issue('Straal ontbreekt', 'radiusKm')
    }
  })

export const subscriptionFormSchema = z
  .object({
    agencyId: z.string().min(1),
    name: z.string().trim().min(2).max(200),
    status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).default('ACTIVE'),
    listingTypes: z.array(z.enum(['SALE', 'RENT'])).default([]),
    propertyTypes: listField,
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    minLeadScore: z.coerce.number().int().min(0).max(100).default(55),
    minPrivateConfidence: z.coerce.number().min(0).max(1).default(0.85),
    requirePhone: z.coerce.boolean().default(false),
    telegramChatId: z
      .union([z.string().trim().regex(/^-?\d{1,20}$/), z.literal('')])
      .optional(),
    territoryIds: z.array(z.string()).default([]),
  })
  .refine(
    (value) =>
      value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    { message: 'Minimumprijs ligt boven de maximumprijs', path: ['minPrice'] },
  )

export const sourceFormSchema = z.object({
  key: z.string().min(1),
  enabled: z.coerce.boolean(),
  pollIntervalSeconds: z.coerce.number().int().min(30).max(86_400),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(600),
  timeoutMs: z.coerce.number().int().min(1000).max(120_000),
  maxRetries: z.coerce.number().int().min(0).max(10),
})

/** Filters op /admin/listings. Alles optioneel; lege waarden vallen weg. */
export const listingFilterSchema = z.object({
  source: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(10).optional(),
  listingType: z.enum(['SALE', 'RENT']).optional(),
  sellerType: z.enum(['PRIVATE', 'PROFESSIONAL', 'UNKNOWN']).optional(),
  status: z.enum(['ACTIVE', 'DUPLICATE', 'ARCHIVED', 'REDACTED']).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type ListingFilter = z.infer<typeof listingFilterSchema>

/**
 * Leest een URLSearchParams-achtig object en gooit lege strings weg voordat
 * Zod ernaar kijkt. Zonder dit zou `?source=` als "filter op bron met lege
 * naam" gelden en altijd nul resultaten geven.
 */
export function parseListingFilter(params: Record<string, string | string[] | undefined>): ListingFilter {
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single !== undefined && single !== '') cleaned[key] = single
  }
  const result = listingFilterSchema.safeParse(cleaned)
  return result.success ? result.data : { page: 1 }
}
