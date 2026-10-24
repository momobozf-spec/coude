import { z } from 'zod';
import { belgianPostalCodeSchema } from './store-chain';

/**
 * Winkelvoorkeuren van een gebruiker. Worden in het profiel bewaard en
 * standaard toegepast op zoeken, vergelijken en prijsalerts.
 */
export const comparePreferencesSchema = z.object({
  /** Ketens die meedoen in vergelijkingen. Leeg = alle actieve ketens. */
  enabledChainSlugs: z.array(z.string()).max(20),
  favoriteChainSlugs: z.array(z.string()).max(20),
  /** Ketens waarvan de gebruiker een klantenkaart heeft. */
  loyaltyCardChainSlugs: z.array(z.string()).max(20),
  favoriteLocationIds: z.array(z.string()).max(20),
  postalCode: belgianPostalCodeSchema.nullable(),
  municipality: z.string().trim().max(80).nullable(),
  maxDistanceKm: z.number().int().min(1).max(200).nullable(),
  preferStoreBrands: z.boolean(),
  preferNationalBrands: z.boolean(),
  allowAlternatives: z.boolean(),
  includePersonalizedOffers: z.boolean(),
  includeOnlineOffers: z.boolean(),
  /** Prijsalerts ook per e-mail ontvangen. Opt-in; uitzetten is de "unsubscribe". */
  emailNotifications: z.boolean(),
});
export type ComparePreferences = z.infer<typeof comparePreferencesSchema>;

export const DEFAULT_COMPARE_PREFERENCES: ComparePreferences = Object.freeze({
  enabledChainSlugs: [],
  favoriteChainSlugs: [],
  loyaltyCardChainSlugs: [],
  favoriteLocationIds: [],
  postalCode: null,
  municipality: null,
  maxDistanceKm: null,
  preferStoreBrands: false,
  preferNationalBrands: false,
  allowAlternatives: true,
  includePersonalizedOffers: false,
  includeOnlineOffers: true,
  emailNotifications: false,
});

export const updateComparePreferencesSchema = comparePreferencesSchema
  .partial()
  .refine((v) => !(v.preferStoreBrands && v.preferNationalBrands), {
    message: 'Kies huismerk óf A-merk als voorkeur, niet allebei',
  });
export type UpdateComparePreferencesInput = z.infer<typeof updateComparePreferencesSchema>;
