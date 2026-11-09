import { z } from 'zod';

/**
 * De verwerkingsdoeleinden waarvoor we afzonderlijke toestemming vragen.
 * AVG art. 7.2: toestemming per doel, niet één vinkje voor alles.
 */
export const consentTypeSchema = z.enum([
  /** Loggen van wie wanneer welke winkel binnenkwam. Noodzakelijk voor toegang. */
  'ACCESS_LOG',
  /** Camerabeelden gekoppeld aan het toegangstijdstip. Noodzakelijk voor toegang. */
  'CAMERA',
  /** Nieuwsbrief en aanbiedingen. Nooit een voorwaarde voor toegang (art. 7.4). */
  'MARKETING',
]);
export type ConsentType = z.infer<typeof consentTypeSchema>;

/**
 * Zonder deze twee gaat de deur niet open. Dat is geen ontwerpkeuze maar een
 * gevolg: we kunnen een onbemande winkel niet exploiteren zonder te weten wie
 * er binnen was, en zonder camerabeelden bij schade.
 */
export const REQUIRED_CONSENTS = ['ACCESS_LOG', 'CAMERA'] as const satisfies readonly ConsentType[];

export const grantConsentSchema = z.object({
  type: consentTypeSchema,
  granted: z.boolean(),
});
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;

export const consentStateSchema = z.object({
  type: consentTypeSchema,
  granted: z.boolean(),
  /** ISO-8601. Wanneer deze stand werd vastgelegd. */
  since: z.string().datetime(),
  /** Welke versie van het privacybeleid gold op dat moment. */
  policyVersion: z.string(),
});
export type ConsentState = z.infer<typeof consentStateSchema>;
