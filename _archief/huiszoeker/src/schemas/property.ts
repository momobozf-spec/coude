/**
 * Het interne formaat waarnaar elke bron genormaliseerd wordt.
 *
 * Dit schema is de grens tussen "scraper" en "de rest van de applicatie":
 * alles wat erdoorheen komt is bruikbaar, alles wat faalt is een scraperbug en
 * wordt als zodanig gelogd. Geen enkele service downstream hoeft nog te
 * verdedigen tegen half ingevulde velden.
 */
import { z } from "zod";
import { EPC_LABELS, PROPERTY_TYPES, TRANSACTION_TYPES } from "./searchCriteria.js";

export const propertyListingSchema = z
  .object({
    /** Uniek binnen de bron. Samen met `source` de primaire dedup-sleutel. */
    externalId: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).max(50),

    url: z.string().url().max(2000),

    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(20_000).optional(),

    address: z.string().trim().max(300).optional(),
    postalCode: z.string().regex(/^\d{4}$/).optional(),
    city: z.string().trim().max(120).optional(),
    region: z.string().trim().max(120).optional(),

    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),

    propertyType: z.enum(PROPERTY_TYPES).optional(),
    transactionType: z.enum(TRANSACTION_TYPES).default("buy"),

    /** Hele euro's. Zie de schema-notitie in prisma/schema.prisma. */
    price: z.number().int().nonnegative().max(50_000_000).optional(),

    bedrooms: z.number().int().min(0).max(50).optional(),
    bathrooms: z.number().int().min(0).max(20).optional(),

    livingAreaM2: z.number().int().positive().max(10_000).optional(),
    landAreaM2: z.number().int().positive().max(1_000_000).optional(),

    epcLabel: z.enum(EPC_LABELS).optional(),
    epcValue: z.number().int().min(0).max(2000).optional(),

    /** Vrije strings toegestaan: bronnen kennen features die wij nog niet
     *  genormaliseerd hebben. De matching engine kijkt alleen naar de bekende. */
    features: z.array(z.string().trim().min(1).max(60)).max(50).default([]),

    imageUrl: z.string().url().max(2000).optional(),

    publishedAt: z.coerce.date().optional(),
    discoveredAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type PropertyListing = z.infer<typeof propertyListingSchema>;
