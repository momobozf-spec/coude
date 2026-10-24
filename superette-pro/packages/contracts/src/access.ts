import { z } from 'zod';

/**
 * De payload die letterlijk in de QR-code op het scherm van de klant staat,
 * als compacte JWS (EdDSA / Ed25519).
 *
 * Bevat GEEN persoonsgegevens: geen naam, geen e-mail, geen telefoonnummer.
 * Wie de QR fotografeert leert alleen een opaque user-id en een winkel-id —
 * en heeft daar niets aan, want de nonce is eenmalig en verloopt binnen 60s.
 */
export const gateTokenClaimsSchema = z.object({
  /** Token-id (`AccessToken.id`) — de sleutel voor de single-use check. */
  jti: z.string(),
  /** Opaque user-id. */
  sub: z.string(),
  /** Winkel waarvoor deze sleutel geldt. Een QR voor Antwerpen opent Gent niet. */
  sid: z.string(),
  /** Eenmalige waarde. Hergebruik = replay-poging. */
  nonce: z.string(),
  /** Rotatievolgnummer. Monotoon per gebruiker+winkel. */
  seq: z.number().int().nonnegative(),
  /** Uitgiftetijdstip (Unix-seconden). */
  iat: z.number().int(),
  /** Vervaltijdstip (Unix-seconden). */
  exp: z.number().int(),
});
export type GateTokenClaims = z.infer<typeof gateTokenClaimsSchema>;

export const issueAccessTokenSchema = z.object({
  storeId: z.string().min(1),
});
export type IssueAccessTokenInput = z.infer<typeof issueAccessTokenSchema>;

export const accessTokenResponseSchema = z.object({
  /** De compacte JWS. Dit — en niets anders — codeer je in de QR. */
  qrPayload: z.string(),
  /** ISO-8601. De app toont een aftelbalk en ververst hier vóór. */
  expiresAt: z.string().datetime(),
  /** Seconden tot de app een nieuwe token moet ophalen. Altijd < TTL. */
  rotateAfterSeconds: z.number().int().positive(),
  seq: z.number().int().nonnegative(),
});
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;
