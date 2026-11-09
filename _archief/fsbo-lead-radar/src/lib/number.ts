/**
 * Getallen lezen zoals het vasteland ze schrijft.
 *
 * ─── WAAROM DIT EEN GEDEELDE MODULE IS ───────────────────────────────────────
 *
 * De Belgische conventie is punt als duizendtalscheiding en komma als
 * decimaalteken — omgekeerd aan de Angelsaksische. Wie dat fout doet leest
 * "329.000" als 329 euro, waarna een appartement als huurwoning door de
 * pijplijn gaat en bij de verkeerde makelaar belandt.
 *
 * Die regel stond eerst op twee plekken: in de prijsparser van de normalisatie
 * en in de JSON-LD-lezer. Twee kopieën van dezelfde subtiele regel lopen
 * gegarandeerd uit elkaar, en dat gebeurde ook — de JSON-LD-lezer maakte van
 * "€ 329.000" netjes 329.
 */

/**
 * Leest een getal uit een string met Europese of Angelsaksische scheidingstekens.
 *
 * De heuristiek, in volgorde:
 *
 *   1. Staat de komma achteraan? Dan is de komma het decimaalteken en zijn de
 *      punten duizendtalscheidingen. ("329.000,50")
 *   2. Staat de punt achteraan met precies twee cijfers erna? Dan is de punt
 *      het decimaalteken. ("1250.50")
 *   3. Staat de punt achteraan met een ander aantal cijfers? Dan is het een
 *      duizendtalscheiding. ("329.000")
 *
 * Geeft `null` bij alles wat geen getal is.
 */
export function parseEuropeanNumber(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '')
  if (cleaned.length === 0) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  let normalized: string
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    const decimals = cleaned.length - lastDot - 1
    normalized = decimals === 2 ? cleaned.replace(/,/g, '') : cleaned.replace(/[.,]/g, '')
  } else {
    normalized = cleaned
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
