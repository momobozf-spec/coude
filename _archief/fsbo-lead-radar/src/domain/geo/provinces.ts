/**
 * Belgische postcodes → gemeente en provincie.
 *
 * ─── WAAROM DIT EEN BEREIK-TABEL IS EN GEEN LIJST VAN 2.700 POSTCODES ────────
 *
 * België deelt postcodes uit in aaneengesloten blokken per provincie. 1000–1299
 * is Brussel, 2000–2999 Antwerpen, 9000–9999 Oost-Vlaanderen, enzovoort. Die
 * blokken zijn stabiel en publiek. Een bereik-tabel van twaalf regels dekt dus
 * elke Belgische postcode, terwijl een volledige gemeentelijst 2.700 regels kost
 * die bij elke fusie verouderen.
 *
 * Voor de gemeenten hieronder geldt het omgekeerde: territories worden in de
 * praktijk op de grote steden ingesteld, en die wil je op naam kunnen matchen.
 * De lijst dekt de steden waar de dienst voor bedoeld is; een postcode die er
 * niet in staat krijgt gewoon geen `city`, en het postcode-territory werkt nog
 * steeds. Falen op de gemeentenaam mag nooit de postcodematch breken.
 */

export const PROVINCES = [
  'brussels',
  'antwerpen',
  'vlaams-brabant',
  'waals-brabant',
  'west-vlaanderen',
  'oost-vlaanderen',
  'henegouwen',
  'luik',
  'limburg',
  'luxemburg',
  'namen',
] as const

export type Province = (typeof PROVINCES)[number]

export const PROVINCE_LABELS: Record<Province, string> = {
  brussels: 'Brussels Hoofdstedelijk Gewest',
  antwerpen: 'Antwerpen',
  'vlaams-brabant': 'Vlaams-Brabant',
  'waals-brabant': 'Waals-Brabant',
  'west-vlaanderen': 'West-Vlaanderen',
  'oost-vlaanderen': 'Oost-Vlaanderen',
  henegouwen: 'Henegouwen',
  luik: 'Luik',
  limburg: 'Limburg',
  luxemburg: 'Luxemburg',
  namen: 'Namen',
}

interface PostalRange {
  from: number
  to: number
  province: Province
}

/**
 * De officiële blokindeling. Let op 1300–1499: dat is Waals-Brabant, niet
 * Vlaams-Brabant — een fout die makkelijk te maken is omdat de blokken van
 * Brussel en Vlaams-Brabant er direct omheen liggen.
 */
const POSTAL_RANGES: readonly PostalRange[] = [
  { from: 1000, to: 1299, province: 'brussels' },
  { from: 1300, to: 1499, province: 'waals-brabant' },
  { from: 1500, to: 1999, province: 'vlaams-brabant' },
  { from: 2000, to: 2999, province: 'antwerpen' },
  { from: 3000, to: 3499, province: 'vlaams-brabant' },
  { from: 3500, to: 3999, province: 'limburg' },
  { from: 4000, to: 4999, province: 'luik' },
  { from: 5000, to: 5999, province: 'namen' },
  { from: 6000, to: 6599, province: 'henegouwen' },
  { from: 6600, to: 6999, province: 'luxemburg' },
  { from: 7000, to: 7999, province: 'henegouwen' },
  { from: 8000, to: 8999, province: 'west-vlaanderen' },
  { from: 9000, to: 9999, province: 'oost-vlaanderen' },
]

/** Postcode (viercijferig) → gemeentenaam, voor de steden die ertoe doen. */
const POSTAL_CITIES: Readonly<Record<string, string>> = {
  '1000': 'Brussel',
  '1030': 'Schaarbeek',
  '1040': 'Etterbeek',
  '1050': 'Elsene',
  '1060': 'Sint-Gillis',
  '1070': 'Anderlecht',
  '1080': 'Sint-Jans-Molenbeek',
  '1082': 'Sint-Agatha-Berchem',
  '1090': 'Jette',
  '1140': 'Evere',
  '1150': 'Sint-Pieters-Woluwe',
  '1160': 'Oudergem',
  '1170': 'Watermaal-Bosvoorde',
  '1180': 'Ukkel',
  '1190': 'Vorst',
  '1200': 'Sint-Lambrechts-Woluwe',
  '1210': 'Sint-Joost-ten-Node',
  '1300': 'Waver',
  '1310': 'Terhulpen',
  '1340': 'Ottignies-Louvain-la-Neuve',
  '1400': 'Nijvel',
  '1410': 'Waterloo',
  '1500': 'Halle',
  '1600': 'Sint-Pieters-Leeuw',
  '1700': 'Dilbeek',
  '1800': 'Vilvoorde',
  '1830': 'Machelen',
  '1930': 'Zaventem',
  '2000': 'Antwerpen',
  '2018': 'Antwerpen',
  '2020': 'Antwerpen',
  '2030': 'Antwerpen',
  '2050': 'Antwerpen',
  '2060': 'Antwerpen',
  '2100': 'Deurne',
  '2140': 'Borgerhout',
  '2170': 'Merksem',
  '2180': 'Ekeren',
  '2200': 'Herentals',
  '2300': 'Turnhout',
  '2400': 'Mol',
  '2500': 'Lier',
  '2600': 'Berchem',
  '2610': 'Wilrijk',
  '2800': 'Mechelen',
  '2900': 'Schoten',
  '2930': 'Brasschaat',
  '3000': 'Leuven',
  '3001': 'Heverlee',
  '3010': 'Kessel-Lo',
  '3200': 'Aarschot',
  '3300': 'Tienen',
  '3500': 'Hasselt',
  '3600': 'Genk',
  '3700': 'Tongeren',
  '3800': 'Sint-Truiden',
  '3900': 'Pelt',
  '4000': 'Luik',
  '4020': 'Luik',
  '4100': 'Seraing',
  '4500': 'Hoei',
  '4600': 'Wezet',
  '4700': 'Eupen',
  '4800': 'Verviers',
  '5000': 'Namen',
  '5100': 'Jambes',
  '5300': 'Andenne',
  '5500': 'Dinant',
  '6000': 'Charleroi',
  '6040': 'Jumet',
  '6200': 'Châtelet',
  '6700': 'Aarlen',
  '6800': 'Libramont-Chevigny',
  '6900': 'Marche-en-Famenne',
  '7000': 'Bergen',
  '7100': 'La Louvière',
  '7300': 'Bergen',
  '7500': 'Doornik',
  '7700': 'Moeskroen',
  '8000': 'Brugge',
  '8200': 'Brugge',
  '8300': 'Knokke-Heist',
  '8400': 'Oostende',
  '8500': 'Kortrijk',
  '8600': 'Diksmuide',
  '8700': 'Tielt',
  '8800': 'Roeselare',
  '8900': 'Ieper',
  '9000': 'Gent',
  '9030': 'Mariakerke',
  '9040': 'Sint-Amandsberg',
  '9050': 'Gentbrugge',
  '9100': 'Sint-Niklaas',
  '9200': 'Dendermonde',
  '9300': 'Aalst',
  '9400': 'Ninove',
  '9500': 'Geraardsbergen',
  '9600': 'Ronse',
  '9700': 'Oudenaarde',
  '9800': 'Deinze',
  '9900': 'Eeklo',
}

/**
 * Herkent een Belgische postcode in vrije tekst of een los veld.
 *
 * Ruim ingesteld: bronnen schrijven "B-9000", "9000 Gent" of "9000". Een
 * vijfcijferig getal is géén Belgische postcode (dat is Frankrijk of Duitsland)
 * en levert bewust null op.
 */
export function parseBelgianPostalCode(input: string | null | undefined): string | null {
  if (!input) return null

  const match = input.match(/(?<![\d])(?:B[- ]?)?([1-9]\d{3})(?![\d])/i)
  if (!match?.[1]) return null

  const code = match[1]
  return isBelgianPostalCode(code) ? code : null
}

export function isBelgianPostalCode(code: string): boolean {
  if (!/^[1-9]\d{3}$/.test(code)) return false
  const numeric = Number(code)
  return numeric >= 1000 && numeric <= 9992
}

export function provinceForPostalCode(code: string | null | undefined): Province | null {
  if (!code || !isBelgianPostalCode(code)) return null
  const numeric = Number(code)
  return POSTAL_RANGES.find((range) => numeric >= range.from && numeric <= range.to)?.province ?? null
}

export function cityForPostalCode(code: string | null | undefined): string | null {
  if (!code) return null
  return POSTAL_CITIES[code] ?? null
}

export function isProvince(value: string): value is Province {
  return (PROVINCES as readonly string[]).includes(value)
}

/**
 * Afstand tussen twee coördinaten in kilometer (haversine).
 *
 * Nodig voor RADIUS-territories. Voor Belgische afstanden (< 300 km) is de
 * bolbenadering ruim nauwkeurig genoeg; een ellipsoïde-formule zou hier
 * meters winnen op een radius die in hele kilometers is ingesteld.
 */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const EARTH_RADIUS_KM = 6371
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Benaderende coördinaten per postcode-blok, zodat een RADIUS-territory ook
 * werkt voor advertenties zonder coördinaten. Bewust op stadsniveau: preciezer
 * doen we niet, want preciezer weten we niet.
 */
const POSTAL_CENTROIDS: Readonly<Record<string, { lat: number; lng: number }>> = {
  '1000': { lat: 50.8467, lng: 4.3525 },
  '2000': { lat: 51.2194, lng: 4.4025 },
  '2800': { lat: 51.0259, lng: 4.4776 },
  '3000': { lat: 50.8798, lng: 4.7005 },
  '3500': { lat: 50.9307, lng: 5.3325 },
  '4000': { lat: 50.6326, lng: 5.5797 },
  '5000': { lat: 50.4674, lng: 4.8718 },
  '6000': { lat: 50.4108, lng: 4.4446 },
  '7000': { lat: 50.4542, lng: 3.9564 },
  '8000': { lat: 51.2093, lng: 3.2247 },
  '8500': { lat: 50.8279, lng: 3.2649 },
  '9000': { lat: 51.0543, lng: 3.7174 },
  '9100': { lat: 51.1651, lng: 4.1436 },
  '9300': { lat: 50.9378, lng: 4.0355 },
}

/**
 * Beste bekende coördinaat voor een postcode: exact als we hem kennen, anders
 * het centrum van de dichtstbijzijnde bekende postcode in hetzelfde blok.
 */
export function centroidForPostalCode(
  code: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!code || !isBelgianPostalCode(code)) return null

  const exact = POSTAL_CENTROIDS[code]
  if (exact) return exact

  const numeric = Number(code)
  const province = provinceForPostalCode(code)
  if (!province) return null

  let best: { lat: number; lng: number } | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [known, coords] of Object.entries(POSTAL_CENTROIDS)) {
    if (provinceForPostalCode(known) !== province) continue
    const distance = Math.abs(Number(known) - numeric)
    if (distance < bestDistance) {
      bestDistance = distance
      best = coords
    }
  }

  return best
}
