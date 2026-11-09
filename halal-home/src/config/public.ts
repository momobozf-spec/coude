/**
 * Configuratie die de client mág zien. Bewust een apart bestand van
 * `src/config/env.ts`: die leest secrets en is `server-only`, dit niet.
 *
 * Alles hier is publiek. Zet er nooit een sleutel in.
 */

export const APP_NAME = 'Halal Home'

export const APP_TAGLINE =
  'Van eerste zoekopdracht tot de sleutel van je nieuwe woning.'

/**
 * De standaard-disclaimer onder elke financiële en juridische weergave.
 * Staat hier zodat er precies één formulering bestaat en die niet per pagina
 * uit elkaar loopt.
 */
export const GENERAL_DISCLAIMER =
  'Halal Home geeft informatie, geen financieel, juridisch of religieus advies. ' +
  'Gegevens over financieringsproducten komen van de aanbieder of van de vermelde bron. ' +
  'Controleer altijd bij de aanbieder, je notaris en een geleerde die je vertrouwt.'

export const SUPPORTED_COUNTRIES = ['BE'] as const
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number]

export const DEFAULT_COUNTRY: SupportedCountry = 'BE'

/** Belgische gewesten. Bepalen welke CostRules en checklists gelden. */
export const BE_REGIONS = ['FLANDERS', 'BRUSSELS', 'WALLONIA'] as const
export type BeRegion = (typeof BE_REGIONS)[number]

export const BE_REGION_LABELS: Record<BeRegion, string> = {
  FLANDERS: 'Vlaanderen',
  BRUSSELS: 'Brussel',
  WALLONIA: 'Wallonië',
}
