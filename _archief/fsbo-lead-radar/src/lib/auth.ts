import 'server-only'

import { cookies } from 'next/headers'

import { getEnv, isAdminAuthConfigured } from './env'
import { safeEquals, signValue, verifySignedValue } from './hash'

/**
 * Adminauthenticatie: één wachtwoord, één ondertekend cookie.
 *
 * ─── WAAROM NIET next-auth ───────────────────────────────────────────────────
 *
 * Er is één gebruiker: de beheerder van deze dienst. Geen registratie, geen
 * wachtwoordherstel, geen rollen, geen OAuth. Een compleet auth-framework zou
 * hier meer aanvalsoppervlak en meer configuratie zijn dan bescherming.
 *
 * Wat er wél in moet, zit erin: het cookie is HMAC-ondertekend (dus niet te
 * vervalsen zonder `SESSION_SECRET`), het is httpOnly en SameSite=Lax (dus niet
 * te lezen vanuit JavaScript en niet mee te sturen vanaf een andere site), het
 * verloopt, en de wachtwoordvergelijking loopt in constante tijd.
 *
 * ─── DE ONVEILIGE MODUS ──────────────────────────────────────────────────────
 *
 * Zonder `ADMIN_PASSWORD` staat het dashboard open — maar alleen buiten
 * productie, en het zegt dat met een banner. In productie weigert de app te
 * starten (`assertProductionSecrets`). Zo hoeft niemand tijdens het opzetten
 * een wachtwoord te verzinnen, en kan de dienst niet per ongeluk open op het
 * internet komen te staan.
 */

const COOKIE_NAME = 'fsbo_admin'

interface SessionPayload {
  /** Uitgegeven op, in milliseconden. */
  iat: number
  /** Verloopt op. */
  exp: number
}

function encode(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${signValue(body, secret)}`
}

function decode(token: string, secret: string): SessionPayload | null {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null

  const body = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  if (!verifySignedValue(body, signature, secret)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Controleert het wachtwoord en geeft een sessietoken terug.
 *
 * Retourneert `null` bij een fout wachtwoord — bewust zonder onderscheid te
 * maken met "geen wachtwoord ingesteld", zodat een aanvaller niet kan aflezen
 * hoe de dienst geconfigureerd is.
 */
export function createSession(password: string): string | null {
  const env = getEnv()
  if (!isAdminAuthConfigured(env)) return null
  if (!safeEquals(password, env.ADMIN_PASSWORD)) return null

  const now = Date.now()
  return encode(
    { iat: now, exp: now + env.SESSION_TTL_HOURS * 3_600_000 },
    env.SESSION_SECRET,
  )
}

export async function setSessionCookie(token: string): Promise<void> {
  const env = getEnv()
  const store = await cookies()

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3600,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** Is de huidige bezoeker ingelogd? */
export async function isAuthenticated(): Promise<boolean> {
  const env = getEnv()

  // Geen wachtwoord ingesteld: open dashboard. Kan alleen buiten productie,
  // want `assertProductionSecrets` laat de app anders niet starten.
  if (!isAdminAuthConfigured(env)) return env.NODE_ENV !== 'production'

  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return false

  return decode(token, env.SESSION_SECRET) !== null
}

/** Loopt de admin zonder wachtwoord? Het dashboard toont dan een waarschuwing. */
export function isOpenAccessMode(): boolean {
  const env = getEnv()
  return !isAdminAuthConfigured(env) && env.NODE_ENV !== 'production'
}

/**
 * Gooit wanneer de bezoeker niet ingelogd is.
 *
 * Elke server action roept dit aan als eerste regel. Een action is een POST
 * naar een publiek endpoint; dat de knop erachter alleen op een beveiligde
 * pagina staat, houdt niemand tegen die het adres kent.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error('Niet ingelogd')
  }
}
