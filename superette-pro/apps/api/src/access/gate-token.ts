/**
 * Ondertekening en verificatie van de QR-payload die als digitale sleutel dient.
 *
 * Bewust een los, framework-vrij bestand: dit is de kern van het
 * beveiligingsmodel en moet zonder database, zonder Nest en zonder netwerk te
 * testen zijn. Zie `gate-token.test.ts`.
 *
 * ## Waarom EdDSA (Ed25519) en niet HMAC?
 *
 * Met HMAC deelt de deurscanner dezelfde sleutel waarmee tokens ondertekend
 * worden. Wie de scanner uit de muur trekt en uitleest, kan vanaf dat moment
 * zelf geldige sleutels maken voor elke winkel. Met een asymmetrisch schema
 * staat op de scanner alleen de *public* key: goed genoeg om te verifiëren,
 * waardeloos om te vervalsen.
 *
 * ## Wat zit er níét in de token
 *
 * Geen naam, geen e-mail, geen telefoonnummer. Wie het scherm van een klant
 * fotografeert, ziet een opaque id en een winkel-id — en heeft daar binnen
 * 60 seconden niets meer aan.
 */
import { SignJWT, jwtVerify, errors as joseErrors, type CryptoKey, type KeyObject } from 'jose';
import { gateTokenClaimsSchema, type GateTokenClaims } from '@superette/contracts';

/** De enige toegestane handtekening. Nooit `alg` uit de token zelf lezen. */
const ALGORITHM = 'EdDSA';

/**
 * Speling op klokverschil tussen telefoon, API-server en deurscanner.
 * Vijf seconden: ruim genoeg voor NTP-drift, te krap om een verlopen token
 * betekenisvol te verlengen.
 */
const CLOCK_TOLERANCE_SECONDS = 5;

export type SigningKey = CryptoKey | KeyObject | Uint8Array;

/** Waarom een token afgekeurd werd, op puur cryptografisch niveau. */
export type GateTokenFailure =
  | { ok: false; reason: 'EXPIRED' }
  | { ok: false; reason: 'INVALID_SIGNATURE' }
  | { ok: false; reason: 'MALFORMED_CLAIMS' };

export type GateTokenResult = { ok: true; claims: GateTokenClaims } | GateTokenFailure;

export interface SignGateTokenParams {
  /** `AccessToken.id` — waarmee de gate de single-use check doet. */
  tokenId: string;
  userId: string;
  storeId: string;
  nonce: string;
  rotationSeq: number;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * Ondertekent de claims tot een compacte JWS. De teruggegeven string is exact
 * wat de app in de QR-code codeert — niets meer, niets minder.
 */
export async function signGateToken(params: SignGateTokenParams, privateKey: SigningKey): Promise<string> {
  const iat = Math.floor(params.issuedAt.getTime() / 1000);
  const exp = Math.floor(params.expiresAt.getTime() / 1000);

  if (exp <= iat) {
    throw new RangeError('expiresAt moet na issuedAt liggen');
  }

  return new SignJWT({ sid: params.storeId, nonce: params.nonce, seq: params.rotationSeq })
    .setProtectedHeader({ alg: ALGORITHM })
    .setJti(params.tokenId)
    .setSubject(params.userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(privateKey);
}

/**
 * Verifieert handtekening, vervaltijd en vorm van de claims.
 *
 * Slaagt deze functie, dan weten we: de token is door ons uitgegeven en is nog
 * niet verlopen. We weten *niet* of hij al gebruikt is — dat is een
 * database-vraag en gebeurt in `GateService`. Crypto alleen stopt geen replay.
 *
 * Werpt nooit; alle uitkomsten komen als resultaatobject terug, zodat de
 * aanroeper elke reden apart in de audit-trail kan zetten.
 */
export async function verifyGateToken(jws: string, publicKey: SigningKey): Promise<GateTokenResult> {
  let payload: unknown;

  try {
    const verified = await jwtVerify(jws, publicKey, {
      algorithms: [ALGORITHM], // pin het algoritme; accepteer nooit `alg: none`
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    payload = verified.payload;
  } catch (error) {
    // jose maakt onderscheid tussen "verlopen" en "ongeldig". Dat verschil
    // willen we bewaren: een verlopen token is een klant die te traag was,
    // een ongeldige handtekening is een aanvalspoging.
    if (error instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: 'EXPIRED' };
    }
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }

  // De handtekening klopt, maar dat garandeert de *vorm* van de claims niet.
  // Een oude tokenversie of een bug bij uitgifte mag hier niet doorglippen.
  const parsed = gateTokenClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, reason: 'MALFORMED_CLAIMS' };
  }

  return { ok: true, claims: parsed.data };
}
