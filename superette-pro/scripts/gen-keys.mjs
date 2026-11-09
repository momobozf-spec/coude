/**
 * Genereert het Ed25519-sleutelpaar voor de toegangstokens.
 *
 *   npm run keys:gen
 *
 * Plak de uitvoer in je `.env`. De PRIVATE key blijft op de API-server.
 * De PUBLIC key — en alleen die — gaat naar de deurscanners.
 */
import { exportJWK, generateKeyPair } from 'jose';
import { randomBytes } from 'node:crypto';

const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });

const privateJwk = await exportJWK(privateKey);
const publicJwk = await exportJWK(publicKey);

console.log(`
# ─── Plak dit in superette/.env ──────────────────────────────────────────────

JWT_SECRET='${randomBytes(32).toString('base64url')}'

GATE_SIGNING_PRIVATE_JWK='${JSON.stringify(privateJwk)}'
GATE_SIGNING_PUBLIC_JWK='${JSON.stringify(publicJwk)}'

# ─── Voor de deurscanner (ALLEEN de public key) ──────────────────────────────
#
# Zet nooit de private key op een apparaat dat aan een muur hangt. Wie de
# scanner uit de muur trekt en uitleest, kan met de public key niets — met de
# private key kan hij elke deur van elke winkel openen.

GATE_SIGNING_PUBLIC_JWK='${JSON.stringify(publicJwk)}'

# ─── Device-sleutel voor één scanner ─────────────────────────────────────────
#
# Bewaar de platte sleutel op de scanner, de hash in Store.deviceKeyHash.

DEVICE_KEY='${randomBytes(32).toString('base64url')}'
`);
