/**
 * Prayer domain types.
 *
 * These mirror the Prisma enums but live in `lib` so client components can import
 * them without pulling in the Prisma client.
 */

export type Prayer = 'FAJR' | 'DHUHR' | 'ASR' | 'MAGHRIB' | 'ISHA'

export const PRAYER_ORDER: readonly Prayer[] = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const

export type PrayerStatus = 'ON_TIME' | 'LATE' | 'JAMAAH' | 'MISSED' | 'EXCUSED'

/** Statuses that count toward "prayers completed today". */
export const COMPLETED_PRAYER_STATUSES: readonly PrayerStatus[] = [
  'ON_TIME',
  'LATE',
  'JAMAAH',
] as const

export function isCompletedStatus(status: PrayerStatus): boolean {
  return (COMPLETED_PRAYER_STATUSES as readonly string[]).includes(status)
}

export type CalculationMethod =
  | 'MUSLIM_WORLD_LEAGUE'
  | 'EGYPTIAN'
  | 'KARACHI'
  | 'UMM_AL_QURA'
  | 'DUBAI'
  | 'MOON_SIGHTING_COMMITTEE'
  | 'NORTH_AMERICA'
  | 'KUWAIT'
  | 'QATAR'
  | 'SINGAPORE'
  | 'TEHRAN'
  | 'TURKEY'

export type Madhab = 'SHAFI' | 'HANAFI'

export type HighLatitudeRule = 'MIDDLE_OF_THE_NIGHT' | 'SEVENTH_OF_THE_NIGHT' | 'TWILIGHT_ANGLE'

/** Transliterated names, with Arabic shown only where it carries meaning. */
export const PRAYER_LABELS: Record<Prayer, { latin: string; arabic: string }> = {
  FAJR: { latin: 'Fajr', arabic: 'الفجر' },
  DHUHR: { latin: 'Dhuhr', arabic: 'الظهر' },
  ASR: { latin: 'Asr', arabic: 'العصر' },
  MAGHRIB: { latin: 'Maghrib', arabic: 'المغرب' },
  ISHA: { latin: 'Isha', arabic: 'العشاء' },
}

/**
 * Regional defaults. Used to pre-select a sensible calculation method during
 * onboarding rather than making the user research it.
 */
export const METHOD_BY_COUNTRY: Record<string, CalculationMethod> = {
  BE: 'MUSLIM_WORLD_LEAGUE',
  NL: 'MUSLIM_WORLD_LEAGUE',
  FR: 'MUSLIM_WORLD_LEAGUE',
  DE: 'MUSLIM_WORLD_LEAGUE',
  GB: 'MOON_SIGHTING_COMMITTEE',
  US: 'NORTH_AMERICA',
  CA: 'NORTH_AMERICA',
  SA: 'UMM_AL_QURA',
  AE: 'DUBAI',
  QA: 'QATAR',
  KW: 'KUWAIT',
  EG: 'EGYPTIAN',
  PK: 'KARACHI',
  IN: 'KARACHI',
  BD: 'KARACHI',
  TR: 'TURKEY',
  SG: 'SINGAPORE',
  MY: 'SINGAPORE',
  ID: 'SINGAPORE',
}

export const CALCULATION_METHOD_LABELS: Record<CalculationMethod, string> = {
  MUSLIM_WORLD_LEAGUE: 'Muslim World League',
  EGYPTIAN: 'Egyptian General Authority',
  KARACHI: 'University of Islamic Sciences, Karachi',
  UMM_AL_QURA: 'Umm al-Qura, Makkah',
  DUBAI: 'Dubai',
  MOON_SIGHTING_COMMITTEE: 'Moonsighting Committee',
  NORTH_AMERICA: 'ISNA (North America)',
  KUWAIT: 'Kuwait',
  QATAR: 'Qatar',
  SINGAPORE: 'Singapore',
  TEHRAN: 'Institute of Geophysics, Tehran',
  TURKEY: 'Diyanet (Turkey)',
}
