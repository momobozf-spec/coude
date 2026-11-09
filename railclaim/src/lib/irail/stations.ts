import type { StationInfo } from './schemas'

/**
 * Station search for the route autocomplete.
 *
 * Belgian station names are the awkward part: the same station is
 * "Brussel-Zuid" in Dutch, "Bruxelles-Midi" in French, and iRail returns
 * `standardname` as the combined "Brussel-Zuid/Bruxelles-Midi". A commuter
 * typing either half must find it, so we match across both the localised name
 * and every segment of the standard name.
 */

export interface StationMatch {
  id: string
  /** Localised name, for display. */
  name: string
  /** The bilingual official name, shown as a subtitle when it differs. */
  standardName: string | null
}

/**
 * Fold accents and punctuation so "Liege", "Liège" and "LIEGE" all match, and
 * so "gent sint pieters" finds "Gent-Sint-Pieters".
 */
export function normaliseForSearch(value: string): string {
  return value
    .normalize('NFD')
    // Strip the Unicode combining diacritical marks block (U+0300-U+036F)
    // that NFD just split off, so "Liège" and "Liege" compare equal.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[-/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** All the strings a user might reasonably type for this station. */
function searchableTerms(station: StationInfo): string[] {
  const terms = [station.name]
  if (station.standardname) {
    terms.push(station.standardname)
    // "Brussel-Zuid/Bruxelles-Midi" -> both halves individually.
    terms.push(...station.standardname.split('/'))
  }
  return terms.map(normaliseForSearch).filter(Boolean)
}

/**
 * Rank: exact match first, then prefix, then word-prefix, then substring.
 * Returns -1 when the station does not match at all.
 */
function score(terms: string[], query: string): number {
  let best = -1
  for (const term of terms) {
    if (term === query) return 100
    if (term.startsWith(query)) {
      best = Math.max(best, 80)
      continue
    }
    // Match at the start of any word: "pieters" finds "Gent Sint Pieters".
    if (term.split(' ').some((word) => word.startsWith(query))) {
      best = Math.max(best, 60)
      continue
    }
    if (term.includes(query)) best = Math.max(best, 30)
  }
  return best
}

export function searchStations(
  stations: StationInfo[],
  rawQuery: string,
  limit = 8,
): StationMatch[] {
  const query = normaliseForSearch(rawQuery)
  if (query.length < 2) return []

  const scored: { station: StationInfo; score: number }[] = []

  for (const station of stations) {
    const value = score(searchableTerms(station), query)
    if (value > 0) scored.push({ station, score: value })
  }

  scored.sort(
    (a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name, 'nl'),
  )

  return scored.slice(0, limit).map(({ station }) => ({
    id: station.id,
    name: station.name,
    standardName:
      station.standardname && station.standardname !== station.name
        ? station.standardname
        : null,
  }))
}

/** Look up one station by its iRail id — used to re-render a saved route. */
export function findStationById(
  stations: StationInfo[],
  id: string,
): StationInfo | null {
  return stations.find((s) => s.id === id) ?? null
}
