/**
 * Formaat van een importbestand (JSON of CSV) per keten.
 *
 * Dit is de manier om zonder live databron toch echte prijzen in te laden:
 * een handmatig beheerd bestand in `COMPARE_FEED_DIR`, bv. `delhaize.json`.
 * De structuur spiegelt `AdapterSnapshot`, met ISO-datums als tekst.
 *
 * Validatie gebeurt met Zod vóór er iets de database in gaat. Een feed is
 * externe invoer en wordt als onbetrouwbaar behandeld.
 */
import { z } from 'zod';
import {
  availabilitySchema,
  brandTypeSchema,
  dataSourceKindSchema,
  offerChannelSchema,
  packageUnitSchema,
  promotionRuleSchema,
  promotionTypeSchema,
} from '@superette/contracts';

const isoDate = z.string().datetime({ offset: true });
const nonEmpty = z.string().trim().min(1);
const optionalText = z.string().trim().max(2000).nullable().optional();

export const feedLocationSchema = z.object({
  externalId: nonEmpty.max(64),
  name: nonEmpty.max(120),
  address: nonEmpty.max(200),
  postalCode: z.string().regex(/^[1-9]\d{3}$/, 'Belgische postcode van vier cijfers'),
  city: nonEmpty.max(80),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  serviceArea: optionalText,
  active: z.boolean().optional(),
});

export const feedProductSchema = z.object({
  externalId: nonEmpty.max(64),
  name: nonEmpty.max(200),
  brand: z.string().trim().max(80).nullable().optional(),
  brandType: brandTypeSchema.optional(),
  barcode: z
    .string()
    .regex(/^\d{8}$|^\d{13}$/, 'Barcode moet 8 of 13 cijfers bevatten')
    .nullable()
    .optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  productUrl: z.string().url().max(500).nullable().optional(),
  description: optionalText,
  categoryPath: z.string().trim().max(200).nullable().optional(),
  categorySlug: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable().optional(),
  packageQuantity: z.number().positive().nullable().optional(),
  packageUnit: packageUnitSchema.nullable().optional(),
  packCount: z.number().int().positive().max(1000).optional(),
  active: z.boolean().optional(),
});

export const feedOfferSchema = z.object({
  productExternalId: nonEmpty.max(64),
  locationExternalId: z.string().trim().max(64).nullable().optional(),
  sourceReference: nonEmpty.max(120),
  priceCents: z.number().int().nonnegative(),
  originalPriceCents: z.number().int().nonnegative().nullable().optional(),
  promotionType: promotionTypeSchema.optional(),
  promotionText: z.string().trim().max(200).nullable().optional(),
  promotionRule: promotionRuleSchema.nullable().optional(),
  conditions: optionalText,
  requiresLoyaltyCard: z.boolean().optional(),
  isPersonalized: z.boolean().optional(),
  channel: offerChannelSchema.optional(),
  minimumQuantity: z.number().int().positive().max(1000).optional(),
  depositCents: z.number().int().nonnegative().nullable().optional(),
  availability: availabilitySchema.optional(),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  observedAt: isoDate.optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const feedFileSchema = z.object({
  /** Formaatversie. Bij een breaking change hogen we dit op. */
  version: z.literal(1),
  chain: z.object({
    slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
    name: nonEmpty.max(80),
    logoUrl: z.string().url().nullable().optional(),
    websiteUrl: z.string().url().nullable().optional(),
    loyaltyCardName: z.string().trim().max(60).nullable().optional(),
  }),
  source: z.object({
    /**
     * `DEMO` is toegestaan voor stagingbestanden (`scripts/make-staging-feeds.ts`):
     * zulke prijzen dragen dan overal het DEMO-label, ook via het
     * productiecodepad. Een bestand kan zich nooit als échte bron voordoen
     * zonder `termsReviewed`; andersom (echte data als DEMO labelen) is onschadelijk.
     */
    kind: dataSourceKindSchema.default('IMPORT_FILE'),
    label: nonEmpty.max(120),
    /** Verklaring dat de voorwaarden van de oorspronkelijke bron zijn nagekeken. */
    termsReviewed: z.boolean(),
    notes: z.string().trim().max(1000).optional(),
  }),
  observedAt: isoDate,
  locations: z.array(feedLocationSchema).max(5000).default([]),
  products: z.array(feedProductSchema).max(100_000),
  offers: z.array(feedOfferSchema).max(500_000),
});

export type FeedFile = z.infer<typeof feedFileSchema>;
export type FeedProduct = z.infer<typeof feedProductSchema>;
export type FeedOffer = z.infer<typeof feedOfferSchema>;
