/**
 * Tijdzonerekenwerk voor België.
 *
 * Staat in `lib` en niet in de statistiekservice omdat het zuivere rekenkunde
 * is: geen database, geen `server-only`. Dat maakt hem los testbaar, en de twee
 * dagen per jaar waarop de klok verspringt zijn precies de gevallen die je wél
 * wil kunnen testen.
 */

const BELGIAN_TIME_ZONE = 'Europe/Brussels'

const ZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BELGIAN_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BELGIAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function read(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? '0')
}

/**
 * Hoeveel milliseconden Brussel op dit moment vóór UTC loopt (+1u of +2u).
 *
 * Uitgerekend door hetzelfde moment één keer in Brusselse tijd te formatteren
 * en die velden weer als UTC te lezen; het verschil ís de offset. Zo is er geen
 * tijdzonebibliotheek nodig, en het blijft kloppen als de EU ooit stopt met
 * zomertijd.
 */
export function belgianOffsetMs(instant: Date): number {
  const parts = ZONE_FORMATTER.formatToParts(instant)

  const asIfUtc = Date.UTC(
    read(parts, 'year'),
    read(parts, 'month') - 1,
    read(parts, 'day'),
    // 'en-US' met hour12:false geeft middernacht als 24; `Date.UTC` rekent dat
    // door naar de volgende dag, wat een dag verschil zou opleveren.
    read(parts, 'hour') % 24,
    read(parts, 'minute'),
    read(parts, 'second'),
  )

  return asIfUtc - instant.getTime()
}

/**
 * Middernacht in Belgische tijd, uitgedrukt als UTC-moment.
 *
 * "Leads vandaag" betekent vanaf lokale middernacht, niet "de laatste 24 uur" —
 * anders klopt het getal niet met wat een makelaar op zijn scherm ziet.
 *
 * De tweede berekening is geen overbodige herhaling: op de twee dagen per jaar
 * dat de klok verspringt, verschilt de offset om middernacht van die op het
 * moment van opvragen. Eén keer verfijnen brengt het antwoord op de juiste kant
 * van de overgang.
 */
export function startOfBelgianDay(now: Date = new Date()): Date {
  const parts = DATE_FORMATTER.formatToParts(now)
  const midnightAsUtc = Date.UTC(read(parts, 'year'), read(parts, 'month') - 1, read(parts, 'day'))

  const firstGuess = midnightAsUtc - belgianOffsetMs(new Date(midnightAsUtc))
  return new Date(midnightAsUtc - belgianOffsetMs(new Date(firstGuess)))
}
