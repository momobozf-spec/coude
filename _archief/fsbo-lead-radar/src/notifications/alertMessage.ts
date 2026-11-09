/**
 * Het bericht dat de makelaar leest.
 *
 * ─── WAAROM DIT EEN EIGEN, PURE MODULE IS ────────────────────────────────────
 *
 * Dit is het enige deel van het systeem dat een klant met eigen ogen ziet. Het
 * hoort dus exact getest te worden — en dat kan alleen als het opstellen van
 * het bericht losstaat van het versturen ervan.
 *
 * De volgorde van de regels is niet willekeurig. Een makelaar leest deze melding
 * op zijn telefoon, tussen de bedrijven door, en beslist in twee seconden of hij
 * belt. Daarom: eerst wáár en wát (kan ik hier iets mee?), dan het bewijs dat
 * het een particulier is (waarom krijg ik dit?), dan hoe hij contact legt.
 */
import { truncate } from '@/lib/text'

export interface AlertMessageInput {
  postalCode: string | null
  city: string | null
  propertyType: string | null
  listingType: 'sale' | 'rent' | null
  price: number | null
  currency: string
  bedrooms: number | null
  surfaceArea: number | null
  sellerName: string | null
  sellerPhoneE164: string | null
  sellerConfidence: number
  classificationReasons: string[]
  leadScore: number
  url: string
  sourceName: string
  firstSeenAt: Date
  territoryName: string | null
  /** Nu, als argument: een functie die de klok zelf leest is niet testbaar. */
  now: Date
}

/** `&`, `<` en `>` zijn de enige tekens die Telegram-HTML kan verwarren. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Bedragen zoals een Belg ze schrijft: €329.000, met punt als scheidingsteken. */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Prijs onbekend'
  const formatted = new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
  return formatted
}

/** "4 minuten geleden" — de belangrijkste regel in het hele bericht. */
export function formatAge(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000))

  if (minutes < 1) return 'zonet'
  if (minutes === 1) return '1 minuut geleden'
  if (minutes < 60) return `${minutes} minuten geleden`

  const hours = Math.round(minutes / 60)
  if (hours === 1) return '1 uur geleden'
  if (hours < 24) return `${hours} uur geleden`

  const days = Math.round(hours / 24)
  return days === 1 ? '1 dag geleden' : `${days} dagen geleden`
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function buildAlertMessage(input: AlertMessageInput): string {
  const lines: string[] = []

  const heading = input.listingType === 'rent' ? 'NIEUWE FSBO-LEAD (huur)' : 'NIEUWE FSBO-LEAD'
  lines.push(`🚨 <b>${heading}</b>`, '')

  // ── Waar en wat ───────────────────────────────────────────────────────────
  const place = [input.postalCode, input.city].filter(Boolean).join(' ')
  if (place) lines.push(`📍 ${escapeHtml(place)}`)
  if (input.propertyType) lines.push(`🏠 ${escapeHtml(capitalise(input.propertyType))}`)

  lines.push(`💰 ${escapeHtml(formatPrice(input.price, input.currency))}`)

  if (input.bedrooms !== null) {
    lines.push(`🛏 ${input.bedrooms} slaapkamer${input.bedrooms === 1 ? '' : 's'}`)
  }
  if (input.surfaceArea !== null) lines.push(`📐 ${input.surfaceArea} m²`)

  // ── Waarom deze lead ──────────────────────────────────────────────────────
  lines.push('')
  lines.push(`👤 Particuliere verkoper (${Math.round(input.sellerConfidence * 100)}% zeker)`)

  // Eén reden, niet alle: de makelaar wil weten dát we het zeker weten, niet
  // de volledige redenering. Het dashboard toont de rest.
  const topReason = input.classificationReasons[0]
  if (topReason) lines.push(`   ${escapeHtml(truncate(topReason, 90))}`)

  lines.push(`🎯 Leadscore: ${input.leadScore}/100`)
  lines.push(`⏱ ${escapeHtml(formatAge(input.firstSeenAt, input.now))} gevonden`)
  if (input.territoryName) lines.push(`🗺 Werkgebied: ${escapeHtml(input.territoryName)}`)

  // ── Hoe contact leggen ────────────────────────────────────────────────────
  lines.push('')
  if (input.sellerName) lines.push(`🙋 ${escapeHtml(input.sellerName)}`)
  if (input.sellerPhoneE164) lines.push(`📞 ${escapeHtml(input.sellerPhoneE164)}`)
  lines.push(`🔗 <a href="${escapeHtml(input.url)}">Bekijk advertentie</a>`)
  lines.push(`<i>bron: ${escapeHtml(input.sourceName)}</i>`)

  return lines.join('\n')
}

/**
 * De sleutel die een tweede bericht voor dezelfde lead onmogelijk maakt.
 *
 * ─── WAAROM DE SLEUTEL PRECIES DEZE DRIE DELEN HEEFT ─────────────────────────
 *
 * `abonnement + advertentie` zou volstaan om herhaling te voorkomen, maar dan
 * kan een makelaar nooit een tweede bericht krijgen over een woning waarvan de
 * prijs is gezakt — en dat is nu net nieuws dat hij wil hebben. Vandaar de
 * derde component `reason`: 'new' voor de eerste melding, 'price-drop' voor een
 * prijswijziging. Elke reden mag precies één keer.
 *
 * De sleutel staat als UNIQUE in de database, niet alleen in deze functie. Twee
 * workers die tegelijk dezelfde lead verwerken kunnen daardoor niet allebei een
 * bericht sturen: de tweede insert faalt op de constraint.
 */
export type AlertReason = 'new' | 'price-drop' | 'relist'

export function buildDedupeKey(
  subscriptionId: string,
  listingId: string,
  reason: AlertReason,
): string {
  return `${subscriptionId}:${listingId}:${reason}`
}
