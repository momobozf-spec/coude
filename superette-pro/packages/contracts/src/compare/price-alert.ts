import { z } from 'zod';
import { catalogProductSummarySchema, productOfferSchema } from './product';
import { storeChainRefSchema } from './store-chain';

/**
 * Waarop de alert vergelijkt.
 *
 *   PACKAGE_PRICE       — prijs per verpakking ≤ doelprijs
 *   UNIT_PRICE          — prijs per kg / l / stuk ≤ doelprijs
 *   DISCOUNT_PERCENTAGE — kortingspercentage ≥ minimum
 */
export const ALERT_COMPARISON_TYPES = ['PACKAGE_PRICE', 'UNIT_PRICE', 'DISCOUNT_PERCENTAGE'] as const;
export const alertComparisonTypeSchema = z.enum(ALERT_COMPARISON_TYPES);
export type AlertComparisonType = z.infer<typeof alertComparisonTypeSchema>;

/** Welke productmatches de alert mag laten afgaan. Elk niveau omvat het vorige. */
export const ALERT_MATCH_PREFERENCES = ['EXACT', 'EQUIVALENT', 'ALTERNATIVE'] as const;
export const alertMatchPreferenceSchema = z.enum(ALERT_MATCH_PREFERENCES);
export type AlertMatchPreference = z.infer<typeof alertMatchPreferenceSchema>;

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL'] as const;
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const PRICE_ALERT_STATUSES = ['ACTIVE', 'PAUSED'] as const;
export const priceAlertStatusSchema = z.enum(PRICE_ALERT_STATUSES);
export type PriceAlertStatus = z.infer<typeof priceAlertStatusSchema>;

/** Afgeleide toestand voor het overzichtsscherm. */
export const ALERT_DERIVED_STATES = ['ACTIVE', 'REACHED', 'ALMOST', 'PAUSED', 'UNAVAILABLE'] as const;
export const alertDerivedStateSchema = z.enum(ALERT_DERIVED_STATES);
export type AlertDerivedState = z.infer<typeof alertDerivedStateSchema>;

const alertTargetFields = {
  catalogProductId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  comparisonType: alertComparisonTypeSchema,
  matchPreference: alertMatchPreferenceSchema.default('EXACT'),
  /** Ketens waarvoor de alert geldt. Leeg = alle ketens uit de voorkeuren van de gebruiker. */
  chainSlugs: z.array(z.string()).max(20).default([]),
  targetPriceCents: z.number().int().positive('Doelprijs moet groter zijn dan nul').optional(),
  minimumDiscountPercentage: z.number().int().min(1).max(99).optional(),
  notificationChannel: notificationChannelSchema.default('IN_APP'),
  includeLoyaltyOffers: z.boolean().default(true),
  includePersonalizedOffers: z.boolean().default(false),
  includeOnlineOffers: z.boolean().default(true),
};

function validateAlertTarget(
  v: {
    catalogProductId?: string | undefined;
    categoryId?: string | undefined;
    comparisonType?: AlertComparisonType | undefined;
    targetPriceCents?: number | undefined;
    minimumDiscountPercentage?: number | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (!!v.catalogProductId === !!v.categoryId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catalogProductId'], message: 'Kies een product óf een categorie' });
  }
  if (v.comparisonType === 'DISCOUNT_PERCENTAGE') {
    if (v.minimumDiscountPercentage === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimumDiscountPercentage'],
        message: 'Geef een minimaal kortingspercentage op',
      });
    }
  } else if (v.comparisonType !== undefined && v.targetPriceCents === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetPriceCents'], message: 'Geef een doelprijs op' });
  }
}

export const createPriceAlertSchema = z.object(alertTargetFields).superRefine(validateAlertTarget);
export type CreatePriceAlertInput = z.infer<typeof createPriceAlertSchema>;

export const updatePriceAlertSchema = z
  .object({
    matchPreference: alertMatchPreferenceSchema.optional(),
    chainSlugs: z.array(z.string()).max(20).optional(),
    comparisonType: alertComparisonTypeSchema.optional(),
    targetPriceCents: z.number().int().positive('Doelprijs moet groter zijn dan nul').optional(),
    minimumDiscountPercentage: z.number().int().min(1).max(99).optional(),
    notificationChannel: notificationChannelSchema.optional(),
    status: priceAlertStatusSchema.optional(),
    includeLoyaltyOffers: z.boolean().optional(),
    includePersonalizedOffers: z.boolean().optional(),
    includeOnlineOffers: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), { message: 'Niets om bij te werken' });
export type UpdatePriceAlertInput = z.infer<typeof updatePriceAlertSchema>;

/** Wat de app toont vóór het opslaan: huidige stand + menselijke bevestiging. */
export const alertPreviewSchema = z.object({
  product: catalogProductSummarySchema.nullable(),
  categoryName: z.string().nullable(),
  chains: z.array(storeChainRefSchema),
  comparisonType: alertComparisonTypeSchema,
  targetPriceCents: z.number().int().nullable(),
  minimumDiscountPercentage: z.number().int().nullable(),
  currentLowest: z
    .object({
      offer: productOfferSchema,
      /** De waarde waarmee vergeleken wordt: verpakkingsprijs, eenheidsprijs of korting-%. */
      comparedValue: z.number().int(),
    })
    .nullable(),
  /** Doel − huidige laagste. Negatief = het doel is nu al gehaald. */
  differenceCents: z.number().int().nullable(),
  differencePercentage: z.number().int().nullable(),
  /** "We laten je weten wanneer Coca-Cola Zero 1,5 L bij Delhaize, Lidl … €1,79 of minder kost." */
  sentence: z.string(),
  /** Bestaat er al een alert met dezelfde kenmerken? Dan bieden we bijwerken aan. */
  duplicateOfAlertId: z.string().nullable(),
  comparable: z.boolean(),
  notComparableReason: z.string().nullable(),
});
export type AlertPreview = z.infer<typeof alertPreviewSchema>;

export const priceAlertSchema = z.object({
  id: z.string(),
  product: catalogProductSummarySchema.nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  comparisonType: alertComparisonTypeSchema,
  matchPreference: alertMatchPreferenceSchema,
  chains: z.array(storeChainRefSchema),
  targetPriceCents: z.number().int().nullable(),
  minimumDiscountPercentage: z.number().int().nullable(),
  notificationChannel: notificationChannelSchema,
  status: priceAlertStatusSchema,
  derivedState: alertDerivedStateSchema,
  includeLoyaltyOffers: z.boolean(),
  includePersonalizedOffers: z.boolean(),
  includeOnlineOffers: z.boolean(),
  currentLowest: z
    .object({
      offer: productOfferSchema,
      comparedValue: z.number().int(),
    })
    .nullable(),
  differenceCents: z.number().int().nullable(),
  differencePercentage: z.number().int().nullable(),
  lastCheckedAt: z.string().datetime().nullable(),
  lastTriggeredAt: z.string().datetime().nullable(),
  lastTriggeredPriceCents: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PriceAlert = z.infer<typeof priceAlertSchema>;

export const ALERT_SORTS = ['BIGGEST_DROP', 'CLOSEST', 'NEWEST', 'LAST_CHECKED', 'ALPHABETICAL'] as const;
export const alertSortSchema = z.enum(ALERT_SORTS);

export const alertListQuerySchema = z.object({
  state: alertDerivedStateSchema.optional(),
  chain: z.string().optional(),
  category: z.string().optional(),
  comparisonType: alertComparisonTypeSchema.optional(),
  sort: alertSortSchema.default('CLOSEST'),
});
export type AlertListQuery = z.infer<typeof alertListQuerySchema>;

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export const notificationStatusSchema = z.enum(NOTIFICATION_STATUSES);

export const alertNotificationSchema = z.object({
  id: z.string(),
  priceAlertId: z.string(),
  channel: notificationChannelSchema,
  status: notificationStatusSchema,
  productName: z.string(),
  storeChain: storeChainRefSchema.nullable(),
  storeLocationName: z.string().nullable(),
  triggeredPriceCents: z.number().int(),
  previousPriceCents: z.number().int().nullable(),
  targetPriceCents: z.number().int().nullable(),
  savingsCents: z.number().int().nullable(),
  unitPriceCents: z.number().int().nullable(),
  conditions: z.string().nullable(),
  validUntil: z.string().datetime().nullable(),
  /** Pad in de app, bv. "/producten/abc". */
  link: z.string(),
  cheaperAlternative: productOfferSchema.nullable(),
  message: z.string(),
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AlertNotification = z.infer<typeof alertNotificationSchema>;
