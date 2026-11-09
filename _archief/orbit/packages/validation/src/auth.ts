import { z } from 'zod';
import { authProviderSchema, platformSchema, themePreferenceSchema } from './enums';
import {
  LIMITS,
  emailSchema,
  isoTimeSchema,
  localeSchema,
  passwordSchema,
  timeZoneSchema,
  ulidSchema,
} from './primitives';

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  timeZone: timeZoneSchema.default('Europe/Brussels'),
  locale: localeSchema.default('nl'),
  /** Alleen voor het aanmaken van het eerste device-record. */
  deviceName: z.string().max(120).optional(),
  platform: platformSchema.default('WEB'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(LIMITS.passwordMax),
  deviceName: z.string().max(120).optional(),
  platform: platformSchema.default('WEB'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(500).optional(),
  /** Alle sessies van deze gebruiker intrekken. */
  allDevices: z.boolean().default(false),
});

/**
 * OAuth loopt via de authorization-code flow met PKCE. De client stuurt de code
 * plus verifier; de server wisselt hem in bij de provider en maakt een sessie.
 */
export const oauthCallbackSchema = z.object({
  provider: authProviderSchema,
  code: z.string().min(1).max(2048),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url().max(LIMITS.urlMax),
  platform: platformSchema.default('WEB'),
  deviceName: z.string().max(120).optional(),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(20).max(500),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(LIMITS.passwordMax),
  newPassword: passwordSchema,
});

export const userPreferencesSchema = z.object({
  theme: themePreferenceSchema,
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  defaultReminderTime: isoTimeSchema,
  showCompleted: z.boolean(),
  defaultReminderOffsetMinutes: z.number().int().min(0).max(60 * 24 * 30).nullable(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax).optional(),
  avatarUrl: z.string().url().max(LIMITS.urlMax).nullish(),
  timeZone: timeZoneSchema.optional(),
  locale: localeSchema.optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

export const registerDeviceSchema = z.object({
  id: ulidSchema.optional(),
  platform: platformSchema,
  name: z.string().max(120),
  pushToken: z.string().max(500).nullish(),
});
