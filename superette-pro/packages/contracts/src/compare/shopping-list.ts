import { z } from 'zod';
import { matchTypeSchema } from './enums';
import { catalogProductSummarySchema, coverageSchema, productOfferSchema } from './product';
import { storeChainRefSchema } from './store-chain';

/** Wat de gebruiker per lijstregel mag eisen of toestaan. */
export const listItemConstraintsSchema = z.object({
  /** Alleen dit merk; geen huismerk, geen alternatief. */
  exactBrandRequired: z.boolean().default(false),
  allowStoreBrand: z.boolean().default(true),
  allowAlternatives: z.boolean().default(true),
  /** Boven dit bedrag per verpakking wordt het product als "niet beschikbaar" gerekend. */
  maxPriceCents: z.number().int().positive().nullable().optional(),
  /** Favoriete keten voor dit product; weegt mee in de gebalanceerde modus. */
  preferredChainSlug: z.string().nullable().optional(),
  /** Gewenste verpakking in vrije tekst, bv. "1,5 l" — informatief. */
  desiredPackageLabel: z.string().max(40).nullable().optional(),
});
export type ListItemConstraints = z.infer<typeof listItemConstraintsSchema>;

export const createShoppingListSchema = z.object({
  name: z.string().trim().min(1, 'Geef je lijst een naam').max(80),
});
export type CreateShoppingListInput = z.infer<typeof createShoppingListSchema>;

export const updateShoppingListSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.archived !== undefined, { message: 'Niets om bij te werken' });
export type UpdateShoppingListInput = z.infer<typeof updateShoppingListSchema>;

export const addShoppingListItemSchema = listItemConstraintsSchema
  .extend({
    catalogProductId: z.string().min(1).optional(),
    /** Vrije regel zonder gekoppeld product, bv. "verjaardagskaars". */
    freeText: z.string().trim().min(1).max(120).optional(),
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .refine((v) => (v.catalogProductId ? !v.freeText : !!v.freeText), {
    message: 'Geef óf een product óf een vrije tekstregel op',
  });
export type AddShoppingListItemInput = z.infer<typeof addShoppingListItemSchema>;

export const updateShoppingListItemSchema = listItemConstraintsSchema.partial().extend({
  quantity: z.number().int().min(1).max(99).optional(),
  checked: z.boolean().optional(),
  freeText: z.string().trim().min(1).max(120).optional(),
  catalogProductId: z.string().min(1).nullable().optional(),
});
export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;

export const shoppingListItemSchema = listItemConstraintsSchema.extend({
  id: z.string(),
  catalogProductId: z.string().nullable(),
  product: catalogProductSummarySchema.nullable(),
  freeText: z.string().nullable(),
  quantity: z.number().int().positive(),
  checked: z.boolean(),
  sortOrder: z.number().int(),
});
export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;

export const shoppingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean(),
  items: z.array(shoppingListItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export const shoppingListSummarySchema = shoppingListSchema.omit({ items: true }).extend({
  itemCount: z.number().int().nonnegative(),
  checkedCount: z.number().int().nonnegative(),
});
export type ShoppingListSummary = z.infer<typeof shoppingListSummarySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Mandje vergelijken
// ─────────────────────────────────────────────────────────────────────────────

export const COMPARE_MODES = ['SINGLE_STORE', 'CHEAPEST_COMBINATION', 'BALANCED'] as const;
export const compareModeSchema = z.enum(COMPARE_MODES);
export type CompareMode = z.infer<typeof compareModeSchema>;

export const basketCompareInputSchema = z.object({
  mode: compareModeSchema.default('BALANCED'),
  /** Ketens om in de vergelijking op te nemen. Leeg = de voorkeuren van de gebruiker, of alle ketens. */
  chainSlugs: z.array(z.string()).max(20).default([]),
  /** Maximaal aantal winkels in de gebalanceerde modus. */
  maxStores: z.number().int().min(1).max(3).default(2),
  /** Een extra winkelbezoek moet minstens dit bedrag opleveren. Standaard €3. */
  minimumSavingCents: z.number().int().nonnegative().max(100_000).default(300),
  maxDistanceKm: z.number().int().min(1).max(200).nullable().default(null),
  includePersonalizedOffers: z.boolean().default(false),
  includeOnlineOffers: z.boolean().default(true),
  /** Reken klantenkaartprijzen mee voor ketens waar de gebruiker een kaart van heeft. */
  useLoyaltyCards: z.boolean().default(true),
});
export type BasketCompareInput = z.infer<typeof basketCompareInputSchema>;

export const BASKET_LINE_STATUSES = ['FOUND', 'ALTERNATIVE', 'MISSING', 'FREE_TEXT', 'OVER_BUDGET'] as const;
export const basketLineStatusSchema = z.enum(BASKET_LINE_STATUSES);
export type BasketLineStatus = z.infer<typeof basketLineStatusSchema>;

export const basketLineResultSchema = z.object({
  itemId: z.string(),
  label: z.string(),
  quantity: z.number().int().positive(),
  status: basketLineStatusSchema,
  chosenOffer: productOfferSchema.nullable(),
  chosenProduct: catalogProductSummarySchema.nullable(),
  matchType: matchTypeSchema.nullable(),
  /** Wat deze regel kost bij deze winkel, voor `quantity`, met promotie waar de voorwaarde gehaald is. */
  lineTotalCents: z.number().int().nonnegative().nullable(),
  regularTotalCents: z.number().int().nonnegative().nullable(),
  savingsCents: z.number().int().nonnegative(),
  requiresLoyaltyCard: z.boolean(),
  /** Waarom deze keuze: "goedkoopste exacte match", "huismerkalternatief toegestaan", … */
  reason: z.string(),
});
export type BasketLineResult = z.infer<typeof basketLineResultSchema>;

export const storeBasketResultSchema = z.object({
  storeChain: storeChainRefSchema,
  totalCents: z.number().int().nonnegative(),
  regularTotalCents: z.number().int().nonnegative(),
  savingsCents: z.number().int().nonnegative(),
  availableCount: z.number().int().nonnegative(),
  alternativeCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
  /** Alle regels gevonden (exact of toegestaan alternatief)? */
  complete: z.boolean(),
  requiresLoyaltyCard: z.boolean(),
  loyaltyCardName: z.string().nullable(),
  conditions: z.array(z.string()),
  lines: z.array(basketLineResultSchema),
  hasData: z.boolean(),
  containsDemoData: z.boolean(),
});
export type StoreBasketResult = z.infer<typeof storeBasketResultSchema>;

export const combinationResultSchema = z.object({
  stores: z.array(
    z.object({
      storeChain: storeChainRefSchema,
      subtotalCents: z.number().int().nonnegative(),
      lines: z.array(basketLineResultSchema),
    }),
  ),
  totalCents: z.number().int().nonnegative(),
  storeVisits: z.number().int().nonnegative(),
  missing: z.array(basketLineResultSchema),
  /** Besparing tegenover de beste één-winkeloptie. Negatief kan niet: dan is één winkel beter. */
  savingsVsBestSingleStoreCents: z.number().int(),
  explanation: z.array(z.string()),
});
export type CombinationResult = z.infer<typeof combinationResultSchema>;

export const basketCompareResultSchema = z.object({
  listId: z.string(),
  mode: compareModeSchema,
  settings: basketCompareInputSchema,
  perStore: z.array(storeBasketResultSchema),
  bestSingleStore: storeBasketResultSchema.nullable(),
  cheapestCombination: combinationResultSchema.nullable(),
  balanced: combinationResultSchema.nullable(),
  /** Het resultaat dat bij `mode` hoort, als tekstuele samenvatting. */
  summary: z.string(),
  coverage: coverageSchema,
  containsDemoData: z.boolean(),
  /** Regels zonder gekoppeld product; die rekenen we nergens mee. */
  freeTextLines: z.array(z.string()),
});
export type BasketCompareResult = z.infer<typeof basketCompareResultSchema>;
