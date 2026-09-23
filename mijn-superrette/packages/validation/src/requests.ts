import { z } from 'zod';
import { DIETARY_ATTRIBUTES, LIST_MEMBER_ROLES, LOCALES } from '@superrette/domain';

/** Request schemas shared by the API (validation) and clients (forms). */

const uuid = z.uuid();
const cents = z.number().int().min(0).max(1_000_000);

export const registerSchema = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(60),
  locale: z.enum(LOCALES).default('nl'),
  countryCode: z.enum(['BE', 'NL']).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(500) });

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    locale: z.enum(LOCALES),
    countryCode: z.enum(['BE', 'NL']),
    onboardingCompleted: z.boolean(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const retailerPreferencesSchema = z.object({
  retailers: z
    .array(z.object({ retailerId: uuid, hasLoyaltyCard: z.boolean().default(false) }))
    .min(1)
    .max(30),
});
export type RetailerPreferencesInput = z.infer<typeof retailerPreferencesSchema>;

export const SEARCH_SORTS = ['relevance', 'lowest_price', 'lowest_unit_price', 'highest_discount'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean));

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  retailers: csv.pipe(z.array(uuid)).optional(),
  brands: csv.optional(),
  categories: csv.optional(),
  dietary: csv.pipe(z.array(z.enum(DIETARY_ATTRIBUTES))).optional(),
  promotionOnly: z.stringbool().optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  minSize: z.coerce.number().min(0).optional(),
  maxSize: z.coerce.number().min(0).optional(),
  sort: z.enum(SEARCH_SORTS).default('relevance'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const autocompleteQuerySchema = z.object({ q: z.string().trim().min(1).max(60) });

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['weekly', 'thisWeek', 'weekend', 'ramadan', 'family', 'custom']).default('custom'),
  icon: z.string().max(20).optional(),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = createListSchema.partial();

export const createListItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99).default(1),
  preferredVariantId: uuid.nullish(),
  preferredBrand: z.string().trim().max(60).nullish(),
  notes: z.string().trim().max(300).nullish(),
  categorySlug: z.string().max(60).nullish(),
});
export type CreateListItemInput = z.infer<typeof createListItemSchema>;

/** Updates carry the version the client last saw (optimistic concurrency). */
export const updateListItemSchema = createListItemSchema
  .partial()
  .extend({ checked: z.boolean().optional(), position: z.number().int().min(0).optional(), version: z.number().int().min(1) });
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>;

export const itemSelectionSchema = z.object({ retailerId: uuid, retailerProductId: uuid.nullable() });
export type ItemSelectionInput = z.infer<typeof itemSelectionSchema>;

export const compareListSchema = z.object({
  retailerIds: z.array(uuid).max(20).optional(),
});

export const smartBasketSchema = z.object({
  maxStores: z.number().int().min(1).max(3).default(2),
  retailerIds: z.array(uuid).max(20).optional(),
  extraStoreCostCents: cents.optional(),
  minSavingsCents: cents.optional(),
});
export type SmartBasketInput = z.infer<typeof smartBasketSchema>;

export const createAlertSchema = z
  .object({
    variantId: uuid,
    retailerId: uuid.nullish(),
    targetPriceCents: cents.nullish(),
    promotionOnly: z.boolean().default(false),
  })
  .refine((v) => v.targetPriceCents != null || v.promotionOnly, {
    message: 'Set a target price or promotionOnly',
    path: ['targetPriceCents'],
  });
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z.object({
  enabled: z.boolean().optional(),
  targetPriceCents: cents.nullish(),
  promotionOnly: z.boolean().optional(),
  retailerId: uuid.nullish(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
});

export const createInviteSchema = z.object({ role: z.enum(LIST_MEMBER_ROLES).exclude(['OWNER']).default('EDITOR') });

export const PROMOTION_SORTS = ['largest_discount', 'lowest_price', 'ending_soon', 'recent'] as const;
export const PROMOTION_SECTIONS = ['for_you', 'favorites', 'retailer', 'category', 'ending_soon', 'all'] as const;
export const promotionsQuerySchema = z.object({
  section: z.enum(PROMOTION_SECTIONS).default('all'),
  retailerId: uuid.optional(),
  category: z.string().max(60).optional(),
  sort: z.enum(PROMOTION_SORTS).default('largest_discount'),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;

export const historyQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(365).default(90) });

// ─── Admin ──────────────────────────────────────────────────────────────────

export const matchDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('reject') }),
  z.object({ decision: z.literal('reassign'), variantId: uuid }),
]);
export type MatchDecision = z.infer<typeof matchDecisionSchema>;

export const equivalenceDecisionSchema = z.object({ decision: z.enum(['confirm', 'reject']) });

export const triggerSyncSchema = z.object({ kind: z.enum(['CATALOG', 'PRICES', 'PROMOTIONS', 'FULL']).default('FULL') });

export const adminListQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
