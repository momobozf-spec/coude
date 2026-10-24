import { z } from 'zod';

/** De talen die de app volledig ondersteunt. Vlaams is de standaard. */
export const localeSchema = z.enum(['nl', 'fr']);
export type Locale = z.infer<typeof localeSchema>;

/**
 * Wachtwoordeisen. Bewust een lengte-ondergrens en géén verplichte
 * speciale tekens: NIST SP 800-63B raadt samenstellingsregels af omdat ze
 * voorspelbare wachtwoorden opleveren ("Wachtwoord1!").
 */
export const passwordSchema = z
  .string()
  .min(12, 'Wachtwoord moet minstens 12 tekens lang zijn')
  .max(128, 'Wachtwoord mag hoogstens 128 tekens lang zijn');

/** Belgisch of internationaal telefoonnummer in E.164-formaat. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Telefoonnummer moet in E.164-formaat staan, bv. +32470123456');

export const registerSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres').max(254).toLowerCase().trim(),
  password: passwordSchema,
  fullName: z.string().min(2).max(120).trim(),
  phone: phoneSchema.optional(),
  locale: localeSchema.default('nl'),
  /**
   * Registratie vereist expliciete toestemming voor toegangslogging en
   * camerabewaking. Zonder beide kan de klant de winkel niet binnen, dus
   * vragen we het hier — niet pas voor een dichte deur.
   */
  acceptsAccessLogging: z.literal(true, {
    error: 'Toestemming voor het loggen van winkelbezoeken is verplicht',
  }),
  acceptsCameraSurveillance: z.literal(true, {
    error: 'Toestemming voor camerabewaking is verplicht',
  }),
  /** Marketing is optioneel en mag nooit een voorwaarde voor toegang zijn (AVG art. 7.4). */
  acceptsMarketing: z.boolean().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Registratie voor de supermarktvergelijker (Superette).
 *
 * Dezelfde `User`-tabel en dezelfde sessie als de boetiek, maar zónder de
 * toegangslog- en cameratoestemmingen: een Superette-gebruiker betreedt geen
 * onbemande winkel. Wil hij dat later wel, dan vraagt de boetiek-app die
 * toestemmingen alsnog (`GateService.assertEligible` controleert ze bij elke
 * deuropening).
 */
export const registerSuperetteSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres').max(254).toLowerCase().trim(),
  password: passwordSchema,
  fullName: z.string().min(2).max(120).trim(),
  locale: localeSchema.default('nl'),
  /** Gebruiksvoorwaarden en privacybeleid; zonder akkoord geen account. */
  acceptsTerms: z.literal(true, {
    error: 'Je moet de gebruiksvoorwaarden en het privacybeleid aanvaarden',
  }),
  /** Nieuwsbrief en tips. Optioneel en nooit een voorwaarde. */
  acceptsMarketing: z.boolean().default(false),
});
export type RegisterSuperetteInput = z.infer<typeof registerSuperetteSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  locale: localeSchema,
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']),
  /**
   * Of de identiteit sterk geverifieerd is. Met enkel e-mail+wachtwoord is dit
   * altijd `false`. Zodra itsme aangesloten wordt, wordt dit `true` en kan de
   * gate-service er strenger op sturen (zie GateService.assertEligible).
   */
  identityVerified: z.boolean(),
  ageVerified: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string().datetime(),
  user: sessionUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * Cookie-authenticatie voor de Superette-app.
 *
 * Een client die deze header meestuurt krijgt zijn tokens in HttpOnly-cookies
 * en nooit in de JSON. De header is tegelijk de CSRF-bescherming: een
 * cross-site formulier kan hem niet zetten, en een cross-origin `fetch` komt
 * zonder CORS-toestemming niet voorbij de preflight.
 */
export const AUTH_CLIENT_HEADER = 'x-superette-client';
export const AUTH_CLIENTS = ['web'] as const;
export type AuthClient = (typeof AUTH_CLIENTS)[number];

/** Antwoord voor cookie-clients: geen token in de body. */
export const webSessionResponseSchema = z.object({
  user: sessionUserSchema,
  /** Verloopmoment van het access-token (kort). De app ververst vóór dit moment. */
  expiresAt: z.string().datetime(),
  /** Verloopmoment van de sessie zelf (refresh-token). */
  sessionExpiresAt: z.string().datetime(),
});
export type WebSessionResponse = z.infer<typeof webSessionResponseSchema>;

/** Accountverwijdering: herauthenticatie met wachtwoord en een bewuste bevestiging. */
export const DELETE_ACCOUNT_CONFIRMATION = 'VERWIJDER MIJN ACCOUNT';
export const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION, {
    error: `Typ exact "${DELETE_ACCOUNT_CONFIRMATION}" om te bevestigen`,
  }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** Wat de gebruiker bij een gegevensexport krijgt. Alles wat aan zijn account hangt. */
export const accountExportSchema = z.object({
  exportedAt: z.string().datetime(),
  profile: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    phone: z.string().nullable(),
    locale: z.string(),
    createdAt: z.string().datetime(),
  }),
  consents: z.array(z.object({ type: z.string(), granted: z.boolean(), policyVersion: z.string(), recordedAt: z.string().datetime() })),
  preferences: z.unknown().nullable(),
  shoppingLists: z.array(z.unknown()),
  priceAlerts: z.array(z.unknown()),
  notifications: z.array(z.unknown()),
  receipts: z.array(z.unknown()),
  sessions: z.array(z.object({ client: z.string(), createdAt: z.string().datetime(), lastUsedAt: z.string().datetime(), userAgent: z.string().nullable(), current: z.boolean() })),
});
export type AccountExport = z.infer<typeof accountExportSchema>;
