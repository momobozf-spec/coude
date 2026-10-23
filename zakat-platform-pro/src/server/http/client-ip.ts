/**
 * Het IP-adres van de bezoeker, zoals de eigen reverse proxy het doorgeeft.
 *
 * `X-Forwarded-For` wordt van links naar rechts aangevuld: wat de bezoeker zelf
 * meestuurt staat links, wat onze proxy toevoegt staat rechts. Wie het
 * linkse adres vertrouwt, laat een aanvaller per verzoek een ander IP kiezen en
 * omzeilt zo elke limiet. Daarom het adres op positie `hops` vanaf rechts.
 *
 * `hops = 0`: er staat geen proxy voor de app; de header wordt genegeerd en
 * alle bezoekers delen één emmer. Daarom weigert productie `hops = 0`.
 *
 * De app-poort mag alleen voor de proxy bereikbaar zijn (docker-compose bindt
 * hem aan 127.0.0.1): wie de proxy omzeilt, kiest zelf het rechtse adres.
 */
export function clientIp(headers: Headers, hops: number): string {
  if (hops <= 0) return 'direct'

  // Geen terugval op X-Real-IP: die header zet de bezoeker zelf als hij de
  // proxy omzeilt. Een correct ingestelde proxy vult altijd X-Forwarded-For.
  const forwarded = headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'

  const chain = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (chain.length === 0) return 'unknown'
  return chain[Math.max(chain.length - hops, 0)] ?? 'unknown'
}

/** Aantal vertrouwde proxies, rechtstreeks uit de omgeving (ook bruikbaar buiten serverEnv). */
export function trustedProxyHops(): number {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS ?? '1')
  return Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : 1
}
